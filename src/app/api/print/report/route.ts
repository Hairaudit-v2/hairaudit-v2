import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { parseRole } from "@/lib/roles";
import rubric from "@/lib/audit/rubrics/hairaudit_clinical_v1.json";
import { scoreAudit } from "@/lib/audit/score";
import { buildReportViewModel, normalizeAuditMode, type AuditMode } from "@/lib/pdf/reportBuilder";
import { resolveAuditModeFromCaseAccess } from "@/lib/reports/accessMode";
import { verifyRenderToken } from "@/lib/reports/internalRenderToken";
import { renderRadarChartPng } from "@/lib/pdf/renderRadarChart";

/* Admin client (NO cookies, NO sessions — Playwright safe) */
function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/* Escape helper (HTML-safe) */
function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toNumberRecord(x: unknown): Record<string, number> {
  if (!x || typeof x !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function clamp100(n: number) {
  return Math.max(0, Math.min(100, n));
}

/* GET /api/print/report?caseId=...&token=... */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const requestedAuditMode = normalizeAuditMode(url.searchParams.get("auditMode") ?? undefined);
  const tokenSecret =
    String(process.env.REPORT_RENDER_TOKEN ?? "").trim() ||
    String(process.env.INTERNAL_API_KEY ?? "").trim() ||
    String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const tokenPayload = tokenSecret ? verifyRenderToken(token, tokenSecret) : null;
  const allowToken =
    !!tokenPayload &&
    tokenPayload.caseId === caseId &&
    tokenPayload.auditMode === requestedAuditMode;

  if (!caseId) return new NextResponse("Missing caseId", { status: 400 });

  if (token && !allowToken) {
    return new NextResponse(
      "<!doctype html><html><body><h1>Unauthorized</h1><p>Invalid report token.</p></body></html>",
      {
        status: 401,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const supabase = supabaseAdmin();

  let sessionUserId: string | null = null;
  let sessionRole = "patient";
  try {
    const supabaseAuth = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (user) {
      sessionUserId = user.id;
      sessionRole = parseRole((user.user_metadata as Record<string, unknown>)?.role) || "patient";
    }
  } catch {
    // ignore: cookie-less/internal render path
  }

  if (!allowToken && !sessionUserId) {
    return new NextResponse(
      "<!doctype html><html><body><h1>Unauthorized</h1><p>Authentication required.</p></body></html>",
      {
        status: 401,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  /* Load case */
  const { data: c, error: caseErr } = await supabase
    .from("cases")
    .select("id, title, status, created_at, user_id, patient_id, doctor_id, clinic_id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr || !c) return new NextResponse("Case not found", { status: 404 });

  if (sessionUserId) {
    const allowed =
      sessionUserId === c.user_id ||
      sessionUserId === c.patient_id ||
      sessionUserId === c.doctor_id ||
      sessionUserId === c.clinic_id ||
      sessionRole === "auditor";
    if (!allowed) return new NextResponse("Forbidden", { status: 403 });
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", sessionUserId)
        .maybeSingle();
      if (profile?.role) sessionRole = parseRole(profile.role) || "patient";
    } catch {
      // profiles may not exist
    }
  }
  let auditMode: AuditMode = "patient";
  if (allowToken && tokenPayload) {
    auditMode = tokenPayload.auditMode;
  } else if (sessionUserId) {
    auditMode = resolveAuditModeFromCaseAccess({
      role: sessionRole,
      userId: sessionUserId,
      caseRow: c,
    });
  }
  auditMode = normalizeAuditMode(auditMode);

    /* Load uploads */
  const { data: uploads, error: upErr } = await supabase
    .from("uploads")
    .select("id, type, storage_path, metadata, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (upErr) console.error("uploads error:", upErr.message);

  const bucket = process.env.CASE_FILES_BUCKET || "case-files";

  /* Signed image URLs (only for patient_photo + image types) */
  const imageUploads = (uploads ?? []).filter((u) => {
    const t = String(u.type ?? "").toLowerCase();
    return (
      t.startsWith("patient_photo:") ||
      t.includes("image") ||
      t.includes("photo") ||
      t.includes("jpg") ||
      t.includes("jpeg") ||
      t.includes("png") ||
      t.includes("webp")
    );
  });

  const signedImages = await Promise.all(
    imageUploads.map(async (u) => {
      const path = String(u.storage_path ?? "");
      if (!path) return { ...u, signedUrl: null };

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 10);

      if (error) {
        console.error("signed url error:", error.message);
        return { ...u, signedUrl: null };
      }

      return { ...u, signedUrl: data?.signedUrl ?? null };
    })
  );

  // Group by category (from metadata.category OR from type prefix)
  const byCategory: Record<string, any[]> = {};
  for (const u of signedImages) {
    const metaCat = (u as any)?.metadata?.category;
    const type = String((u as any)?.type ?? "");
    const typeCat = type.startsWith("patient_photo:") ? type.split(":")[1] : null;
    const cat = metaCat || typeCat || "uncategorized";
    byCategory[cat] = byCategory[cat] || [];
    byCategory[cat].push(u);
  }

  /* Load latest report summary (optional) */
  const { data: latestReport } = await supabase
    .from("reports")
    .select("id, version, summary, created_at")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const summary = (latestReport?.summary ?? {}) as any;
  const forensic = (summary?.forensic_audit ?? summary?.forensic ?? null) as any;

  // -----------------------------
  // Compute rubric score if answers exist
  // -----------------------------
  const answers =
    summary?.answers ??
    summary?.audit_answers ??
    summary?.scorecard_answers ??
    null;

  let computed: any = summary?.computed ?? null;

  if (answers) {
    try {
      computed = scoreAudit(rubric as any, answers);
      summary.computed = computed;

      // Optional: persist computed so future renders don’t need to recompute
      if (latestReport?.id) {
        await supabase.from("reports").update({ summary }).eq("id", latestReport.id);
      }
    } catch (e) {
      console.error("scoreAudit failed:", e);
    }
  }

  // Prefer rubric score, fall back to legacy summary.score
  const overall = Number.isFinite(computed?.overall_score)
    ? Number(computed.overall_score)
    : Number.isFinite(summary?.overall_score)
      ? Number(summary.overall_score)
      : Number.isFinite(summary?.score)
        ? Number(summary.score)
        : null;

  const grade =
    computed?.grade ??
    summary?.grade ??
    (overall !== null ? "Manual Score" : "Needs Review");

  const conf =
    computed?.confidence ??
    summary?.confidence ??
    "medium";

  // Key metrics: use existing stored values if present; otherwise leave blank for now
  const metrics = {
    donor_quality: summary.donor_quality ?? summary?.key_metrics?.donor_quality ?? "—",
    graft_survival_estimate:
      summary.graft_survival_estimate ?? summary?.key_metrics?.graft_survival_estimate ?? "—",
    transection_risk: summary?.key_metrics?.transection_risk ?? "—",
    implantation_density: summary?.key_metrics?.implantation_density ?? "—",
    hairline_naturalness: summary?.key_metrics?.hairline_naturalness ?? "—",
    donor_scar_visibility: summary?.key_metrics?.donor_scar_visibility ?? "—",
  };

  // Component scores for area graphs (domain + section level)
  const compDomainsBase = toNumberRecord(
    computed?.component_scores?.domains ??
      summary?.computed?.component_scores?.domains ??
      summary?.area_scores ??
      null
  );
  const compSectionsBase = toNumberRecord(
    computed?.component_scores?.sections ??
      summary?.computed?.component_scores?.sections ??
      summary?.section_scores ??
      forensic?.section_scores ??
      null
  );

  // Build area score items: score 0-100 → display as X/5, with High/Medium/Low level
  const scoreToDisplay = (s: number) => {
    const outOf5 = Math.round((s / 100) * 5);
    const clamped = Math.max(0, Math.min(5, outOf5));
    const level = s >= 80 ? "High" : s >= 50 ? "Medium" : "Low";
    return { outOf5: clamped, level };
  };

  const domainOrder = (rubric as { domains?: { domain_id: string; title: string }[] })?.domains ?? [];

  // If we only have section scores (AI forensic audit), derive domain scores by averaging domain sections.
  const derivedDomainsFromSections: Record<string, number> = {};
  if (Object.keys(compDomainsBase).length === 0 && Object.keys(compSectionsBase).length > 0) {
    for (const d of domainOrder as any[]) {
      const secs = (d?.sections ?? []) as { section_id: string }[];
      const vals = secs
        .map((s) => compSectionsBase[s.section_id])
        .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
      if (vals.length) {
        derivedDomainsFromSections[d.domain_id] = vals.reduce((a, b) => a + b, 0) / vals.length;
      }
    }
  }

  const compDomains = Object.keys(compDomainsBase).length ? compDomainsBase : derivedDomainsFromSections;
  const compSections = compSectionsBase;
  const areaScores = domainOrder
    .filter((d) => compDomains[d.domain_id] != null)
    .map((d) => {
      const s = Number(compDomains[d.domain_id]);
      const { outOf5, level } = scoreToDisplay(s);
      return { title: d.title, score: s, outOf5: outOf5, level };
    });

  const sectionTitles: Record<string, string> = {};
  for (const d of domainOrder) {
    for (const sec of (d as { sections?: { section_id: string; title: string }[] }).sections ?? []) {
      sectionTitles[sec.section_id] = sec.title;
    }
  }
  const sectionScoresList = Object.entries(compSections)
    .filter(([, v]) => v != null)
    .map(([id, v]) => ({
      title: sectionTitles[id] ?? id.replace(/[._]/g, " "),
      score: clamp100(Number(v)),
      ...scoreToDisplay(clamp100(Number(v))),
    }));

  // Highlights/Risks
  const highlights = Array.isArray(summary.findings)
    ? summary.findings
    : Array.isArray(summary.highlights)
      ? summary.highlights
      : [];

  const risks = Array.isArray(summary.risks) ? summary.risks : [];

  const doctorAnswers = summary?.doctor_answers as Record<string, unknown> | undefined;
  const procLabels: Record<string, string> = {
    fue_manual: "FUE (Manual)", fue_motorized: "FUE (Motorized)", fue_robotic: "FUE (Robotic)",
    fut: "FUT", combined: "Combined FUT + FUE",
  };
  const viewModel = buildReportViewModel({
    auditMode,
    content: {
      caseId,
      version: Number(latestReport?.version ?? 1),
      generatedAt: new Date().toLocaleString(),
      auditMode,
      score: overall,
      donorQuality: String(metrics.donor_quality ?? "—"),
      graftSurvival: String(metrics.graft_survival_estimate ?? "—"),
      notes: typeof summary?.notes === "string" ? summary.notes : undefined,
      findings: highlights,
      areaScores: {
        domains: compDomains,
        sections: compSections,
      },
      forensic: summary?.forensic_audit as any,
      images: [],
    },
    rawCase: c,
    uploads,
    aiResult: summary,
  });

  const doctorBlock =
    (viewModel.auditMode === "doctor" || viewModel.auditMode === "auditor") &&
    doctorAnswers &&
    typeof doctorAnswers === "object"
      ? `
    <div class="section">
      <h2>Doctor / Clinic Submission</h2>
      <div class="metricList">
        <div><span>Procedure</span><b>${esc(String(procLabels[String(doctorAnswers.procedureType ?? "")] ?? doctorAnswers.procedureType ?? "—"))}</b></div>
        <div><span>Grafts extracted</span><b>${esc(String(doctorAnswers.totalGraftsExtracted ?? doctorAnswers.grafts_extracted ?? "—"))}</b></div>
        <div><span>Grafts implanted</span><b>${esc(String(doctorAnswers.totalGraftsImplanted ?? doctorAnswers.grafts_implanted ?? "—"))}</b></div>
        <div><span>Extraction by</span><b>${esc(String(doctorAnswers.extractionPerformedBy ?? doctorAnswers.extraction_performed_by ?? "—"))}</b></div>
        <div><span>Implantation by</span><b>${esc(String(doctorAnswers.implantationPerformedBy ?? doctorAnswers.implantation_performed_by ?? "—"))}</b></div>
      </div>
    </div>`
      : "";

  const created = new Date(c.created_at).toLocaleString();
  const generated = new Date().toLocaleString();

  // Optional: radar render (server-side) for print/PDF export
  let radarDataUri: string | null = null;
  try {
    const sectionScoresForRadar = toNumberRecord(forensic?.section_scores ?? summary?.section_scores ?? null);
    if (Object.keys(sectionScoresForRadar).length > 0) {
      const confForRadar =
        Number.isFinite(forensic?.confidence)
          ? Number(forensic.confidence)
          : Number.isFinite(summary?.confidence_score)
            ? Number(summary.confidence_score)
            : 0.45;
      const radar = await renderRadarChartPng({
        section_scores: sectionScoresForRadar,
        overall_score:
          Number.isFinite(forensic?.overall_score) ? Number(forensic.overall_score) : (overall ?? 0),
        confidence: confForRadar,
      });
      radarDataUri = `data:image/png;base64,${radar.buffer.toString("base64")}`;
    }
  } catch (e) {
    console.error("renderRadarChartPng failed:", e);
  }

  const photoCategoryKeys = Object.keys(byCategory);
  const photosBlock =
    photoCategoryKeys.length > 0
      ? `
    <div class="section pageBreak">
      <h2>Case Photos</h2>
      <div class="subtitle" style="margin-top: 4px;">Grouped by upload category.</div>
      ${photoCategoryKeys
        .map((cat) => {
          const items = (byCategory[cat] ?? []).filter((x) => !!x?.signedUrl);
          if (!items.length) return "";
          return `
        <div class="photoCat">
          <div class="photoCatTitle">${esc(String(cat).replaceAll("_", " "))}</div>
          <div class="photoGrid">
            ${items
              .map(
                (u) => `
              <figure class="photo">
                <img src="${esc(String(u.signedUrl))}" alt="${esc(String(u.metadata?.label ?? u.type ?? "photo"))}" />
                <figcaption>${esc(String(u.metadata?.label ?? u.type ?? ""))}</figcaption>
              </figure>`
              )
              .join("")}
          </div>
        </div>`;
        })
        .join("")}
    </div>
      `
      : "";

  const narrativeFromForensic =
    forensic?.summary && typeof forensic.summary === "string"
      ? `
    <div class="section pageBreak">
      <h2>Clinical Narrative</h2>
      <div class="subtitle" style="margin-top: 4px;">Clinical-grade audit narrative generated from available imagery.</div>
      <div class="prose">${esc(forensic.summary).replaceAll("\n", "<br/>")}</div>
    </div>
      `
      : "";

  const pdfDebugEnabled = String(process.env.PDF_DEBUG ?? "").toLowerCase() === "true";
  const debugFooter = pdfDebugEnabled
    ? `
    <div class="footerDebug">
      Renderer: playwright • Mode: ${esc(auditMode)} • Case: <span class="mono">${esc(caseId)}</span> v${esc(String(latestReport?.version ?? 1))}
    </div>`
    : "";

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>HairAudit Report</title>

  <style>
    @page { size: A4; margin: 16mm 14mm; }

    :root {
      --ink: #0b0d12;
      --muted: #5b6472;
      --line: #e6e8ee;
      --card: #f7f8fb;
      --soft: #fbfbfd;
    }

    * { box-sizing: border-box; }

    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: var(--ink);
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .wrap { max-width: 900px; margin: 0 auto; }
    .pageBreak { page-break-before: always; }

    .topbar {
      display:flex;
      justify-content:space-between;
      gap: 16px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: linear-gradient(180deg, #ffffff 0%, var(--soft) 100%);
      page-break-inside: avoid;
    }

    .brand { display:flex; gap: 12px; align-items:flex-start; }

    .mark {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: radial-gradient(circle at 30% 20%, #fff, #eef1f7);
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight: 900;
    }

    .title { margin: 0; font-size: 18px; font-weight: 800; }
    .subtitle { margin-top: 4px; font-size: 12px; color: var(--muted); }

    .meta {
      text-align:right;
      font-size: 11px;
      color: var(--muted);
      line-height: 1.4;
    }
    .meta b { color: var(--ink); }

    .section {
      margin-top: 18px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #fff;
      page-break-inside: avoid;
    }

    .sectionHead { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .pillRow { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }

    .pill {
      display:inline-flex; gap:6px; align-items:center;
      padding: 6px 10px; border-radius: 999px;
      border: 1px solid var(--line); background: #fff;
      font-size: 11px; color: var(--muted);
    }
    .pill b { color: var(--ink); }

    .scoreGrid { display:grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-top: 12px; }

    .scoreCard {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px;
      background: linear-gradient(180deg, #fff 0%, var(--soft) 100%);
    }
    .scoreLabel { font-size: 12px; color: var(--muted); }
    .scoreValue { font-size: 42px; font-weight: 900; letter-spacing: -0.03em; line-height: 1; margin-top: 6px; }
    .scoreSub { font-size: 11px; color: var(--muted); margin-top: 4px; }

    .metricCard { border: 1px solid var(--line); border-radius: 16px; padding: 14px; background:#fff; }
    .metricTitle { font-size: 12px; color: var(--muted); margin-bottom: 8px; font-weight: 700; }
    .metricList { display:grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
    .metricList div { display:flex; justify-content:space-between; gap:10px; font-size: 11px; }
    .metricList span { color: var(--muted); }
    .metricList b { color: var(--ink); }

    .twoCol { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .listCard { border: 1px solid var(--line); border-radius: 16px; padding: 14px; background:#fff; }
    .listTitle { font-size: 12px; font-weight: 800; margin-bottom: 8px; }
    .listCard ul { margin: 0; padding-left: 18px; }
    .listCard li { font-size: 11px; color: var(--ink); margin: 6px 0; }

    .areaScoreGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-top: 14px; }
    .areaScoreCard {
      border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: #fff;
      display: flex; flex-direction: column; gap: 8px;
    }
    .areaScoreTitle { font-size: 12px; font-weight: 700; color: var(--ink); }
    .areaScoreBar { height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; }
    .areaScoreFill { height: 100%; border-radius: 4px; }
    .areaScoreFill.high { background: #059669; }
    .areaScoreFill.medium { background: #d97706; }
    .areaScoreFill.low { background: #dc2626; }
    .areaScoreMeta { font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; }
    .areaScoreMeta b { color: var(--ink); }

    .footer {
      margin-top: 18px;
      font-size: 10px;
      color: var(--muted);
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }

    .footerDebug {
      margin-top: 4px;
      font-size: 10px;
      color: var(--muted);
    }

    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

    .prose { margin-top: 10px; font-size: 12px; line-height: 1.55; color: var(--ink); }

    .radarWrap { margin-top: 12px; display:flex; justify-content:center; }
    .radarImg {
      width: 100%;
      max-width: 560px;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: #0b1226;
      padding: 10px;
    }

    .photoCat { margin-top: 14px; page-break-inside: avoid; }
    .photoCatTitle { font-size: 12px; font-weight: 800; margin-bottom: 8px; color: var(--ink); text-transform: capitalize; }
    .photoGrid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .photo { margin: 0; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: #fff; }
    .photo img { display:block; width: 100%; height: 170px; object-fit: cover; }
    .photo figcaption { padding: 8px 10px; font-size: 10px; color: var(--muted); border-top: 1px solid var(--line); }

    @media print {
      .photo img { height: 165px; }
    }
  </style>
</head>

<body>
  <div class="wrap">

    <div class="topbar">
      <div class="brand">
        <div class="mark">HA</div>
        <div>
          <h1 class="title">HairAudit Report</h1>
          <div class="subtitle">Automated audit summary</div>
        </div>
      </div>

      <div class="meta">
        <div><b>Case:</b> <span class="mono">${esc(caseId)}</span></div>
        <div><b>Status:</b> ${esc(String(c.status ?? ""))}</div>
        <div><b>Created:</b> ${esc(created)}</div>
        <div><b>Generated:</b> ${esc(generated)}</div>
      </div>
    </div>

    <div class="section">
      <div class="sectionHead">
        <h2>Clinical Scorecard</h2>
        <div class="pillRow">
          <span class="pill">Grade: <b>${esc(String(grade))}</b></span>
          <span class="pill">Confidence: <b>${esc(String(conf))}</b></span>
          ${latestReport?.version
      ? `<span class="pill">Report: <b>v${esc(String(latestReport.version))}</b></span>`
      : `<span class="pill">Report: <b>—</b></span>`
    }
        </div>
      </div>

      <div class="scoreGrid">
        <div class="scoreCard">
          <div class="scoreLabel">Overall Score</div>
          <div class="scoreValue">${overall === null ? "—" : esc(String(overall))}</div>
          <div class="scoreSub">out of 100</div>
        </div>

        <div class="metricCard">
          <div class="metricTitle">Key Metrics</div>
          <div class="metricList">
            <div><span>Donor quality</span><b>${esc(String(metrics.donor_quality ?? "—"))}</b></div>
            <div><span>Survival estimate</span><b>${esc(String(metrics.graft_survival_estimate ?? "—"))}</b></div>
            <div><span>Transection risk</span><b>${esc(String(metrics.transection_risk ?? "—"))}</b></div>
            <div><span>Implant density</span><b>${esc(String(metrics.implantation_density ?? "—"))}</b></div>
            <div><span>Hairline naturalness</span><b>${esc(String(metrics.hairline_naturalness ?? "—"))}</b></div>
            <div><span>Donor scar visibility</span><b>${esc(String(metrics.donor_scar_visibility ?? "—"))}</b></div>
          </div>
        </div>
      </div>

      ${radarDataUri
      ? `
      <div style="margin-top: 12px;">
        <div style="font-size: 12px; font-weight: 800;">Audit Performance Signature</div>
        <div class="subtitle" style="margin-top: 4px;">“This visual signature represents structural balance across core transplant domains.”</div>
        <div class="radarWrap">
          <img class="radarImg" src="${radarDataUri}" alt="Radar chart" />
        </div>
      </div>
      `
      : ""
    }

      <div class="twoCol">
        <div class="listCard">
          <div class="listTitle">Highlights</div>
          ${highlights.length
      ? `<ul>${highlights.map((x: string) => `<li>${esc(String(x))}</li>`).join("")}</ul>`
      : `<div class="subtitle">No highlights captured yet.</div>`
    }
        </div>

        <div class="listCard">
          <div class="listTitle">Risks / Watch-outs</div>
          ${risks.length
      ? `<ul>${risks.map((x: string) => `<li>${esc(String(x))}</li>`).join("")}</ul>`
      : `<div class="subtitle">No risks flagged yet.</div>`
    }
        </div>
      </div>
    </div>

    ${areaScores.length > 0 || sectionScoresList.length > 0
      ? `
    <div class="section pageBreak">
      <h2>Score by Area</h2>
      <div class="subtitle" style="margin-top: 4px;">Your score for each capture point (out of 5, with level).</div>
      ${areaScores.length > 0
        ? `
      <div class="areaScoreGrid">
        ${areaScores
          .map(
            (a) => `
          <div class="areaScoreCard">
            <div class="areaScoreTitle">${esc(a.title)}</div>
            <div class="areaScoreBar">
              <div class="areaScoreFill ${a.level.toLowerCase()}" style="width: ${a.score}%;"></div>
            </div>
            <div class="areaScoreMeta">
              <span>${a.outOf5}/5</span>
              <b>${esc(a.level)} level</b>
            </div>
          </div>`
          )
          .join("")}
      </div>
        `
        : `<div class="subtitle" style="margin-top: 8px;">Domain-level scores not available for this report.</div>`
      }

      ${sectionScoresList.length > 0
        ? `
      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line);">
        <div style="font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 8px;">Detailed section scores</div>
        <div class="areaScoreGrid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));">
          ${sectionScoresList
            .map(
              (a) => `
            <div class="areaScoreCard">
              <div class="areaScoreTitle" style="font-size: 11px;">${esc(a.title)}</div>
              <div class="areaScoreBar">
                <div class="areaScoreFill ${a.level.toLowerCase()}" style="width: ${a.score}%;"></div>
              </div>
              <div class="areaScoreMeta">
                <span>${a.outOf5}/5</span>
                <b>${esc(a.level)}</b>
              </div>
            </div>`
            )
            .join("")}
        </div>
      </div>
        `
        : ""
      }
    </div>
      `
      : ""
    }

    ${narrativeFromForensic}
    ${photosBlock}

    ${doctorBlock}

    <div class="footer">
      HairAudit is an audit/reporting platform. This report is informational and not a medical diagnosis.
      ${debugFooter}
    </div>

  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
