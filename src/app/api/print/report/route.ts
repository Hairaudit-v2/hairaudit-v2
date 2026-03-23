import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildReportViewModel, normalizeAuditMode, type AuditMode, type AuditReportContent } from "@/lib/pdf/reportBuilder";
import { verifyRenderToken } from "@/lib/reports/internalRenderToken";
import { renderEliteReportHtml } from "@/lib/reports/EliteReportHtml";
import rubric from "@/lib/audit/rubrics/hairaudit_clinical_v1.json";
import { buildElitePrintPhotosByCategory } from "@/lib/pdf/elitePrintPhotoPipeline";
import {
  deriveDomainScoresFromSections,
  deriveDomainScoresHeuristic,
  evaluatePdfReadiness,
  toNumberRecord,
} from "@/lib/reports/pdfReadiness";
import { loadLatestEvidenceManifest } from "@/lib/evidence/prepareCaseEvidence";
import { pdfEnvConfig } from "@/lib/pdf/pdfEnvConfig";
import { evaluateEvidence, type EvidenceEvaluationResult } from "@/lib/evidence/evidenceEvaluator";
import { enrichKeyMetricsAfterNormalize } from "@/lib/evidence/evidenceMissingCopy";

function clamp100(n: number) {
  return Math.max(0, Math.min(100, n));
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

function scoreToDisplay(s: number) {
  const outOf5 = Math.round((s / 100) * 5);
  const clamped = Math.max(0, Math.min(5, outOf5));
  const level = s >= 80 ? "High" : s >= 50 ? "Medium" : "Low";
  return { outOf5: clamped, level };
}

function humanizeKey(s: string): string {
  const t = String(s ?? "")
    .trim()
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .replace(/\s+/g, " ");
  if (!t) return "";
  return t.replace(/\b\w/g, (m) => m.toUpperCase());
}

function normalizeMetric(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "—" || text.toLowerCase() === "unknown" || text.toLowerCase() === "n/a") {
    return "Insufficient evidence";
  }
  return text;
}

const RADAR_AXIS_LABELS: Record<string, string> = {
  donor_management: "Donor Management",
  extraction_quality: "Extraction Quality",
  graft_handling_and_viability: "Graft Handling",
  recipient_placement: "Recipient Implantation",
  density_distribution: "Density Distribution",
  hairline_design: "Hairline Design",
  post_op_course_and_aftercare: "Safety & Aftercare",
  naturalness_and_aesthetics: "Naturalness",
  complications_and_risks: "Complications & Risks",
};

const RADAR_AXIS_ORDER = [
  "donor_management",
  "extraction_quality",
  "graft_handling_and_viability",
  "recipient_placement",
  "density_distribution",
  "hairline_design",
  "post_op_course_and_aftercare",
  "naturalness_and_aesthetics",
  "complications_and_risks",
];

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
  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const manifest = await loadLatestEvidenceManifest({
    supabase: supabase as any,
    caseId,
    status: "ready",
  });

  const { photosByCategory, stats: printPhotoStats } = await buildElitePrintPhotosByCategory({
    supabase: supabase as any,
    bucket,
    caseId,
    manifest: manifest ?? null,
  });

  const pdfInstrumentation = pdfEnvConfig.isInstrumentationEnabled();
  if (pdfInstrumentation) {
    console.info("[pdf-print]", {
      caseId,
      imageCount: printPhotoStats.imageCount,
      sourceBytesTotal: printPhotoStats.sourceBytesTotal,
      optimizedBytesTotal: printPhotoStats.optimizedBytesTotal,
      fallbackToSignedUrlCount: printPhotoStats.fallbackToSignedUrlCount,
      imagesSkippedReencode: printPhotoStats.imagesSkippedReencode,
      imagesProcessedFull: printPhotoStats.imagesProcessedFull,
      imagesTruncated: printPhotoStats.imagesTruncated,
    });
  }

  // Load latest report summary
  const { data: latestReport } = await supabase
    .from("reports")
    .select("id, version, summary, created_at, status")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const summary = (latestReport?.summary ?? {}) as any;
  const readiness = evaluatePdfReadiness({
    caseStatus: c.status,
    reportStatus: (latestReport as { status?: string | null } | null)?.status ?? null,
    summary,
  });
  if (!readiness.ready) {
    return new NextResponse(`AUDIT_NOT_READY: ${readiness.reason ?? "audit summary is incomplete"}`, {
      status: 409,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Report-Status": "audit-not-ready",
      },
    });
  }
  const forensic = (summary?.forensic_audit ?? summary?.forensic ?? null) as any;

  const overallFromForensic = Number.isFinite(Number(forensic?.overall_score))
    ? Number(forensic.overall_score)
    : null;
  const overallFromSummary = Number.isFinite(Number(summary?.overall_score ?? summary?.score))
    ? Number(summary?.overall_score ?? summary?.score)
    : null;
  const overall = overallFromForensic ?? overallFromSummary ?? null;

  const forensicSectionScores = toNumberRecord(forensic?.section_scores ?? null);
  const computedSectionScores = toNumberRecord(summary?.computed?.component_scores?.sections ?? null);
  const summarySectionScores = toNumberRecord(summary?.section_scores ?? null);
  const sectionScores = toNumberRecord(
    summary?.computed?.component_scores?.sections ??
      summary?.section_scores ??
      forensic?.section_scores ??
      null
  );

  const domainScoresBase = toNumberRecord(
    summary?.computed?.component_scores?.domains ??
      summary?.area_scores ??
      null
  );
  const domainOrder = (
    summary?.rubric_domains as { domain_id: string; title: string; sections?: { section_id: string; title: string }[] }[] | undefined
  ) ?? ((rubric as { domains?: { domain_id: string; title: string; sections?: { section_id: string; title: string }[] }[] }).domains ?? []);
  const domainScores =
    Object.keys(domainScoresBase).length > 0
      ? domainScoresBase
      : deriveDomainScoresFromSections(sectionScores, domainOrder as Array<{ domain_id: string; sections?: Array<{ section_id: string }> }>);
  const effectiveDomainScores =
    Object.keys(domainScores).length > 0 ? domainScores : deriveDomainScoresHeuristic(sectionScores);

  const highlights = Array.isArray(summary.findings)
    ? summary.findings
    : Array.isArray(summary.highlights)
      ? summary.highlights
      : [];

  const risks = Array.isArray(summary.risks) ? summary.risks : [];

  const metricsRaw = {
    donorQuality: normalizeMetric(
      summary.donor_quality ?? summary?.key_metrics?.donor_quality
    ),
    graftSurvival: normalizeMetric(
      summary.graft_survival_estimate ??
        summary?.key_metrics?.graft_survival_estimate
    ),
    transectionRisk: normalizeMetric(summary?.key_metrics?.transection_risk),
    implantationDensity: normalizeMetric(
      summary?.key_metrics?.implantation_density
    ),
    hairlineNaturalness: normalizeMetric(
      summary?.key_metrics?.hairline_naturalness
    ),
    donorScarVisibility: normalizeMetric(
      summary?.key_metrics?.donor_scar_visibility
    ),
  };

  let evidenceEvaluation: EvidenceEvaluationResult | null = null;
  try {
    const { data: uploadRows, error: upEvErr } = await supabase
      .from("uploads")
      .select("type, metadata")
      .eq("case_id", caseId);
    if (!upEvErr && uploadRows) {
      evidenceEvaluation = evaluateEvidence(uploadRows as Parameters<typeof evaluateEvidence>[0]);
    }
  } catch {
    evidenceEvaluation = null;
  }

  const metrics = enrichKeyMetricsAfterNormalize(metricsRaw, evidenceEvaluation);

  const areaDomains =
    domainOrder.length > 0
      ? domainOrder
          .filter((d) => effectiveDomainScores[d.domain_id] != null)
          .map((d) => {
            const s = Number(effectiveDomainScores[d.domain_id]);
            const { outOf5, level } = scoreToDisplay(s);
            return { title: d.title, score: s, outOf5, level };
          })
      : Object.entries(effectiveDomainScores).map(([key, value]) => {
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

  const radarScoresBase =
    Object.keys(forensicSectionScores).length > 0
      ? forensicSectionScores
      : Object.keys(computedSectionScores).length > 0
        ? computedSectionScores
        : Object.keys(summarySectionScores).length > 0
          ? summarySectionScores
          : null;

  const radarScores =
    radarScoresBase && Object.keys(radarScoresBase).length > 0
      ? radarScoresBase
      : Object.keys(effectiveDomainScores).length
        ? effectiveDomainScores
        : null;

  const radarConfidence = clamp01(
    Number.isFinite(Number(forensic?.confidence))
      ? Number(forensic.confidence)
      : Number.isFinite(Number(summary?.confidence_score))
        ? Number(summary.confidence_score)
        : 0.45
  );

  const radarOverall = clamp100(Number(overall ?? 0));

  let radar: { labels: string[]; values: number[]; overall: number; confidence: number } | undefined;
  try {
    if (radarScores && Object.keys(radarScores).length > 0) {
      const keysAvailable = new Set(Object.keys(radarScores));

      // Stable order: rubric section order (if present) → known axis order → remaining keys.
      const rubricSectionKeys: string[] = [];
      for (const d of domainOrder) {
        for (const sec of (d as { sections?: { section_id: string }[] }).sections ?? []) {
          if (sec?.section_id) rubricSectionKeys.push(sec.section_id);
        }
      }

      const orderedKeys = [
        ...rubricSectionKeys,
        ...RADAR_AXIS_ORDER,
        ...Array.from(keysAvailable).sort((a, b) => a.localeCompare(b)),
      ]
        .filter((k, i, arr) => arr.indexOf(k) === i)
        .filter((k) => keysAvailable.has(k));

      const maxAxes = orderedKeys.length > 10 ? 8 : 10;
      const picked = orderedKeys.slice(0, maxAxes);

      const labels = picked.map((k) => sectionTitles[k] ?? RADAR_AXIS_LABELS[k] ?? humanizeKey(k));
      const values = picked.map((k) => clamp100(Number((radarScores as any)[k])));

      if (labels.length >= 3) {
        radar = { labels, values, overall: radarOverall, confidence: radarConfidence };
      }
    }
  } catch {
    radar = undefined;
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

  // Optional feature: Graft Integrity must never break report rendering.
  let graftIntegrity: NonNullable<AuditReportContent["graftIntegrity"]> | undefined = undefined;
  try {
    const giiRes = await supabase
      .from("graft_integrity_estimates")
      .select(
        "claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, confidence, confidence_label, limitations, auditor_status"
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (giiRes.error) throw giiRes.error;
    const gii = giiRes.data as any;
    graftIntegrity = gii != null
      ? {
          auditor_status: (String(gii?.auditor_status ?? "pending") ?? "pending") as "approved" | "pending" | "needs_more_evidence" | "rejected",
          claimed_grafts: Number.isFinite(Number(gii?.claimed_grafts)) ? Number(gii.claimed_grafts) : null,
          estimated_extracted: {
            min: Number.isFinite(Number(gii?.estimated_extracted_min)) ? Number(gii.estimated_extracted_min) : null,
            max: Number.isFinite(Number(gii?.estimated_extracted_max)) ? Number(gii.estimated_extracted_max) : null,
          },
          estimated_implanted: {
            min: Number.isFinite(Number(gii?.estimated_implanted_min)) ? Number(gii.estimated_implanted_min) : null,
            max: Number.isFinite(Number(gii?.estimated_implanted_max)) ? Number(gii.estimated_implanted_max) : null,
          },
          variance_claimed_vs_implanted_pct: {
            min: Number.isFinite(Number(gii?.variance_claimed_vs_implanted_min_pct)) ? Number(gii.variance_claimed_vs_implanted_min_pct) : null,
            max: Number.isFinite(Number(gii?.variance_claimed_vs_implanted_max_pct)) ? Number(gii.variance_claimed_vs_implanted_max_pct) : null,
          },
          confidence: clamp01(Number(gii?.confidence ?? 0.45)),
          confidence_label: (["low", "medium", "high"].includes(String(gii?.confidence_label ?? "")) ? gii.confidence_label : "medium") as "low" | "medium" | "high",
          limitations: Array.isArray(gii?.limitations) ? gii.limitations : [],
        }
      : undefined;
  } catch {
    graftIntegrity = undefined;
  }

  const summaryEvCov = Number((summary as { evidenceCoverageScore?: unknown })?.evidenceCoverageScore);
  const evidenceCoverageScoreForReport =
    Number.isFinite(summaryEvCov) && summaryEvCov >= 0
      ? clamp100(Math.round(summaryEvCov))
      : evidenceEvaluation != null
        ? evidenceEvaluation.overallCoverageScore
        : null;

  const content = {
    caseId,
    version: Number(latestReport?.version ?? 1),
    generatedAt: latestReport?.created_at
      ? new Date(latestReport.created_at).toLocaleString()
      : new Date().toLocaleString(),
    auditMode: mode,
    score: overall,
    evidenceCoverageScore: evidenceCoverageScoreForReport,
    donorQuality: metrics.donorQuality,
    graftSurvival: metrics.graftSurvival,
    notes: typeof summary?.notes === "string" ? summary.notes : undefined,
    findings: highlights,
    areaScores: {
      domains: Object.keys(effectiveDomainScores).length ? effectiveDomainScores : undefined,
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
    graftIntegrity: graftIntegrity ?? undefined,
    images: [],
  };

  const viewModel = buildReportViewModel({
    auditMode: mode,
    content,
    rawCase: c,
    uploads: [],
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

  const pdfDebugEnabled = pdfEnvConfig.isPdfDebugEnabled();
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
    evidenceEvaluation,
    areaDomains,
    sectionScores: sectionScoreItems,
    highlights,
    risks,
    radar,
    photosByCategory,
    doctorBlockHtml,
    debugFooter,
  };

  const html = renderEliteReportHtml(eliteVm);
  const htmlUtf8Bytes = Buffer.byteLength(html, "utf8");

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Report-Template": "elite",
      "X-Audit-Mode": mode,
      "X-Pdf-Print-Html-Bytes": String(htmlUtf8Bytes),
      "X-Pdf-Print-Image-Count": String(printPhotoStats.imageCount),
      "X-Pdf-Print-Source-Bytes": String(printPhotoStats.sourceBytesTotal),
      "X-Pdf-Print-Optimized-Bytes": String(printPhotoStats.optimizedBytesTotal),
      "X-Pdf-Print-Fallback-Count": String(printPhotoStats.fallbackToSignedUrlCount),
      "X-Pdf-Print-Skipped-Reencode": String(printPhotoStats.imagesSkippedReencode),
      "X-Pdf-Print-Processed-Full": String(printPhotoStats.imagesProcessedFull),
      "X-Pdf-Print-Truncated": String(printPhotoStats.imagesTruncated),
    },
  });
}

