import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildReportViewModel, normalizeAuditMode, type AuditMode, type AuditReportContent } from "@/lib/pdf/reportBuilder";
import { verifyRenderToken } from "@/lib/reports/internalRenderToken";
import { renderEliteReportHtml } from "@/lib/reports/EliteReportHtml";
import { renderPostSurgeryAuditReportHtml } from "@/lib/reports/PostSurgeryAuditReportHtml";
import { renderPreSurgeryPlanningReportHtml } from "@/lib/reports/PreSurgeryPlanningReportHtml";
import {
  resolvePostSurgeryAuditReport,
  shouldUsePostSurgeryReportTemplate,
} from "@/lib/reports/postSurgeryAuditReport";
import {
  resolvePreSurgeryPlanningReport,
  resolvePatientReportTemplateName,
  shouldUsePreSurgeryReportTemplate,
} from "@/lib/reports/preSurgeryPlanningReport";
import {
  extractAssessmentTypeFromSummary,
  resolveSurgeryDayProjectionReport,
  shouldUseSurgeryDayProjectionReportTemplate,
} from "@/lib/reports/surgeryDayProjectionReport";
import { renderSurgeryDayProjectionReportHtml } from "@/lib/reports/SurgeryDayProjectionReportHtml";
import {
  LONGITUDINAL_PROJECTION_TABLES,
  resolveLongitudinalProjectionReviewReport,
  shouldUseLongitudinalProjectionReviewTemplate,
} from "@/lib/reports/longitudinalProjectionReview";
import { renderLongitudinalProjectionReviewHtml } from "@/lib/reports/LongitudinalProjectionReviewHtml";
import type { ForensicAuditLike } from "@/lib/projection/surgeryDayObservedFeatures";
import {
  HAIRAUDIT_PROJECTION_SNAPSHOTS_TABLE,
} from "@/lib/projection/projectionSnapshotPersist.server";
import { validateCaseOwnership } from "@/lib/projection/projectionSnapshotValidate";
import type { ProjectionSnapshot } from "@/lib/projection/projectionSnapshotTypes";
import type { ProjectionObservationSnapshot } from "@/lib/projection/projectionObservationTypes";
import type { ProjectionComparisonSnapshot } from "@/lib/projection/projectionComparisonTypes";
import type {
  LongitudinalOutcomeObservation,
  ProjectionObservedComparison,
  SurgeryDayProcedureReconstruction,
  SurgeryDayProjectedOutcome,
} from "@/lib/projection/types";
import {
  buildPostSurgeryReportHtmlLabelsEn,
  buildPostSurgeryClinicalEvidenceGalleryLabelsEn,
  POST_SURGERY_OUTCOME_LABELS_EN,
  POST_SURGERY_REPAIR_LABELS_EN,
} from "@/lib/reports/postSurgeryReportLabels";
import {
  buildPreSurgeryReportHtmlLabelsEn,
  buildPreSurgeryClinicalEvidenceGalleryLabelsEn,
  PRE_SURGERY_OUTCOME_LABELS_EN,
} from "@/lib/reports/preSurgeryReportLabels";
import rubric from "@/lib/audit/rubrics/hairaudit_clinical_v1.json";
import { buildElitePrintPhotosByCategorySignedUrl } from "@/lib/pdf/elitePrintPhotoSignedUrlPipeline";
import {
  deriveDomainScoresFromSections,
  deriveDomainScoresHeuristic,
  evaluatePdfReadiness,
  toNumberRecord,
} from "@/lib/reports/pdfReadiness";
import { loadLatestEvidenceManifest } from "@/lib/evidence/evidenceManifest";
import { pdfEnvConfig } from "@/lib/pdf/pdfEnvConfig";
import { evaluateEvidence, type EvidenceEvaluationResult } from "@/lib/evidence/evidenceEvaluator";
import {
  buildEvidenceIntelligencePayload,
  parseEvidenceIntelligencePayload,
} from "@/lib/evidence/evidenceIntelligencePayload";
import { enrichKeyMetricsAfterNormalize } from "@/lib/evidence/evidenceMissingCopy";
import { getCaseFilesBucketNameForReadOnlyUse } from "@/lib/hairaudit/uploadStorage";
import { requireReportRenderTokenSecret } from "@/lib/security/secrets";
import { resolvePdfReviewRisks } from "@/lib/reports/patientPdfReviewAreas";
import { resolvePdfReportTemplateHeader } from "@/lib/pdf/normalizeReportTemplateForPdf";
import {
  buildClinicalHistorySnapshot,
  loadCaseClinicalHistory,
} from "@/lib/hairaudit/clinical-history/clinicalHistory.server";

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

  let tokenSecret: string;
  try {
    tokenSecret = requireReportRenderTokenSecret();
  } catch {
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
    .select("id, title, status, created_at, user_id, patient_id, doctor_id, clinic_id, patient_review_pathway")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr || !c) {
    return new NextResponse("Case not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const bucket = getCaseFilesBucketNameForReadOnlyUse();
  const manifest = await loadLatestEvidenceManifest({
    supabase: supabase as any,
    caseId,
    status: "ready",
  });

  const { photosByCategory, stats: printPhotoStats } = await buildElitePrintPhotosByCategorySignedUrl({
    supabase: supabase as any,
    bucket,
    caseId,
    manifest: manifest ?? null,
    maxImagesPerSection: pdfEnvConfig.getMaxImagesPerSection(),
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

  const risks = resolvePdfReviewRisks(summary as Record<string, unknown>, mode);

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
  let uploadRowsForEvidence: Parameters<typeof evaluateEvidence>[0] | null = null;
  try {
    const { data: uploadRows, error: upEvErr } = await supabase
      .from("uploads")
      .select("type, metadata")
      .eq("case_id", caseId);
    if (!upEvErr && uploadRows) {
      uploadRowsForEvidence = uploadRows as Parameters<typeof evaluateEvidence>[0];
      evidenceEvaluation = evaluateEvidence(uploadRowsForEvidence);
    }
  } catch {
    evidenceEvaluation = null;
  }

  const evidenceIntelligence =
    parseEvidenceIntelligencePayload(
      (summary as { evidenceIntelligence?: unknown } | null)?.evidenceIntelligence
    ) ??
    (uploadRowsForEvidence?.length ? buildEvidenceIntelligencePayload(uploadRowsForEvidence) : null);

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
    evidenceIntelligence: evidenceIntelligence ?? undefined,
    areaDomains,
    sectionScores: sectionScoreItems,
    highlights,
    risks,
    radar,
    photosByCategory,
    doctorBlockHtml,
    debugFooter,
  };

  let clinicalHistorySnapshot = null;
  if (
    shouldUsePostSurgeryReportTemplate(c.patient_review_pathway, mode) ||
    shouldUsePreSurgeryReportTemplate(c.patient_review_pathway, mode)
  ) {
    const clinicalHistoryRow = await loadCaseClinicalHistory(caseId, supabase as any);
    clinicalHistorySnapshot = clinicalHistoryRow
      ? buildClinicalHistorySnapshot(clinicalHistoryRow)
      : null;
  }

  const assessmentTypeFromQuery = (url.searchParams.get("assessmentType") ?? "").trim() || null;
  const assessmentType =
    assessmentTypeFromQuery || extractAssessmentTypeFromSummary(summary) || null;

  // HA-PROJECTION-1D — optional frozen snapshot for historical re-render.
  const projectionSnapshotIdParam =
    (url.searchParams.get("projectionSnapshotId") ?? "").trim() || null;
  const observationSnapshotIdParam =
    (url.searchParams.get("observationSnapshotId") ?? "").trim() || null;
  const comparisonSnapshotIdParam =
    (url.searchParams.get("comparisonSnapshotId") ?? "").trim() || null;
  let persistedProjectionSnapshot: {
    projectionId: string;
    reconstruction: SurgeryDayProcedureReconstruction;
    projectedOutcome: SurgeryDayProjectedOutcome;
  } | null = null;
  if (projectionSnapshotIdParam && shouldUseSurgeryDayProjectionReportTemplate(assessmentType, mode)) {
    try {
      const { data: snapRow } = await supabase
        .from(HAIRAUDIT_PROJECTION_SNAPSHOTS_TABLE)
        .select(
          "id, case_id, patient_id, reconstruction_snapshot, projection_snapshot"
        )
        .eq("id", projectionSnapshotIdParam)
        .eq("case_id", caseId)
        .maybeSingle();
      if (
        snapRow &&
        snapRow.reconstruction_snapshot &&
        snapRow.projection_snapshot &&
        // Ownership: require case patient/user match; fail closed when ownership metadata is missing
        validateCaseOwnership({
          caseId,
          patientId: String(snapRow.patient_id ?? ""),
          caseRow: {
            id: caseId,
            patient_id: c.patient_id ?? null,
            user_id: c.user_id ?? null,
          },
        }).ok
      ) {
        persistedProjectionSnapshot = {
          projectionId: String(snapRow.id),
          reconstruction: snapRow.reconstruction_snapshot as SurgeryDayProcedureReconstruction,
          projectedOutcome: snapRow.projection_snapshot as SurgeryDayProjectedOutcome,
        };
      }
    } catch {
      // Table may be absent in older environments; fall back to on-demand 1A→1B.
    }
  }

  // HA-PROJECTION-1G — load frozen 1D+1E+1F for longitudinal review (fail closed; no latest auto-pick).
  let longitudinalFrozen: {
    projection: ProjectionSnapshot;
    observation: ProjectionObservationSnapshot;
    comparison: ProjectionComparisonSnapshot;
  } | null = null;
  if (shouldUseLongitudinalProjectionReviewTemplate(assessmentType, mode)) {
    const summaryObj = (summary && typeof summary === "object" ? summary : {}) as Record<
      string,
      unknown
    >;
    const embedded =
      (summaryObj.longitudinal_projection_review as Record<string, unknown> | undefined) ??
      (summaryObj.longitudinalProjectionReview as Record<string, unknown> | undefined) ??
      null;

    const embeddedProjection = embedded?.projection as ProjectionSnapshot | undefined;
    const embeddedObservation = embedded?.observation as ProjectionObservationSnapshot | undefined;
    const embeddedComparison = embedded?.comparison as ProjectionComparisonSnapshot | undefined;

    if (
      embeddedProjection?.id &&
      embeddedObservation?.id &&
      embeddedComparison?.id &&
      (!projectionSnapshotIdParam || embeddedProjection.id === projectionSnapshotIdParam) &&
      (!observationSnapshotIdParam || embeddedObservation.id === observationSnapshotIdParam) &&
      (!comparisonSnapshotIdParam || embeddedComparison.id === comparisonSnapshotIdParam)
    ) {
      longitudinalFrozen = {
        projection: embeddedProjection,
        observation: embeddedObservation,
        comparison: embeddedComparison,
      };
    } else if (
      projectionSnapshotIdParam &&
      observationSnapshotIdParam &&
      comparisonSnapshotIdParam
    ) {
      try {
        const ownershipOk = (patientId: string) =>
          validateCaseOwnership({
            caseId,
            patientId,
            caseRow: {
              id: caseId,
              patient_id: c.patient_id ?? null,
              user_id: c.user_id ?? null,
            },
          }).ok;

        const { data: projRow } = await supabase
          .from(HAIRAUDIT_PROJECTION_SNAPSHOTS_TABLE)
          .select("*")
          .eq("id", projectionSnapshotIdParam)
          .eq("case_id", caseId)
          .maybeSingle();
        const { data: obsRow } = await supabase
          .from(LONGITUDINAL_PROJECTION_TABLES.observations)
          .select("*")
          .eq("id", observationSnapshotIdParam)
          .eq("case_id", caseId)
          .maybeSingle();
        const { data: cmpRow } = await supabase
          .from(LONGITUDINAL_PROJECTION_TABLES.comparisons)
          .select("*")
          .eq("id", comparisonSnapshotIdParam)
          .eq("case_id", caseId)
          .maybeSingle();

        if (
          projRow &&
          obsRow &&
          cmpRow &&
          ownershipOk(String(projRow.patient_id ?? "")) &&
          ownershipOk(String(obsRow.patient_id ?? "")) &&
          ownershipOk(String(cmpRow.patient_id ?? ""))
        ) {
          longitudinalFrozen = {
            projection: {
              id: String(projRow.id),
              caseId: String(projRow.case_id),
              patientId: String(projRow.patient_id),
              procedureId: String(projRow.procedure_id ?? projRow.case_id),
              projectionType: projRow.projection_type,
              projectionStatus: projRow.projection_status,
              reconstructionVersion: String(projRow.reconstruction_version),
              projectionEngineVersion: String(projRow.projection_engine_version),
              snapshotSchemaVersion: String(projRow.snapshot_schema_version),
              reportTemplateVersion: Number(projRow.report_template_version ?? 1),
              reconstructionInputChecksum: String(projRow.reconstruction_input_checksum ?? ""),
              projectionInputChecksum: String(projRow.projection_input_checksum ?? ""),
              projectionOutputChecksum: String(projRow.projection_output_checksum ?? ""),
              reconstructionSnapshot:
                projRow.reconstruction_snapshot as SurgeryDayProcedureReconstruction,
              projectionSnapshot: projRow.projection_snapshot as SurgeryDayProjectedOutcome,
              confidenceSummary: (projRow.confidence_summary ?? {}) as ProjectionSnapshot["confidenceSummary"],
              evidenceSummary: (projRow.evidence_summary ?? {}) as ProjectionSnapshot["evidenceSummary"],
              createdAt: String(projRow.created_at),
              createdBy: projRow.created_by ?? null,
              supersedesProjectionId: projRow.supersedes_projection_id ?? null,
              supersededByProjectionId: projRow.superseded_by_projection_id ?? null,
              lineageRootId: String(projRow.lineage_root_id ?? projRow.id),
              supersessionReasonCode: projRow.supersession_reason_code ?? null,
              sourceReportId: projRow.source_report_id ?? null,
              sourceAssessmentId: projRow.source_assessment_id ?? null,
            },
            observation: {
              id: String(obsRow.id),
              projectionSnapshotId: String(obsRow.projection_snapshot_id),
              caseId: String(obsRow.case_id),
              patientId: String(obsRow.patient_id),
              stage: obsRow.stage,
              observedAt: String(obsRow.observed_at),
              observationStatus: obsRow.observation_status,
              observationSchemaVersion: String(obsRow.observation_schema_version),
              observationLineageVersion: String(obsRow.observation_lineage_version),
              observationChecksum: String(obsRow.observation_checksum),
              observationPayload: obsRow.observation_payload as LongitudinalOutcomeObservation,
              createdAt: String(obsRow.created_at),
              createdBy: obsRow.created_by ?? null,
              supersedesObservationId: obsRow.supersedes_observation_id ?? null,
              supersededByObservationId: obsRow.superseded_by_observation_id ?? null,
              supersessionReasonCode: obsRow.supersession_reason_code ?? null,
              sourceReportId: obsRow.source_report_id ?? null,
              sourceAuditId: obsRow.source_audit_id ?? null,
            },
            comparison: {
              id: String(cmpRow.id),
              projectionSnapshotId: String(cmpRow.projection_snapshot_id),
              observationSnapshotId: String(cmpRow.observation_snapshot_id),
              caseId: String(cmpRow.case_id),
              patientId: String(cmpRow.patient_id),
              stage: cmpRow.stage,
              comparisonStatus: cmpRow.comparison_status,
              comparisonSchemaVersion: String(cmpRow.comparison_schema_version),
              projectionSchemaVersion: String(cmpRow.projection_schema_version),
              observationSchemaVersion: String(cmpRow.observation_schema_version),
              comparisonChecksum: String(cmpRow.comparison_checksum),
              comparisonPayload: cmpRow.comparison_payload as ProjectionObservedComparison,
              createdAt: String(cmpRow.created_at),
              createdBy: cmpRow.created_by ?? null,
              supersedesComparisonId: cmpRow.supersedes_comparison_id ?? null,
              supersededByComparisonId: cmpRow.superseded_by_comparison_id ?? null,
              supersessionReasonCode: cmpRow.supersession_reason_code ?? null,
            },
          };
        }
      } catch {
        // Tables may be absent; fail closed below when longitudinalFrozen remains null.
      }
    }
  }

  const html = (() => {
    // HA-PROJECTION-1G — longitudinal projection review (patient mode only).
    // Precedence over 1C / pathway templates when assessmentType is explicit.
    if (shouldUseLongitudinalProjectionReviewTemplate(assessmentType, mode)) {
      if (!longitudinalFrozen) {
        return null;
      }
      const longitudinalResolved = resolveLongitudinalProjectionReviewReport({
        projection: longitudinalFrozen.projection,
        observation: longitudinalFrozen.observation,
        comparison: longitudinalFrozen.comparison,
        caseId,
        reportVersion: content.version,
        generatedAt: content.generatedAt,
        photosByCategory,
      });
      if (!longitudinalResolved.ok || !longitudinalResolved.report) {
        return null;
      }
      return renderLongitudinalProjectionReviewHtml({
        report: longitudinalResolved.report,
        caseId,
        generatedAtDisplay: content.generatedAt,
      });
    }
    // HA-PROJECTION-1C — surgery-day projection presentation (patient mode only).
    // Precedence over pathway templates when assessmentType is explicit.
    if (shouldUseSurgeryDayProjectionReportTemplate(assessmentType, mode)) {
      const projectionResolved = resolveSurgeryDayProjectionReport({
        summary,
        caseId,
        reportVersion: content.version,
        generatedAt: content.generatedAt,
        photosByCategory,
        persistedSnapshot: persistedProjectionSnapshot,
        reconstructionInput: uploadRowsForEvidence
          ? {
              uploads: uploadRowsForEvidence.map((u) => ({
                type: (u as { type?: string | null }).type ?? null,
                metadata: (u as { metadata?: Record<string, unknown> | null }).metadata ?? null,
              })),
              evidenceContext: {
                pathway:
                  c.patient_review_pathway === "pre_surgery" ||
                  c.patient_review_pathway === "post_surgery"
                    ? c.patient_review_pathway
                    : null,
              },
              procedureSources: {
                clinicAnswers:
                  (summary as { clinic_answers?: Record<string, unknown> | null }).clinic_answers ??
                  null,
                doctorAnswers:
                  (summary as { doctor_answers?: Record<string, unknown> | null }).doctor_answers ??
                  null,
                patientAnswers:
                  ((summary as { patient_audit_v2?: { answers?: Record<string, unknown> } })
                    .patient_audit_v2?.answers ??
                    (summary as { patient_answers?: Record<string, unknown> | null })
                      .patient_answers) ??
                  null,
              },
              forensicAudit: ((summary as { forensic_audit?: unknown }).forensic_audit ??
                (summary as { forensic?: unknown }).forensic ??
                null) as ForensicAuditLike | null,
              graftIntegrity: graftIntegrity
                ? {
                    estimated_implanted_min: graftIntegrity.estimated_implanted.min,
                    estimated_implanted_max: graftIntegrity.estimated_implanted.max,
                    estimated_extracted_min: graftIntegrity.estimated_extracted.min,
                    estimated_extracted_max: graftIntegrity.estimated_extracted.max,
                    confidence_label: graftIntegrity.confidence_label,
                    confidence: graftIntegrity.confidence,
                    auditor_status: graftIntegrity.auditor_status,
                  }
                : null,
            }
          : null,
      });
      if (!projectionResolved.ok || !projectionResolved.report) {
        return null;
      }
      return renderSurgeryDayProjectionReportHtml({
        report: projectionResolved.report,
        caseId,
        generatedAtDisplay: content.generatedAt,
      });
    }
    if (shouldUsePostSurgeryReportTemplate(c.patient_review_pathway, mode)) {
      const postReport = resolvePostSurgeryAuditReport(summary as Record<string, unknown>, {
        caseId,
        reportVersion: content.version,
        patientReviewPathway: c.patient_review_pathway,
        photosByCategory,
        clinicalHistory: clinicalHistorySnapshot,
      });
      if (postReport) {
        const outcomeLabel =
          POST_SURGERY_OUTCOME_LABELS_EN[postReport.proceduralOutcomeId] ??
          postReport.proceduralOutcomeId;
        const repairLabel =
          POST_SURGERY_REPAIR_LABELS_EN[postReport.repairConsiderationId] ??
          postReport.repairConsiderationId;
        const forensic = (summary as Record<string, unknown>)?.forensic_audit as
          | { imageLimitedAssessment?: boolean; documentAssistedAssessment?: boolean }
          | undefined;
        return renderPostSurgeryAuditReportHtml({
          report: postReport,
          caseId,
          generatedAtDisplay: content.generatedAt,
          labels: buildPostSurgeryReportHtmlLabelsEn(outcomeLabel, repairLabel),
          photosByCategory,
          clinicalEvidenceLabels: buildPostSurgeryClinicalEvidenceGalleryLabelsEn(),
          clinicalHistory: clinicalHistorySnapshot,
          imageLimitedAssessment: Boolean(forensic?.imageLimitedAssessment),
          documentAssistedAssessment: Boolean(forensic?.documentAssistedAssessment),
        });
      }
    }
    if (shouldUsePreSurgeryReportTemplate(c.patient_review_pathway, mode)) {
      const preReport = resolvePreSurgeryPlanningReport(summary as Record<string, unknown>, {
        caseId,
        reportVersion: content.version,
        patientReviewPathway: c.patient_review_pathway,
        photosByCategory,
      });
      if (preReport) {
        const outcomeLabel =
          PRE_SURGERY_OUTCOME_LABELS_EN[preReport.planningOutcomeId] ??
          preReport.planningOutcomeId;
        const forensic = (summary as Record<string, unknown>)?.forensic_audit as
          | { imageLimitedAssessment?: boolean; documentAssistedAssessment?: boolean }
          | undefined;
        return renderPreSurgeryPlanningReportHtml({
          report: preReport,
          caseId,
          generatedAtDisplay: content.generatedAt,
          labels: buildPreSurgeryReportHtmlLabelsEn(outcomeLabel),
          photosByCategory,
          clinicalEvidenceLabels: buildPreSurgeryClinicalEvidenceGalleryLabelsEn(),
          clinicalHistory: clinicalHistorySnapshot,
          imageLimitedAssessment: Boolean(forensic?.imageLimitedAssessment),
          documentAssistedAssessment: Boolean(forensic?.documentAssistedAssessment),
        });
      }
    }
    return renderEliteReportHtml(eliteVm);
  })();

  if (html == null) {
    const longitudinalNotReady = shouldUseLongitudinalProjectionReviewTemplate(
      assessmentType,
      mode
    );
    return new NextResponse(
      longitudinalNotReady
        ? "LONGITUDINAL_REVIEW_NOT_READY: frozen projection, observation, and comparison snapshots are required and must share valid lineage"
        : "PROJECTION_NOT_READY: surgery-day reconstruction evidence is insufficient for a projected result report",
      {
        status: 409,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Report-Status": longitudinalNotReady
            ? "longitudinal-review-not-ready"
            : "projection-not-ready",
        },
      }
    );
  }

  const htmlUtf8Bytes = Buffer.byteLength(html, "utf8");

  const clinicalTemplate = shouldUseLongitudinalProjectionReviewTemplate(assessmentType, mode)
    ? "longitudinal-projection-review"
    : shouldUseSurgeryDayProjectionReportTemplate(assessmentType, mode)
      ? "surgery-day-projection"
      : resolvePatientReportTemplateName(c.patient_review_pathway, mode);
  const reportId =
    String(url.searchParams.get("reportId") ?? "").trim() ||
    String((latestReport as { id?: string } | null)?.id ?? "").trim() ||
    null;
  const pdfTemplate = resolvePdfReportTemplateHeader({
    inputTemplate: clinicalTemplate,
    caseId,
    reportId,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Report-Template": pdfTemplate,
      "X-Audit-Mode": mode,
      ...(persistedProjectionSnapshot?.projectionId
        ? { "X-Projection-Snapshot-Id": persistedProjectionSnapshot.projectionId }
        : {}),
      ...(longitudinalFrozen?.projection.id
        ? { "X-Projection-Snapshot-Id": longitudinalFrozen.projection.id }
        : {}),
      ...(longitudinalFrozen?.observation.id
        ? { "X-Observation-Snapshot-Id": longitudinalFrozen.observation.id }
        : {}),
      ...(longitudinalFrozen?.comparison.id
        ? { "X-Comparison-Snapshot-Id": longitudinalFrozen.comparison.id }
        : {}),
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

