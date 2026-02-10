import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import rubric from "@/lib/audit/rubrics/hairaudit_clinical_v1.json";
import { scoreAudit } from "@/lib/audit/score";

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

/* GET /api/print/report?caseId=...&token=... */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId") ?? "";
  const token = url.searchParams.get("token") ?? "";

  const expected = process.env.REPORT_RENDER_TOKEN ?? "local";
  if (token !== expected) return new NextResponse("Unauthorized", { status: 401 });
  if (!caseId) return new NextResponse("Missing caseId", { status: 400 });

  const supabase = supabaseAdmin();

  /* Load case */
  const { data: c, error: caseErr } = await supabase
    .from("cases")
    .select("id, title, status, created_at")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr || !c) return new NextResponse("Case not found", { status: 404 });

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

  // Component scores (for later UI usage)
  const compDomains = computed?.component_scores?.domains ?? {};
  const compSections = computed?.component_scores?.sections ?? {};

  // Highlights/Risks
  const highlights = Array.isArray(summary.findings)
    ? summary.findings
    : Array.isArray(summary.highlights)
      ? summary.highlights
      : [];

  const risks = Array.isArray(summary.risks) ? summary.risks : [];

  const created = new Date(c.created_at).toLocaleString();
  const generated = new Date().toLocaleString();


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

    .footer {
      margin-top: 18px;
      font-size: 10px;
      color: var(--muted);
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }

    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
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

    <div class="footer">
      HairAudit is an audit/reporting platform. This report is informational and not a medical diagnosis.
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
