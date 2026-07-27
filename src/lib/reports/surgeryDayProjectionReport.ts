/**
 * HA-PROJECTION-1C — Surgery-day projected result report (patient presentation).
 *
 * Consumes canonical 1A reconstruction + 1B projected outcome only.
 * Fail closed on unsafe projection language. No new projection engine.
 */

import {
  buildSurgeryDayProcedureReconstruction,
  type BuildSurgeryDayProcedureReconstructionInput,
} from "@/lib/projection/surgeryDayProcedureReconstruction";
import { buildSurgeryDayProjectedOutcome } from "@/lib/projection/surgeryDayProjectedOutcome";
import {
  assertPatientSafeProjectionText,
  findUnsafeProjectionClaims,
} from "@/lib/projection/surgeryDayProjectionSafety";
import type {
  SurgeryDayProjectionAssessmentType,
  SurgeryDayProcedureReconstruction,
  SurgeryDayProjectedOutcome,
} from "@/lib/projection/types";
import {
  buildBiologicalTimeline,
  buildDonorObservationLines,
  buildFutureComparisonMilestones,
  buildGraftEvidenceDisplay,
  buildObservedTodayBlocks,
  buildProcedureContextFields,
  buildProjectionImageGroups,
  buildRecommendedNextSteps,
  buildTreatmentAreaRows,
  CLINICAL_DISCLAIMER,
  formatConfidenceLabel,
  patientFriendlyEvidenceRoles,
  PROJECTION_CONFIDENCE_EXPLANATION,
  projectedCharacteristicsForReport,
  type BiologicalTimelineStage,
  type ConfidenceDisplay,
  type FutureComparisonMilestone,
  type GraftEvidenceDisplay,
  type ObservedTodayBlock,
  type PatientFriendlyEvidenceRole,
  type ProcedureContextField,
  type ProjectionImageGroup,
  type TreatmentAreaRow,
} from "./surgeryDayProjectionSections";

export const SURGERY_DAY_PROJECTION_REPORT_VERSION = 1 as const;

export type SurgeryDayProjectionReportMode =
  | "surgery_day_projection"
  | "surgery_day_projection_with_baseline";

export type SurgeryDayProjectionReport = {
  version: typeof SURGERY_DAY_PROJECTION_REPORT_VERSION;
  assessmentType: SurgeryDayProjectionAssessmentType;
  reportTitle: string;
  safetyBanner: string;
  modeBanner: string;
  reconstructionConfidence: ConfidenceDisplay;
  projectionConfidence: ConfidenceDisplay;
  projectionConfidenceExplanation: string;
  evidenceRoles: PatientFriendlyEvidenceRole[];
  evidenceLimitations: string[];
  procedureContextFields: ProcedureContextField[];
  observedToday: ObservedTodayBlock[];
  treatmentAreas: TreatmentAreaRow[];
  projectedCharacteristics: SurgeryDayProjectedOutcome["projectedCharacteristics"];
  graftEvidence: GraftEvidenceDisplay;
  donorObservations: string[];
  biologicalTimeline: BiologicalTimelineStage[];
  biologicalTimelineNote: string;
  whatCannotYetBeDetermined: string[];
  futureComparisonIntro: string;
  futureComparisonMilestones: FutureComparisonMilestone[];
  recommendedNextSteps: string[];
  clinicalDisclaimer: string;
  summary: string | null;
  assumptions: string[];
  imageGroups: ProjectionImageGroup[];
  reportId: string;
  generatedAt: string;
  /**
   * HA-PROJECTION-1D — audit metadata only (not patient-facing copy).
   * When set, this report was rendered from a frozen historical snapshot.
   */
  projectionSnapshotId?: string | null;
};

export type BuildSurgeryDayProjectionReportInput = {
  reconstruction: SurgeryDayProcedureReconstruction;
  projectedOutcome: SurgeryDayProjectedOutcome;
  caseId?: string | null;
  reportVersion?: number | null;
  generatedAt?: string | null;
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
  /** HA-PROJECTION-1D — when rendering from a frozen snapshot. */
  projectionSnapshotId?: string | null;
};

export type BuildSurgeryDayProjectionReportResult =
  | { ok: true; report: SurgeryDayProjectionReport }
  | { ok: false; reason: string; report: null };

function isProjectionAssessmentType(value: unknown): value is SurgeryDayProjectionAssessmentType {
  return value === "surgery_day_projection" || value === "surgery_day_projection_with_baseline";
}

export function isSurgeryDayProjectionAssessmentType(
  value: unknown
): value is SurgeryDayProjectionAssessmentType {
  return isProjectionAssessmentType(value);
}

export function shouldUseSurgeryDayProjectionReportTemplate(
  assessmentType: unknown,
  auditMode?: string | null
): boolean {
  return auditMode === "patient" && isProjectionAssessmentType(assessmentType);
}

export function resolveSurgeryDayProjectionTemplateName(
  assessmentType: unknown,
  auditMode?: string | null
): "surgery-day-projection" | null {
  if (!shouldUseSurgeryDayProjectionReportTemplate(assessmentType, auditMode)) return null;
  return "surgery-day-projection";
}

/**
 * Resolve presentation template across assessmentType + pathway.
 * Projection assessmentType takes precedence when present for patient mode.
 */
export function resolveReportPresentationTemplateName(args: {
  assessmentType?: unknown;
  pathway?: unknown;
  auditMode?: string | null;
  resolvePathwayTemplate: (
    pathway: unknown,
    auditMode?: string | null
  ) => "post-surgery-audit" | "pre-surgery-planning" | "elite";
}): "surgery-day-projection" | "post-surgery-audit" | "pre-surgery-planning" | "elite" {
  const projection = resolveSurgeryDayProjectionTemplateName(args.assessmentType, args.auditMode);
  if (projection) return projection;
  return args.resolvePathwayTemplate(args.pathway, args.auditMode);
}

export function extractAssessmentTypeFromSummary(summary: unknown): string | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  const candidates = [
    s.assessmentType,
    s.assessment_type,
    s.hairAuditAssessmentType,
    (s.surgery_day_projection as Record<string, unknown> | undefined)?.assessmentType,
    (s.projectedOutcome as Record<string, unknown> | undefined)?.assessmentType,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

/** Dynamic clinical content that must remain patient-safe (excludes static educational banners). */
function collectDynamicReportTexts(report: SurgeryDayProjectionReport): string[] {
  const texts: string[] = [
    report.summary ?? "",
    ...report.evidenceLimitations,
    ...report.assumptions,
    ...report.whatCannotYetBeDetermined,
    ...report.donorObservations,
  ];
  for (const o of report.observedToday) {
    texts.push(o.title, o.observation);
  }
  for (const c of report.projectedCharacteristics) {
    texts.push(c.title, c.observation, c.projection, ...c.limitations);
  }
  for (const r of report.graftEvidence.procedureRecords) {
    texts.push(r.label, r.value, r.source ?? "");
  }
  if (report.graftEvidence.conflictNote) texts.push(report.graftEvidence.conflictNote);
  return texts;
}

function assertNoForbiddenReportClaims(texts: string[]): { ok: true } | { ok: false; reason: string } {
  const extraForbidden = [
    /\bsuccess score\b/i,
    /\bpredicted success\b/i,
    /\bai outcome score\b/i,
    /\bfinal result estimate\b/i,
    /\bexpected survival\b/i,
  ];
  for (const text of texts) {
    const unsafe = findUnsafeProjectionClaims(text);
    if (unsafe.length) {
      return { ok: false, reason: `Unsafe projection language in report: ${unsafe[0]?.pattern}` };
    }
    for (const re of extraForbidden) {
      if (re.test(text)) {
        return { ok: false, reason: `Forbidden report claim matched: ${re.source}` };
      }
    }
  }
  return { ok: true };
}

/**
 * Build patient projection report from 1A + 1B only.
 * Validates projection payload with 1B safety layer and report-level guards.
 */
export function buildSurgeryDayProjectionReport(
  input: BuildSurgeryDayProjectionReportInput
): BuildSurgeryDayProjectionReportResult {
  const { reconstruction, projectedOutcome } = input;

  if (!reconstruction || typeof reconstruction !== "object") {
    return { ok: false, reason: "SurgeryDayProcedureReconstruction is required.", report: null };
  }
  if (!projectedOutcome || typeof projectedOutcome !== "object") {
    return { ok: false, reason: "SurgeryDayProjectedOutcome is required.", report: null };
  }
  if (!isProjectionAssessmentType(projectedOutcome.assessmentType)) {
    return { ok: false, reason: "projectedOutcome.assessmentType is not a projection mode.", report: null };
  }

  // Reconstruction must be a surgery-day reconstruction assessment
  if (
    reconstruction.assessmentType !== "surgery_day_reconstruction" &&
    reconstruction.assessmentType !== "surgery_day_reconstruction_with_baseline"
  ) {
    return {
      ok: false,
      reason: "Reconstruction assessment type is not surgery-day reconstruction.",
      report: null,
    };
  }

  if (!reconstruction.evidence?.presentRoles?.includes("surgery_day_recipient")) {
    return {
      ok: false,
      reason: "Reconstruction evidence is insufficient for a projection report.",
      report: null,
    };
  }

  // Re-validate 1B payload fail-closed
  const outcomeTexts = [
    projectedOutcome.summary ?? "",
    ...projectedOutcome.assumptions,
    ...projectedOutcome.limitations,
    ...projectedOutcome.whatCannotYetBeDetermined,
  ];
  for (const c of projectedOutcome.projectedCharacteristics) {
    outcomeTexts.push(c.title, c.observation, c.projection, ...c.limitations);
  }
  const outcomeSafety = assertPatientSafeProjectionText(outcomeTexts);
  if (!outcomeSafety.ok) {
    return {
      ok: false,
      reason: "Projected outcome failed 1B safety validation before report render.",
      report: null,
    };
  }

  const withBaseline =
    projectedOutcome.assessmentType === "surgery_day_projection_with_baseline";

  const report: SurgeryDayProjectionReport = {
    version: SURGERY_DAY_PROJECTION_REPORT_VERSION,
    assessmentType: projectedOutcome.assessmentType,
    reportTitle: "HairAudit Surgery-Day Projection",
    safetyBanner:
      "Projected analysis based on surgery-day evidence — not an observed final result.",
    modeBanner: withBaseline
      ? "Projection informed by preoperative baseline and surgery-day evidence."
      : "Projection based on surgery-day evidence only. No verified preoperative baseline was available.",
    reconstructionConfidence: formatConfidenceLabel(projectedOutcome.reconstructionConfidence),
    projectionConfidence: formatConfidenceLabel(projectedOutcome.projectionConfidence),
    projectionConfidenceExplanation: PROJECTION_CONFIDENCE_EXPLANATION,
    evidenceRoles: patientFriendlyEvidenceRoles(reconstruction.evidence.presentRoles),
    evidenceLimitations: [...reconstruction.evidence.limitations, ...projectedOutcome.limitations]
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i),
    procedureContextFields: buildProcedureContextFields(reconstruction),
    observedToday: buildObservedTodayBlocks(reconstruction),
    treatmentAreas: buildTreatmentAreaRows(reconstruction),
    projectedCharacteristics: projectedCharacteristicsForReport(projectedOutcome),
    graftEvidence: buildGraftEvidenceDisplay(reconstruction),
    donorObservations: buildDonorObservationLines(reconstruction),
    biologicalTimeline: buildBiologicalTimeline(),
    biologicalTimelineNote:
      "Individual timelines vary. This timeline is educational and not a patient-specific prediction.",
    whatCannotYetBeDetermined: [...projectedOutcome.whatCannotYetBeDetermined],
    futureComparisonIntro:
      "Future HairAudit reviews can be used to compare observed progress against the characteristics documented in this projection.",
    futureComparisonMilestones: buildFutureComparisonMilestones(),
    recommendedNextSteps: buildRecommendedNextSteps(),
    clinicalDisclaimer: CLINICAL_DISCLAIMER,
    summary: projectedOutcome.summary,
    assumptions: [...projectedOutcome.assumptions],
    imageGroups: buildProjectionImageGroups(
      input.photosByCategory,
      reconstruction.evidence.presentRoles
    ),
    reportId: [
      String(input.caseId ?? "case").slice(0, 8),
      "sdp",
      String(input.reportVersion ?? 1),
    ].join("-"),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    projectionSnapshotId: input.projectionSnapshotId ?? null,
  };

  // Hide baseline-only observed block already handled; native hair domain only if 1B emitted it.
  if (!reconstruction.baseline.available) {
    report.observedToday = report.observedToday.filter((b) => b.id !== "baseline_comparison");
  }

  const reportGuard = assertNoForbiddenReportClaims(collectDynamicReportTexts(report));
  if (!reportGuard.ok) {
    return { ok: false, reason: reportGuard.reason, report: null };
  }

  return { ok: true, report };
}

/**
 * Convenience: build report only when 1A+1B are already available and valid.
 * Used by print routing / tests — does not invent projections for incomplete cases.
 */
export function tryBuildSurgeryDayProjectionReport(
  input: BuildSurgeryDayProjectionReportInput
): SurgeryDayProjectionReport | null {
  const result = buildSurgeryDayProjectionReport(input);
  return result.ok ? result.report : null;
}

function asReconstruction(value: unknown): SurgeryDayProcedureReconstruction | null {
  if (!value || typeof value !== "object") return null;
  const r = value as SurgeryDayProcedureReconstruction;
  if (
    r.assessmentType !== "surgery_day_reconstruction" &&
    r.assessmentType !== "surgery_day_reconstruction_with_baseline"
  ) {
    return null;
  }
  if (!r.evidence || !Array.isArray(r.evidence.presentRoles)) return null;
  return r;
}

function asProjectedOutcome(value: unknown): SurgeryDayProjectedOutcome | null {
  if (!value || typeof value !== "object") return null;
  const o = value as SurgeryDayProjectedOutcome;
  if (!isProjectionAssessmentType(o.assessmentType)) return null;
  if (!Array.isArray(o.projectedCharacteristics)) return null;
  if (!Array.isArray(o.whatCannotYetBeDetermined)) return null;
  return o;
}

/** Prefer embedded canonical 1A/1B on summary when present (no re-derivation). */
export function extractCanonicalProjectionPairFromSummary(summary: unknown): {
  reconstruction: SurgeryDayProcedureReconstruction;
  projectedOutcome: SurgeryDayProjectedOutcome;
} | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  const nested = (s.surgeryDayProjection ?? s.surgery_day_projection) as
    | Record<string, unknown>
    | undefined;
  const reconstruction = asReconstruction(
    s.surgeryDayReconstruction ??
      s.surgery_day_reconstruction ??
      nested?.reconstruction
  );
  const projectedOutcome = asProjectedOutcome(
    s.surgeryDayProjectedOutcome ??
      s.surgery_day_projected_outcome ??
      nested?.projectedOutcome ??
      nested?.projected_outcome
  );
  if (!reconstruction || !projectedOutcome) return null;
  return { reconstruction, projectedOutcome };
}

export type PersistedProjectionSnapshotSource = {
  projectionId: string;
  reconstruction: SurgeryDayProcedureReconstruction;
  projectedOutcome: SurgeryDayProjectedOutcome;
};

export type ResolveSurgeryDayProjectionReportArgs = {
  summary?: unknown;
  caseId?: string | null;
  reportVersion?: number | null;
  generatedAt?: string | null;
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
  /** Optional on-demand 1A inputs when summary does not already embed reconstruction/outcome. */
  reconstructionInput?: BuildSurgeryDayProcedureReconstructionInput | null;
  /**
   * HA-PROJECTION-1D — prefer a frozen historical snapshot when present.
   * Historical re-renders must use this path so engine changes do not rewrite day-0 content.
   */
  persistedSnapshot?: PersistedProjectionSnapshotSource | null;
};

/**
 * Resolve a projection report for print/PDF.
 * Precedence:
 * 1. Frozen HA-PROJECTION-1D persisted snapshot (historical truth)
 * 2. Embedded 1A+1B on summary
 * 3. On-demand 1A→1B rebuild (legacy / explicit fallback)
 * Never invents a generic projection when reconstruction is insufficient.
 */
export function resolveSurgeryDayProjectionReport(
  args: ResolveSurgeryDayProjectionReportArgs
): BuildSurgeryDayProjectionReportResult {
  let reconstruction: SurgeryDayProcedureReconstruction | null = null;
  let projectedOutcome: SurgeryDayProjectedOutcome | null = null;
  let projectionSnapshotId: string | null = null;

  if (args.persistedSnapshot) {
    reconstruction = args.persistedSnapshot.reconstruction;
    projectedOutcome = args.persistedSnapshot.projectedOutcome;
    projectionSnapshotId = args.persistedSnapshot.projectionId;
  } else {
    const embedded = extractCanonicalProjectionPairFromSummary(args.summary);
    if (embedded) {
      reconstruction = embedded.reconstruction;
      projectedOutcome = embedded.projectedOutcome;
    } else if (args.reconstructionInput) {
      const rebuilt = buildSurgeryDayProcedureReconstruction(args.reconstructionInput);
      if (!rebuilt.ok) {
        return {
          ok: false,
          reason: rebuilt.reason || "Surgery-day reconstruction evidence is insufficient.",
          report: null,
        };
      }
      reconstruction = rebuilt.reconstruction;
      const outcome = buildSurgeryDayProjectedOutcome(reconstruction);
      if (!outcome.ok || !outcome.projectedOutcome) {
        return {
          ok: false,
          reason: outcome.reason || "Projected outcome could not be validated.",
          report: null,
        };
      }
      projectedOutcome = outcome.projectedOutcome;
    } else {
      return {
        ok: false,
        reason:
          "No canonical reconstruction/projected outcome available for surgery-day projection report.",
        report: null,
      };
    }
  }

  return buildSurgeryDayProjectionReport({
    reconstruction,
    projectedOutcome,
    caseId: args.caseId,
    reportVersion: args.reportVersion,
    generatedAt: args.generatedAt,
    photosByCategory: args.photosByCategory,
    projectionSnapshotId,
  });
}

/**
 * HA-PROJECTION-1D — render exclusively from a frozen snapshot (no recalculation).
 */
export function buildSurgeryDayProjectionReportFromSnapshot(args: {
  persistedSnapshot: PersistedProjectionSnapshotSource;
  caseId?: string | null;
  reportVersion?: number | null;
  generatedAt?: string | null;
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
}): BuildSurgeryDayProjectionReportResult {
  return resolveSurgeryDayProjectionReport({
    persistedSnapshot: args.persistedSnapshot,
    caseId: args.caseId,
    reportVersion: args.reportVersion,
    generatedAt: args.generatedAt,
    photosByCategory: args.photosByCategory,
  });
}
