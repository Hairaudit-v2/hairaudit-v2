import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildClinicalHistorySnapshot,
  loadCaseClinicalHistory,
} from "@/lib/hairaudit/clinical-history/clinicalHistory.server";
import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import { normalizePatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import { buildPatientSafeReportSummary } from "@/lib/reports/patientSafeSummary";
import {
  generatePostSurgeryAuditReport,
  isPostSurgeryAuditReport,
} from "@/lib/reports/postSurgeryAuditReport";
import {
  generatePreSurgeryPlanningReport,
  isPreSurgeryPlanningReport,
} from "@/lib/reports/preSurgeryPlanningReport";
import {
  evaluatePdfReadiness,
  isImageLimitedAuditSummary,
  resolveReportPdfStoragePath,
  toNumberRecord,
} from "@/lib/reports/pdfReadiness";

export type ReportPdfRebuildDiagnostics = {
  reportId: string | null;
  caseId: string;
  reportVersion: number | null;
  hasReportRow: boolean;
  hasForensicAudit: boolean;
  hasReportSummary: boolean;
  hasPatientSafeSummary: boolean;
  hasScores: boolean;
  hasNarrative: boolean;
  hasSections: boolean;
  hasPdfPath: boolean;
  resolvedPdfPath: string;
  missingFields: string[];
};

export type ReportPdfRebuildPreflightResult = {
  ready: boolean;
  message: string;
  diagnostics: ReportPdfRebuildDiagnostics;
  enrichedSummary?: Record<string, unknown>;
  summaryMutated: boolean;
  reportId: string | null;
  reportVersion: number;
};

export class PdfRebuildNotReadyError extends Error {
  readonly code = "PDF_REBUILD_NOT_READY" as const;
  readonly missingFields: string[];
  readonly diagnostics: ReportPdfRebuildDiagnostics;

  constructor(message: string, diagnostics: ReportPdfRebuildDiagnostics) {
    super(message);
    this.name = "PdfRebuildNotReadyError";
    this.missingFields = diagnostics.missingFields;
    this.diagnostics = diagnostics;
  }
}

type ReportRow = {
  id: string;
  case_id: string;
  version: number | null;
  summary: unknown;
  pdf_path: string | null;
  status: string | null;
};

export function hasStoredPatientSafeSummary(summary: Record<string, unknown> | null | undefined): boolean {
  if (!summary || typeof summary !== "object") return false;
  if (summary.patientSafeSummary && typeof summary.patientSafeSummary === "object") return true;
  const post = summary.post_surgery_audit_report;
  if (post && typeof post === "object" && (post as Record<string, unknown>).patientSafeSummary) return true;
  const pre = summary.pre_surgery_planning_report;
  if (pre && typeof pre === "object" && (pre as Record<string, unknown>).patientSafeSummary) return true;
  return false;
}

/** Map forensic_audit fields onto the summary shape PDF + patient-safe builders expect. */
export function mergeForensicIntoSummaryShape(summary: Record<string, unknown>): Record<string, unknown> {
  const out = { ...summary };
  const forensic = (out.forensic_audit ?? out.forensic) as Record<string, unknown> | null | undefined;
  if (!forensic || typeof forensic !== "object") return out;

  if (!Array.isArray(out.key_findings) && Array.isArray(forensic.key_findings)) {
    out.key_findings = forensic.key_findings;
  }
  if (!Array.isArray(out.red_flags) && Array.isArray(forensic.red_flags)) {
    out.red_flags = forensic.red_flags;
  }
  if (out.score == null && out.overall_score == null && forensic.overall_score != null) {
    out.score = forensic.overall_score;
  }
  if (!out.section_scores && forensic.section_scores) {
    out.section_scores = forensic.section_scores;
  }
  if (!out.notes && typeof forensic.summary === "string" && forensic.summary.trim()) {
    out.notes = forensic.summary;
  }
  return out;
}

export function attachPatientSafeSummaryToReport(
  summary: Record<string, unknown>,
  opts?: {
    clinicalHistory?: ClinicalHistorySnapshot | null;
    patientReviewPathway?: unknown;
    caseId?: string;
    reportVersion?: number;
  }
): Record<string, unknown> {
  if (hasStoredPatientSafeSummary(summary)) return summary;

  const merged = mergeForensicIntoSummaryShape(summary);
  const forensic = merged.forensic_audit ?? merged.forensic;
  if (!forensic || typeof forensic !== "object") return merged;

  const pathway = normalizePatientReviewPathway(
    opts?.patientReviewPathway ??
      merged.patient_review_pathway ??
      (typeof merged.metadata === "object" && merged.metadata != null
        ? (merged.metadata as Record<string, unknown>).patientReviewPathway
        : undefined)
  );

  const patientSafeSummary = buildPatientSafeReportSummary(merged, {
    patientReviewPathway: pathway,
    clinicalHistory: opts?.clinicalHistory ?? null,
  });

  const out: Record<string, unknown> = { ...merged, patientSafeSummary };

  if (pathway === "post_surgery") {
    const stored = out.post_surgery_audit_report;
    if (isPostSurgeryAuditReport(stored)) {
      out.post_surgery_audit_report = { ...stored, patientSafeSummary };
    } else if (opts?.caseId) {
      out.post_surgery_audit_report = generatePostSurgeryAuditReport({
        summary: merged,
        caseId: opts.caseId,
        reportVersion: opts.reportVersion,
        patientReviewPathway: pathway,
        clinicalHistory: opts?.clinicalHistory ?? null,
      });
    }
  } else if (pathway === "pre_surgery") {
    const stored = out.pre_surgery_planning_report;
    if (isPreSurgeryPlanningReport(stored)) {
      out.pre_surgery_planning_report = { ...stored, patientSafeSummary };
    } else if (opts?.caseId) {
      out.pre_surgery_planning_report = generatePreSurgeryPlanningReport({
        summary: merged,
        caseId: opts.caseId,
        reportVersion: opts.reportVersion,
        patientReviewPathway: pathway,
      });
    }
  }

  return out;
}

function extractForensic(summary: Record<string, unknown> | null): Record<string, unknown> | null {
  const forensic = (summary?.forensic_audit ?? summary?.forensic) as Record<string, unknown> | null | undefined;
  return forensic && typeof forensic === "object" ? forensic : null;
}

export function buildReportPdfRebuildDiagnostics(args: {
  report: ReportRow | null;
  caseId: string;
  caseStatus?: string | null;
  enrichedSummary?: Record<string, unknown> | null;
}): ReportPdfRebuildDiagnostics {
  const report = args.report;
  const caseId = String(args.caseId ?? "").trim();
  const version = report ? Number(report.version ?? 0) : null;
  const summary =
    (args.enrichedSummary ??
      (report?.summary as Record<string, unknown> | null | undefined) ??
      null) as Record<string, unknown> | null;

  const hasReportRow = Boolean(report?.id);
  const hasReportSummary = Boolean(summary && typeof summary === "object");
  const forensic = hasReportSummary ? extractForensic(summary) : null;
  const hasForensicAudit = Boolean(forensic);
  const imageLimited = hasReportSummary ? isImageLimitedAuditSummary(summary) : false;

  const overall = hasReportSummary
    ? Number(summary?.overall_score ?? summary?.score ?? forensic?.overall_score)
    : NaN;
  const hasScores = Number.isFinite(overall);

  const narrative = hasReportSummary ? String(forensic?.summary ?? summary?.notes ?? "").trim() : "";
  const hasNarrative = narrative.length > 0;

  const sections = hasReportSummary
    ? toNumberRecord(
        (summary as { computed?: { component_scores?: { sections?: unknown } } })?.computed?.component_scores
          ?.sections ??
          summary?.section_scores ??
          forensic?.section_scores ??
          null
      )
    : {};
  const hasSections = Object.keys(sections).length > 0 || imageLimited;

  const hasPatientSafeSummary = hasReportSummary ? hasStoredPatientSafeSummary(summary) : false;
  const storedPdfPath = String(report?.pdf_path ?? "").trim();
  const hasPdfPath = storedPdfPath.length > 0;
  const resolvedPdfPath =
    version != null && version > 0
      ? resolveReportPdfStoragePath({ caseId, version, pdfPath: report?.pdf_path })
      : "";

  const missingFields: string[] = [];
  if (!hasReportRow) missingFields.push("reportRow");
  if (!hasReportSummary) missingFields.push("reportSummary");
  if (!hasForensicAudit) missingFields.push("forensic_audit");
  if (!hasScores) missingFields.push("scores");
  if (!hasNarrative) missingFields.push("narrative");
  if (!imageLimited && !hasSections) missingFields.push("sections");
  if (!hasPatientSafeSummary) missingFields.push("patientSafeSummary");

  if (hasReportSummary) {
    const readiness = evaluatePdfReadiness({
      caseStatus: args.caseStatus ?? null,
      reportStatus: report?.status ?? null,
      summary,
    });
    if (!readiness.ready) {
      const reason = String(readiness.reason ?? "audit summary is incomplete");
      if (reason.includes("audit failed") && !missingFields.includes("auditFailed")) {
        missingFields.push("auditFailed");
      } else if (reason.includes("audit still running") && !missingFields.includes("auditStillRunning")) {
        missingFields.push("auditStillRunning");
      } else if (
        reason.includes("processing") &&
        !missingFields.some((f) => f === "caseProcessing" || f === "reportProcessing")
      ) {
        missingFields.push(reason.includes("case") ? "caseProcessing" : "reportProcessing");
      } else if (reason.includes("incomplete") && !missingFields.includes("auditSummaryIncomplete")) {
        missingFields.push("auditSummaryIncomplete");
      }
    }
  }

  return {
    reportId: report?.id ?? null,
    caseId,
    reportVersion: version,
    hasReportRow,
    hasForensicAudit,
    hasReportSummary,
    hasPatientSafeSummary,
    hasScores,
    hasNarrative,
    hasSections,
    hasPdfPath,
    resolvedPdfPath,
    missingFields: [...new Set(missingFields)],
  };
}

export function formatPdfRebuildFailureMessage(diagnostics: ReportPdfRebuildDiagnostics): string {
  if (diagnostics.missingFields.length === 0) {
    return "Report exists, but the PDF file is missing and could not be regenerated.";
  }
  return `PDF rebuild blocked — missing: ${diagnostics.missingFields.join(", ")}`;
}

async function loadReportForRebuild(args: {
  supabase: SupabaseClient;
  caseId: string;
  reportId?: string;
  version?: number;
}): Promise<ReportRow | null> {
  const caseId = String(args.caseId ?? "").trim();
  if (!caseId) return null;

  let query = args.supabase
    .from("reports")
    .select("id, case_id, version, summary, pdf_path, status")
    .eq("case_id", caseId);

  if (args.reportId) {
    query = query.eq("id", args.reportId);
  } else if (args.version != null && Number(args.version) > 0) {
    query = query.eq("version", Math.floor(Number(args.version)));
  } else {
    query = query
      .not("status", "eq", "audit_failed")
      .not("status", "eq", "failed")
      .order("version", { ascending: false })
      .limit(1);
  }

  const { data } = await query.maybeSingle();
  return (data as ReportRow | null) ?? null;
}

export async function evaluateReportPdfRebuildPreflight(args: {
  caseId: string;
  reportId?: string;
  version?: number;
  supabase?: SupabaseClient;
}): Promise<ReportPdfRebuildPreflightResult> {
  const supabase = args.supabase ?? createSupabaseAdminClient();
  const caseId = String(args.caseId ?? "").trim();

  const [{ data: caseRow }, report] = await Promise.all([
    supabase.from("cases").select("status, patient_review_pathway").eq("id", caseId).maybeSingle(),
    loadReportForRebuild({
      supabase,
      caseId,
      reportId: args.reportId,
      version: args.version,
    }),
  ]);

  const caseStatus = (caseRow as { status?: string | null } | null)?.status ?? null;
  const patientReviewPathway =
    (caseRow as { patient_review_pathway?: string | null } | null)?.patient_review_pathway ?? null;

  let enrichedSummary: Record<string, unknown> | null = null;
  let summaryMutated = false;

  const baseSummary = (report?.summary ?? null) as Record<string, unknown> | null;
  if (baseSummary && typeof baseSummary === "object") {
    const clinicalRow = await loadCaseClinicalHistory(caseId, supabase);
    const clinicalHistory = clinicalRow ? buildClinicalHistorySnapshot(clinicalRow) : null;
    enrichedSummary = attachPatientSafeSummaryToReport(baseSummary, {
      clinicalHistory,
      patientReviewPathway,
      caseId,
      reportVersion: Number(report?.version ?? 0) || undefined,
    });
    summaryMutated = JSON.stringify(enrichedSummary) !== JSON.stringify(baseSummary);
  }

  const diagnostics = buildReportPdfRebuildDiagnostics({
    report,
    caseId,
    caseStatus,
    enrichedSummary,
  });

  const ready =
    diagnostics.hasReportRow &&
    diagnostics.hasForensicAudit &&
    diagnostics.hasScores &&
    diagnostics.hasNarrative &&
    (diagnostics.hasSections || isImageLimitedAuditSummary(enrichedSummary ?? baseSummary)) &&
    diagnostics.hasPatientSafeSummary &&
    evaluatePdfReadiness({
      caseStatus,
      reportStatus: report?.status ?? null,
      summary: enrichedSummary ?? baseSummary,
    }).ready;

  const message = ready
    ? "Report summary is ready for PDF rebuild."
    : formatPdfRebuildFailureMessage(diagnostics);

  if (ready) {
    console.info("[reports/pdf-rebuild-preflight] ready", {
      reportId: diagnostics.reportId,
      caseId: diagnostics.caseId,
      reportVersion: diagnostics.reportVersion,
      summaryMutated,
      hasPdfPath: diagnostics.hasPdfPath,
      resolvedPdfPath: diagnostics.resolvedPdfPath,
    });
  } else {
    console.warn("[reports/pdf-rebuild-preflight] blocked", {
      reportId: diagnostics.reportId,
      caseId: diagnostics.caseId,
      reportVersion: diagnostics.reportVersion,
      missingFields: diagnostics.missingFields,
      hasForensicAudit: diagnostics.hasForensicAudit,
      hasPatientSafeSummary: diagnostics.hasPatientSafeSummary,
      hasScores: diagnostics.hasScores,
      hasNarrative: diagnostics.hasNarrative,
      hasSections: diagnostics.hasSections,
    });
  }

  return {
    ready,
    message,
    diagnostics,
    enrichedSummary: enrichedSummary ?? undefined,
    summaryMutated,
    reportId: report?.id ?? null,
    reportVersion: Number(report?.version ?? 0),
  };
}

export async function persistEnrichedReportSummary(args: {
  reportId: string;
  summary: Record<string, unknown>;
  supabase?: SupabaseClient;
}): Promise<void> {
  const supabase = args.supabase ?? createSupabaseAdminClient();
  const { error } = await supabase.from("reports").update({ summary: args.summary }).eq("id", args.reportId);
  if (error) {
    throw new Error(`Failed to persist enriched report summary: ${error.message}`);
  }
}
