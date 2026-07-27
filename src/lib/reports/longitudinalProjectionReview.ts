/**
 * HA-PROJECTION-1G — Longitudinal projection review report (patient presentation).
 *
 * Consumes frozen HA-PROJECTION-1D + 1E + 1F snapshots only.
 * Fail closed on lineage mismatch. Does not re-run 1A/1B/1E/1F engines.
 */

import type { ProjectionSnapshot } from "@/lib/projection/projectionSnapshotTypes";
import type { ProjectionObservationSnapshot } from "@/lib/projection/projectionObservationTypes";
import type { ProjectionComparisonSnapshot } from "@/lib/projection/projectionComparisonTypes";
import type {
  LongitudinalOutcomeStage,
  ProjectionComparisonStatus,
  ProjectionDomainComparison,
  ProjectionObservedComparison,
} from "@/lib/projection/types";
import {
  assertPatientSafeLongitudinalReviewTexts,
  validateFrozenInputsForLongitudinalReview,
} from "./longitudinalProjectionReviewSafety";
import {
  buildDonorObservationLines,
  buildFollowUpTimeline,
  buildLongitudinalImageGroups,
  buildLongitudinalTreatmentAreaRows,
  buildNextReviewRecommendation,
  buildObservationSummaryText,
  buildProjectionSummaryText,
  deriveComparisonConfidenceDisplay,
  EARLY_STAGE_ASSESSABILITY_NOTICE,
  formatDisplayDate,
  formatObservedAtLabel,
  formatStageLabel,
  formatStageSubtitle,
  formatTrioConfidence,
  IMAGE_COMPARISON_CAVEAT,
  LONGITUDINAL_CLINICAL_DISCLAIMER,
  LONGITUDINAL_REVIEW_CONFIDENCE_EXPLANATION,
  LONGITUDINAL_REVIEW_NOTICE,
  mapComparisonStatusLabel,
  mapDomainTitle,
  mapOverallComparisonLabel,
  MONTH3_NORMAL_NOTICE,
  sortDomainComparisonsByPreferredOrder,
  type LongitudinalImageGroup,
  type NextReviewRecommendation,
  type PatientComparisonStatusLabel,
  type PatientOverallComparisonLabel,
  type TimelineStageEntry,
} from "./longitudinalProjectionReviewSections";
import type { ConfidenceDisplay, TreatmentAreaRow } from "./surgeryDayProjectionSections";

export const LONGITUDINAL_PROJECTION_REVIEW_REPORT_VERSION = 1 as const;

export type LongitudinalProjectionReviewAssessmentType = "longitudinal_projection_review";

export type LongitudinalProjectionReviewReportMode = "longitudinal_projection_review";

export type DomainComparisonCard = {
  domain: ProjectionDomainComparison["domain"];
  title: string;
  projectedLabel: string;
  projectedText: string;
  observedLabel: string;
  observedText: string | null;
  comparisonStatus: ProjectionComparisonStatus;
  comparisonLabel: PatientComparisonStatusLabel;
  confidence: ConfidenceDisplay;
  rationale: string;
  limitations: string[];
};

export type DeferredDomainEntry = {
  title: string;
  statusLabel: PatientComparisonStatusLabel;
  rationale: string;
  limitations: string[];
};

export type LongitudinalProjectionReviewReportModel = {
  version: typeof LONGITUDINAL_PROJECTION_REVIEW_REPORT_VERSION;
  assessmentType: LongitudinalProjectionReviewAssessmentType;
  reportTitle: string;
  stageSubtitle: string;
  stage: LongitudinalOutcomeStage;
  stageLabel: string;
  reviewNotice: string;
  earlyStageNotice: string | null;
  month3NormalNotice: string | null;
  procedureDateDisplay: string | null;
  originalProjectionDateDisplay: string | null;
  followUpObservationDateDisplay: string | null;
  reviewStageDisplay: string;
  projectionConfidence: ConfidenceDisplay;
  observationConfidence: ConfidenceDisplay;
  comparisonConfidence: ConfidenceDisplay;
  confidenceExplanation: string;
  projectionSummary: string | null;
  projectionSummaryLabel: string;
  observationSummary: string | null;
  observationSummaryLabel: string;
  overallComparisonStatus: ProjectionComparisonStatus;
  overallComparisonLabel: PatientOverallComparisonLabel;
  overallComparisonSummary: string | null;
  domainComparisons: DomainComparisonCard[];
  treatmentAreas: TreatmentAreaRow[];
  donorSurgeryDay: string[];
  donorFollowUp: string[];
  notYetAssessable: DeferredDomainEntry[];
  insufficientEvidence: DeferredDomainEntry[];
  insufficientEvidenceCta: string | null;
  timeline: TimelineStageEntry[];
  nextReview: NextReviewRecommendation;
  imageGroups: LongitudinalImageGroup[];
  imageComparisonCaveat: string | null;
  clinicalDisclaimer: string;
  reportId: string;
  generatedAt: string;
  /** Audit metadata only — not rendered in patient-facing body. */
  projectionSnapshotId: string;
  observationSnapshotId: string;
  comparisonSnapshotId: string;
};

export type BuildLongitudinalProjectionReviewInput = {
  projection: ProjectionSnapshot;
  observation: ProjectionObservationSnapshot;
  comparison: ProjectionComparisonSnapshot;
  caseId?: string | null;
  reportVersion?: number | null;
  generatedAt?: string | null;
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
  /** Optional historical stages captured for the same projection (timeline only). */
  capturedStages?: LongitudinalOutcomeStage[];
};

export type BuildLongitudinalProjectionReviewResult =
  | { ok: true; report: LongitudinalProjectionReviewReportModel }
  | { ok: false; reason: string; code: LongitudinalReviewFailCode; report: null };

export type LongitudinalReviewFailCode =
  | "LINEAGE_MISMATCH"
  | "CASE_MISMATCH"
  | "PATIENT_MISMATCH"
  | "STAGE_MISMATCH"
  | "INVALID_INPUT"
  | "UNSAFE_CONTENT";

export function isLongitudinalProjectionReviewAssessmentType(
  value: unknown
): value is LongitudinalProjectionReviewAssessmentType {
  return value === "longitudinal_projection_review";
}

export function shouldUseLongitudinalProjectionReviewTemplate(
  assessmentType: unknown,
  auditMode?: string | null
): boolean {
  return auditMode === "patient" && isLongitudinalProjectionReviewAssessmentType(assessmentType);
}

export function resolveLongitudinalProjectionReviewTemplateName(
  assessmentType: unknown,
  auditMode?: string | null
): "longitudinal-projection-review" | null {
  if (!shouldUseLongitudinalProjectionReviewTemplate(assessmentType, auditMode)) return null;
  return "longitudinal-projection-review";
}

/**
 * Fail-closed lineage gate before any presentation mapping.
 * Does not auto-select latest records on mismatch.
 */
export function validateLongitudinalReviewLineage(args: {
  projection: ProjectionSnapshot;
  observation: ProjectionObservationSnapshot;
  comparison: ProjectionComparisonSnapshot | ProjectionObservedComparison;
}): { ok: true } | { ok: false; reason: string; code: LongitudinalReviewFailCode } {
  const { projection, observation, comparison } = args;

  if (!projection?.id || !observation?.id) {
    return { ok: false, code: "INVALID_INPUT", reason: "Projection and observation snapshots are required." };
  }

  const comparisonProjectionId =
    "comparisonPayload" in comparison
      ? comparison.projectionSnapshotId
      : comparison.projectionSnapshotId;
  const comparisonObservationId =
    "comparisonPayload" in comparison
      ? comparison.observationSnapshotId
      : comparison.observationSnapshotId;
  const comparisonCaseId =
    "comparisonPayload" in comparison ? comparison.caseId : comparison.caseId;
  const comparisonPatientId =
    "comparisonPayload" in comparison ? comparison.patientId : comparison.patientId;
  const comparisonStage =
    "comparisonPayload" in comparison ? comparison.stage : comparison.stage;

  if (comparisonProjectionId !== projection.id) {
    return {
      ok: false,
      code: "LINEAGE_MISMATCH",
      reason: "comparison.projectionSnapshotId does not match projection.id.",
    };
  }
  if (comparisonObservationId !== observation.id) {
    return {
      ok: false,
      code: "LINEAGE_MISMATCH",
      reason: "comparison.observationSnapshotId does not match observation.id.",
    };
  }
  if (observation.projectionSnapshotId !== projection.id) {
    return {
      ok: false,
      code: "LINEAGE_MISMATCH",
      reason: "observation.projectionSnapshotId does not match projection.id.",
    };
  }

  if (
    projection.caseId !== observation.caseId ||
    projection.caseId !== comparisonCaseId ||
    observation.caseId !== comparisonCaseId
  ) {
    return {
      ok: false,
      code: "CASE_MISMATCH",
      reason: "Case IDs do not match across projection, observation, and comparison.",
    };
  }

  if (
    projection.patientId !== observation.patientId ||
    projection.patientId !== comparisonPatientId ||
    observation.patientId !== comparisonPatientId
  ) {
    return {
      ok: false,
      code: "PATIENT_MISMATCH",
      reason: "Patient IDs do not match across projection, observation, and comparison.",
    };
  }

  if (observation.stage !== comparisonStage) {
    return {
      ok: false,
      code: "STAGE_MISMATCH",
      reason: "Observation stage does not match comparison stage.",
    };
  }

  return { ok: true };
}

function resolveComparisonPayload(
  comparison: ProjectionComparisonSnapshot
): ProjectionObservedComparison {
  return comparison.comparisonPayload;
}

function collectProjectionTexts(projection: ProjectionSnapshot): string[] {
  const o = projection.projectionSnapshot;
  const texts: string[] = [
    o.summary ?? "",
    ...o.assumptions,
    ...o.limitations,
    ...o.whatCannotYetBeDetermined,
  ];
  for (const c of o.projectedCharacteristics) {
    texts.push(c.title, c.observation, c.projection, ...c.limitations);
  }
  return texts;
}

function collectObservationTexts(observation: ProjectionObservationSnapshot): string[] {
  const p = observation.observationPayload;
  const texts: string[] = [...p.limitations, ...p.evidence.limitations];
  const features = [
    p.recipient.frontalAppearance,
    p.recipient.densityAppearance,
    p.recipient.transitionAppearance,
    p.recipient.directionalAppearance,
    p.recipient.crownAppearance,
    p.donor?.donorAppearance ?? null,
    p.donor?.visibleDepletionPattern ?? null,
    p.donor?.visibleScarring ?? null,
    p.nativeHair.visibleNativeHairStatus,
    p.nativeHair.treatedVsUntreatedRelationship,
    p.healing.visibleHealingStatus,
    ...p.healing.visibleConcerns,
    ...p.overallObservations,
  ];
  for (const f of features) {
    if (!f) continue;
    texts.push(f.label, f.observation);
  }
  return texts;
}

function collectComparisonTexts(payload: ProjectionObservedComparison): string[] {
  const texts: string[] = [payload.summary ?? "", ...payload.limitations];
  for (const d of payload.domains) {
    texts.push(
      d.projectedCharacteristic,
      d.observedCharacteristic ?? "",
      d.rationale,
      ...d.limitations
    );
  }
  return texts;
}

function collectReportDynamicTexts(report: LongitudinalProjectionReviewReportModel): string[] {
  const texts: string[] = [
    report.projectionSummary ?? "",
    report.observationSummary ?? "",
    report.overallComparisonSummary ?? "",
    report.overallComparisonLabel,
    ...report.donorSurgeryDay,
    ...report.donorFollowUp,
  ];
  for (const d of report.domainComparisons) {
    texts.push(
      d.projectedText,
      d.observedText ?? "",
      d.comparisonLabel,
      d.rationale,
      ...d.limitations
    );
  }
  for (const d of [...report.notYetAssessable, ...report.insufficientEvidence]) {
    texts.push(d.statusLabel, d.rationale, ...d.limitations);
  }
  return texts;
}

/**
 * Build patient-safe presentation DTO from frozen 1D + 1E + 1F snapshots.
 * Does not query uploads, regenerate projection, or recalculate comparison statuses.
 */
export function buildLongitudinalProjectionReviewReport(
  input: BuildLongitudinalProjectionReviewInput
): BuildLongitudinalProjectionReviewResult {
  const { projection, observation, comparison } = input;

  if (!projection || !observation || !comparison) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      reason: "Projection, observation, and comparison snapshots are required.",
      report: null,
    };
  }

  const lineage = validateLongitudinalReviewLineage({ projection, observation, comparison });
  if (!lineage.ok) {
    return { ok: false, code: lineage.code, reason: lineage.reason, report: null };
  }

  const payload = resolveComparisonPayload(comparison);
  if (
    payload.projectionSnapshotId !== projection.id ||
    payload.observationSnapshotId !== observation.id
  ) {
    return {
      ok: false,
      code: "LINEAGE_MISMATCH",
      reason: "comparisonPayload lineage does not match snapshot identities.",
      report: null,
    };
  }

  const safety = validateFrozenInputsForLongitudinalReview({
    projectionTexts: collectProjectionTexts(projection),
    observationTexts: collectObservationTexts(observation),
    comparisonTexts: collectComparisonTexts(payload),
  });
  if (!safety.ok) {
    return { ok: false, code: "UNSAFE_CONTENT", reason: safety.reason, report: null };
  }

  const stage = observation.stage;
  const orderedDomains = sortDomainComparisonsByPreferredOrder(payload.domains);

  const domainComparisons: DomainComparisonCard[] = orderedDomains.map((d) => ({
    domain: d.domain,
    title: mapDomainTitle(d.domain),
    projectedLabel: "Projected at Surgery Day",
    projectedText: d.projectedCharacteristic,
    observedLabel: formatObservedAtLabel(stage),
    observedText: d.observedCharacteristic,
    comparisonStatus: d.status,
    comparisonLabel: mapComparisonStatusLabel(d.status),
    confidence: formatTrioConfidence(d.confidence),
    rationale: d.rationale,
    limitations: [...d.limitations],
  }));

  const notYetAssessable: DeferredDomainEntry[] = domainComparisons
    .filter((d) => d.comparisonStatus === "not_yet_assessable")
    .map((d) => ({
      title: d.title,
      statusLabel: d.comparisonLabel,
      rationale: d.rationale,
      limitations: d.limitations,
    }));

  const insufficientEvidence: DeferredDomainEntry[] = domainComparisons
    .filter((d) => d.comparisonStatus === "insufficient_evidence")
    .map((d) => ({
      title: d.title,
      statusLabel: d.comparisonLabel,
      rationale: d.rationale,
      limitations: d.limitations,
    }));

  const donor = buildDonorObservationLines(
    observation.observationPayload,
    projection.reconstructionSnapshot
  );

  const includeBaseline = projection.reconstructionSnapshot.baseline.available;
  const imageGroups = buildLongitudinalImageGroups({
    photosByCategory: input.photosByCategory,
    stage,
    includeBaseline,
  });

  const report: LongitudinalProjectionReviewReportModel = {
    version: LONGITUDINAL_PROJECTION_REVIEW_REPORT_VERSION,
    assessmentType: "longitudinal_projection_review",
    reportTitle: "HairAudit Longitudinal Projection Review",
    stageSubtitle: formatStageSubtitle(stage),
    stage,
    stageLabel: formatStageLabel(stage),
    reviewNotice: LONGITUDINAL_REVIEW_NOTICE,
    earlyStageNotice:
      stage === "month_3" || stage === "month_6" ? EARLY_STAGE_ASSESSABILITY_NOTICE : null,
    month3NormalNotice: stage === "month_3" ? MONTH3_NORMAL_NOTICE : null,
    procedureDateDisplay: formatDisplayDate(
      projection.reconstructionSnapshot.procedureContext.procedureDate
    ),
    originalProjectionDateDisplay: formatDisplayDate(projection.createdAt),
    followUpObservationDateDisplay: formatDisplayDate(observation.observedAt),
    reviewStageDisplay: formatStageLabel(stage),
    projectionConfidence: formatTrioConfidence(
      projection.projectionSnapshot.projectionConfidence
    ),
    observationConfidence: formatTrioConfidence(
      observation.observationPayload.evidence.confidence
    ),
    comparisonConfidence: deriveComparisonConfidenceDisplay(
      orderedDomains.map((d) => d.confidence)
    ),
    confidenceExplanation: LONGITUDINAL_REVIEW_CONFIDENCE_EXPLANATION,
    projectionSummary: buildProjectionSummaryText(projection.projectionSnapshot),
    projectionSummaryLabel: "Projected at Surgery Day",
    observationSummary: buildObservationSummaryText(observation.observationPayload),
    observationSummaryLabel: formatObservedAtLabel(stage),
    overallComparisonStatus: payload.overallStatus,
    overallComparisonLabel: mapOverallComparisonLabel(payload.overallStatus),
    overallComparisonSummary: payload.summary,
    domainComparisons,
    treatmentAreas: buildLongitudinalTreatmentAreaRows(projection.reconstructionSnapshot),
    donorSurgeryDay: donor.surgeryDay,
    donorFollowUp: donor.followUp,
    notYetAssessable,
    insufficientEvidence,
    insufficientEvidenceCta: insufficientEvidence.length
      ? "Add the recommended follow-up view at your next HairAudit."
      : null,
    timeline: buildFollowUpTimeline({
      currentStage: stage,
      capturedStages: input.capturedStages ?? [stage],
      projectionCreated: true,
    }),
    nextReview: buildNextReviewRecommendation(stage),
    imageGroups,
    imageComparisonCaveat: imageGroups.length ? IMAGE_COMPARISON_CAVEAT : null,
    clinicalDisclaimer: LONGITUDINAL_CLINICAL_DISCLAIMER,
    reportId: [
      String(input.caseId ?? projection.caseId).slice(0, 8),
      "lpr",
      stage.replace("month_", "m"),
      String(input.reportVersion ?? 1),
    ].join("-"),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    projectionSnapshotId: projection.id,
    observationSnapshotId: observation.id,
    comparisonSnapshotId: comparison.id,
  };

  const reportGuard = assertPatientSafeLongitudinalReviewTexts(
    collectReportDynamicTexts(report)
  );
  if (!reportGuard.ok) {
    return {
      ok: false,
      code: "UNSAFE_CONTENT",
      reason: `Unsafe language in longitudinal review report: ${reportGuard.violations[0]?.pattern ?? "unknown"}`,
      report: null,
    };
  }

  return { ok: true, report };
}

/**
 * Resolve report from explicit frozen snapshots (preferred historical path).
 * Never silently upgrades to latest projection/observation.
 */
export function resolveLongitudinalProjectionReviewReport(args: {
  projection: ProjectionSnapshot;
  observation: ProjectionObservationSnapshot;
  comparison: ProjectionComparisonSnapshot;
  caseId?: string | null;
  reportVersion?: number | null;
  generatedAt?: string | null;
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
  capturedStages?: LongitudinalOutcomeStage[];
}): BuildLongitudinalProjectionReviewResult {
  return buildLongitudinalProjectionReviewReport(args);
}

/** Extract assessment type including longitudinal review from report summary. */
export function extractLongitudinalAssessmentTypeFromSummary(summary: unknown): string | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  const candidates = [
    s.assessmentType,
    s.assessment_type,
    s.hairAuditAssessmentType,
    (s.longitudinal_projection_review as Record<string, unknown> | undefined)?.assessmentType,
    (s.longitudinalProjectionReview as Record<string, unknown> | undefined)?.assessmentType,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

export const LONGITUDINAL_PROJECTION_TABLES = {
  observations: "hairaudit_projection_observations",
  comparisons: "hairaudit_projection_comparisons",
} as const;
