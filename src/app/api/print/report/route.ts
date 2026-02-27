import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildReportViewModel, normalizeAuditMode, type AuditMode } from "@/lib/pdf/reportBuilder";
import { verifyRenderToken } from "@/lib/reports/internalRenderToken";
import { renderRadarChartPng } from "@/lib/pdf/renderRadarChart";
import { renderEliteReportHtml } from "@/lib/reports/EliteReportHtml";

type NumberRecord = Record<string, number>;

function toNumberRecord(x: unknown): NumberRecord {
  if (!x || typeof x !== "object") return {};
  const out: NumberRecord = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function clamp100(n: number) {
  return Math.max(0, Math.min(100, n));
}

function scoreToDisplay(s: number) {
  const outOf5 = Math.round((s / 100) * 5);
  const clamped = Math.max(0, Math.min(5, outOf5));
  const level = s >= 80 ? "High" : s >= 50 ? "Medium" : "Low";
  return { outOf5: clamped, level };
}

/* GET /api/print/report?caseId=...&auditMode=...&token=... */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const caseId = (url.searchParams.get("caseId") ?? "").trim();
  const rawAuditMode = url.searchParams.get("auditMode") ?? undefined;
  const token = (url.searchParams.get("token") ?? "").trim();

  if (!caseId) {
    return new NextResponse("Missing caseId", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const mode: AuditMode = normalizeAuditMode(rawAuditMode ?? undefined);

  const tokenSecret =
    String(process.env.REPORT_RENDER_TOKEN ?? "").trim() ||
    String(process.env.INTERNAL_API_KEY ?? "").trim() ||
    String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!tokenSecret) {
    return new NextResponse("Render token secret not configured", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const tokenPayload = token ? verifyRenderToken(token, tokenSecret) : null;
  const allowToken =
    !!tokenPayload &&
    tokenPayload.caseId === caseId &&
    normalizeAuditMode(tokenPayload.auditMode) === mode;

  if (!allowToken) {
    return new NextResponse("Invalid or missing render token", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const supabase = createSupabaseAdminClient();

  // Load case row
  const { data: c, error: caseErr } = await supabase
    .from("cases")
    .select("id, title, status, created_at, user_id, patient_id, doctor_id, clinic_id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr || !c) {
    return new NextResponse("Case not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  // Load uploads
  const { data: uploads, error: upErr } = await supabase
    .from("uploads")
    .select("id, type, storage_path, metadata, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (upErr) {
    console.error("uploads error:", upErr.message);
  }

  const bucket = process.env.CASE_FILES_BUCKET || "case-files";

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

      return {
        ...u,
        signedUrl: data?.signedUrl ?? null,
      };
    })
  );

  const photosByCategory: Record<string, { signedUrl: string | null; label: string }[]> = {};
  for (const u of signedImages) {
    const metaCat = (u as any)?.metadata?.category;
    const type = String((u as any)?.type ?? "");
    const typeCat = type.startsWith("patient_photo:") ? type.split(":")[1] : null;
    const cat = metaCat || typeCat || "uncategorized";
    const label =
      String((u as any)?.metadata?.label ?? "").trim() ||
      String((u as any)?.type ?? "photo");
    photosByCategory[cat] = photosByCategory[cat] || [];
    photosByCategory[cat].push({ signedUrl: (u as any).signedUrl ?? null, label });
  }

  // Load latest report summary
  const { data: latestReport } = await supabase
    .from("reports")
    .select("id, version, summary, created_at")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const summary = (latestReport?.summary ?? {}) as any;
  const forensic = (summary?.forensic_audit ?? summary?.forensic ?? null) as any;

  const overallFromForensic = Number.isFinite(Number(forensic?.overall_score))
    ? Number(forensic.overall_score)
    : null;
  const overallFromSummary = Number.isFinite(Number(summary?.overall_score ?? summary?.score))
    ? Number(summary?.overall_score ?? summary?.score)
    : null;
  const overall = overallFromForensic ?? overallFromSummary ?? null;

  const sectionScores = toNumberRecord(
    summary?.computed?.component_scores?.sections ??
      summary?.section_scores ??
      forensic?.section_scores ??
      null
  );

  const domainScores = toNumberRecord(
    summary?.computed?.component_scores?.domains ??
      summary?.area_scores ??
      null
  );

  const highlights = Array.isArray(summary.findings)
    ? summary.findings
    : Array.isArray(summary.highlights)
      ? summary.highlights
      : [];

  const risks = Array.isArray(summary.risks) ? summary.risks : [];

  const metrics = {
    donorQuality: String(
      summary.donor_quality ?? summary?.key_metrics?.donor_quality ?? "—"
    ),
    graftSurvival: String(
      summary.graft_survival_estimate ??
        summary?.key_metrics?.graft_survival_estimate ??
        "—"
    ),
    transectionRisk: String(summary?.key_metrics?.transection_risk ?? "—"),
    implantationDensity: String(
      summary?.key_metrics?.implantation_density ?? "—"
    ),
    hairlineNaturalness: String(
      summary?.key_metrics?.hairline_naturalness ?? "—"
    ),
    donorScarVisibility: String(
      summary?.key_metrics?.donor_scar_visibility ?? "—"
    ),
  };

  const domainOrder =
    (summary?.rubric_domains as { domain_id: string; title: string }[] | undefined) ??
    [];

  const areaDomains =
    domainOrder.length > 0
      ? domainOrder
          .filter((d) => domainScores[d.domain_id] != null)
          .map((d) => {
            const s = Number(domainScores[d.domain_id]);
            const { outOf5, level } = scoreToDisplay(s);
            return { title: d.title, score: s, outOf5, level };
          })
      : Object.entries(domainScores).map(([key, value]) => {
          const s = Number(value);
          const { outOf5, level } = scoreToDisplay(s);
          return { title: key.replace(/[._]/g, " "), score: s, outOf5, level };
        });

  const sectionTitles: Record<string, string> = {};
  for (const d of domainOrder) {
    for (const sec of (d as { sections?: { section_id: string; title: string }[] }).sections ??
      []) {
      sectionTitles[sec.section_id] = sec.title;
    }
  }

  const sectionScoreItems = Object.entries(sectionScores)
    .filter(([, v]) => v != null)
    .map(([id, v]) => {
      const score = clamp100(Number(v));
      const { outOf5, level } = scoreToDisplay(score);
      return {
        title: sectionTitles[id] ?? id.replace(/[._]/g, " "),
        score,
        outOf5,
        level,
      };
    });

  let radarDataUri: string | null = null;
  try {
    if (Object.keys(sectionScores).length > 0) {
      const conf =
        Number.isFinite(forensic?.confidence)
          ? Number(forensic.confidence)
          : Number.isFinite(summary?.confidence_score)
            ? Number(summary.confidence_score)
            : 0.45;
      const radar = await renderRadarChartPng({
        section_scores: sectionScores,
        overall_score: Number(overall ?? 0),
        confidence: conf,
      });
      radarDataUri = `data:image/png;base64,${radar.buffer.toString("base64")}`;
    }
  } catch (e) {
    console.error("renderRadarChartPng failed:", e);
  }

  const content = {
    caseId,
    version: Number(latestReport?.version ?? 1),
    generatedAt: latestReport?.created_at
      ? new Date(latestReport.created_at).toLocaleString()
      : new Date().toLocaleString(),
    auditMode: mode,
    score: overall,
    donorQuality: metrics.donorQuality,
    graftSurvival: metrics.graftSurvival,
    notes: typeof summary?.notes === "string" ? summary.notes : undefined,
    findings: highlights,
    areaScores: {
      domains: Object.keys(domainScores).length ? domainScores : undefined,
      sections: Object.keys(sectionScores).length ? sectionScores : undefined,
    },
    forensic: forensic
      ? {
          summary: typeof forensic?.summary === "string" ? forensic.summary : undefined,
          key_findings: Array.isArray(forensic?.key_findings)
            ? forensic.key_findings
            : undefined,
          red_flags: Array.isArray(forensic?.red_flags)
            ? forensic.red_flags
            : undefined,
          non_medical_disclaimer:
            typeof forensic?.non_medical_disclaimer === "string"
              ? forensic.non_medical_disclaimer
              : undefined,
        }
      : undefined,
    images: [],
  };

  const viewModel = buildReportViewModel({
    auditMode: mode,
    content,
    rawCase: c,
    uploads,
    aiResult: summary,
  });

  const grade =
    (summary?.computed?.grade as string | undefined) ??
    (summary?.grade as string | undefined) ??
    (overall !== null ? "Manual Score" : "Needs Review");

  const confidenceLabel =
    (summary?.computed?.confidence_label as string | undefined) ??
    (summary?.confidence_label as string | undefined) ??
    "medium";

  const pdfDebugEnabled = String(process.env.PDF_DEBUG ?? "").toLowerCase() === "true";
  const debugFooter =
    pdfDebugEnabled && latestReport
      ? `Renderer: playwright • Mode: ${mode} • Case: ${caseId} v${String(
          latestReport.version ?? 1
        )}`
      : undefined;

  const doctorAnswers = summary?.doctor_answers as Record<string, unknown> | undefined;
  let doctorBlockHtml: string | undefined;
  if (
    (viewModel.auditMode === "doctor" || viewModel.auditMode === "auditor") &&
    doctorAnswers &&
    typeof doctorAnswers === "object"
  ) {
    const procLabels: Record<string, string> = {
      fue_manual: "FUE (Manual)",
      fue_motorized: "FUE (Motorized)",
      fue_robotic: "FUE (Robotic)",
      fut: "FUT",
      combined: "Combined FUT + FUE",
    };
    const procedureKey = String(doctorAnswers.procedureType ?? "");
    const procedure =
      procLabels[procedureKey] ??
      (doctorAnswers.procedureType as string | undefined) ??
      "—";

    doctorBlockHtml = `
    <div class="section">
      <h2>Doctor / Clinic Submission</h2>
      <div class="metricList">
        <div><span>Procedure</span><b>${procedure}</b></div>
        <div><span>Grafts extracted</span><b>${String(
          (doctorAnswers as any).totalGraftsExtracted ??
            (doctorAnswers as any).grafts_extracted ??
            "—"
        )}</b></div>
        <div><span>Grafts implanted</span><b>${String(
          (doctorAnswers as any).totalGraftsImplanted ??
            (doctorAnswers as any).grafts_implanted ??
            "—"
        )}</b></div>
        <div><span>Extraction by</span><b>${String(
          (doctorAnswers as any).extractionPerformedBy ??
            (doctorAnswers as any).extraction_performed_by ??
            "—"
        )}</b></div>
        <div><span>Implantation by</span><b>${String(
          (doctorAnswers as any).implantationPerformedBy ??
            (doctorAnswers as any).implantation_performed_by ??
            "—"
        )}</b></div>
      </div>
    </div>`;
  }

  const eliteVm = {
    viewModel,
    caseId,
    caseStatus: c.status,
    caseCreatedAt: new Date(c.created_at).toLocaleString(),
    generatedAt: content.generatedAt,
    version: content.version,
    grade,
    confidenceLabel,
    metrics,
    areaDomains,
    sectionScores: sectionScoreItems,
    highlights,
    risks,
    radarDataUri,
    photosByCategory,
    doctorBlockHtml,
    debugFooter,
  };

  const html = renderEliteReportHtml(eliteVm);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Report-Template": "elite",
      "X-Audit-Mode": mode,
    },
  });
}

