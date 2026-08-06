/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — Resolve an approved immutable projection for report inclusion.
 *
 * Canonical source: hairaudit_pre_surgery_projections (Pre-Surgery Intelligence 2A–2D).
 * Does NOT use HA-PROJECTION-1A–1G longitudinal snapshots or regenerate imagery in PDF routes.
 */

import type { PreSurgeryPlanningOutcomeId } from "@/lib/reports/preSurgeryPlanningReport";
import type { ClinicalImageReview, PreSurgeryGraftPlan, PreSurgeryIllustrativeProjection, PreSurgeryProjectionMode } from "./types";
import { PRE_SURGERY_PROJECTION_PATIENT_LABELS } from "./types";
import { isProjectionSourceRole } from "./imageRoles";
import { selectApprovedGraftPlanForReport, selectReportEligibleProjections, type PatientSafeGraftPlanForReport } from "./reportIntegration";
import {
  hasBlockingConsistencyIssues,
  validateProjectionReportConsistency,
  type ProjectionReportConsistencyIssue,
} from "./reportProjectionConsistency";
import {
  CASE_SPECIFIC_LIMITATION_COPY,
  ILLUSTRATIVE_PROJECTED_RESULT_INTRO,
  ILLUSTRATIVE_PROJECTED_RESULT_LIMITATION_PANEL,
  ILLUSTRATIVE_PROJECTED_RESULT_TITLE,
  PROJECTION_NOT_INCLUDED_EXPLANATION,
  PROJECTION_WITHHELD_EVIDENCE_EXPLANATION,
  REPORT_PLANNING_MODE_LABELS,
  type CaseSpecificLimitationCode,
} from "./reportProjectionCopy";
import { sanitizePatientReportText } from "@/lib/reports/postSurgeryPatientText";

/** Clinical gating states from the ticket (A–E). */
export type ProjectionReportInclusionState =
  | "approved_for_inclusion"
  | "generated_awaiting_review"
  | "withheld_evidence_limitations"
  | "superseded"
  | "suitability_not_established"
  | "not_eligible"
  | "not_available";

export type ReportProjectionMediaRefs = {
  /** Case-scoped storage path for the approved projected image (server-resolved only). */
  projectedStoragePath: string | null;
  /** Case-scoped storage path / upload id for the canonical source image. */
  sourceImageId: string;
  sourceStoragePath: string | null;
};

/**
 * Frozen patient-facing slice embedded in PreSurgeryPlanningReport.
 * Never stores permanent public URLs or auditor correction markup.
 */
export type IllustrativeProjectedResultSection = {
  title: string;
  intro: string;
  limitationPanel: string;
  inclusionState: ProjectionReportInclusionState;
  /** Patient-safe omit explanation when imagery is not shown. */
  omitExplanation: string | null;
  /** True when visual comparison should render. */
  showImagery: boolean;
  projectionSnapshotId: string | null;
  projectionVersion: number | null;
  inputChecksum: string | null;
  outputChecksum: string | null;
  mode: PreSurgeryProjectionMode | null;
  planningModeLabel: string | null;
  patientSafeLabel: string | null;
  provisionalGraftRange: { min: number; max: number } | null;
  modelledTreatmentZones: Array<{ zone: string; priority: string; grafts: number | null }>;
  deferredZones: string[];
  keyAssumptions: string[];
  caseSpecificLimitations: string[];
  snapshotVersionLabel: string | null;
  approvalDate: string | null;
  /** Professional attribution without internal user UUIDs when possible. */
  reviewerAttribution: string | null;
  sourceImageId: string | null;
  /** Paths for authenticated server-side signing only — stripped from patient API if needed. */
  media: ReportProjectionMediaRefs | null;
  discussionOnly: boolean;
  consistencyIssues: Array<{ code: string; message: string }>;
  includedAt: string;
};

export type ResolveReportProjectionInput = {
  caseId: string;
  pathway: "pre_surgery" | string;
  projections: PreSurgeryIllustrativeProjection[];
  graftPlans: PreSurgeryGraftPlan[];
  imageReviews?: ClinicalImageReview[];
  /** Optional pin for report reissue — never silently upgrade. */
  pinnedProjectionId?: string | null;
  planningOutcomeId: PreSurgeryPlanningOutcomeId;
  stabilisationPriorityBand?: string | null;
  restorationSuitabilityBand?: string | null;
  graftEstimateRange?: { min: number; max: number } | null;
  /** Map source image id → storage path (uploads). */
  sourceStoragePathByImageId?: Record<string, string | null>;
  now?: string;
  /** When activation controls block new inclusion. */
  inclusionActivationAllowed?: boolean;
};

const MODE_PREFERENCE: PreSurgeryProjectionMode[] = [
  "planned",
  "conservative",
  "optimistic_within_approved_range",
];

const DISCUSSION_ONLY_OVERRIDE = "discussion_only_illustration";

export function isDiscussionOnlyIllustrationApproved(
  projection: PreSurgeryIllustrativeProjection
): boolean {
  if (projection.approvalOverrideReason === DISCUSSION_ONLY_OVERRIDE) return true;
  if (projection.approvalChecklist?.suitableToShare !== true) return false;
  const note = `${projection.approvalNote ?? ""} ${projection.approvalOverrideReason ?? ""}`;
  return /discussion[- ]only/i.test(note);
}

function pickPreferredProjection(
  eligible: PreSurgeryIllustrativeProjection[]
): PreSurgeryIllustrativeProjection | null {
  for (const mode of MODE_PREFERENCE) {
    const hit = eligible.find((p) => p.mode === mode);
    if (hit) return hit;
  }
  return eligible[0] ?? null;
}

function classifyAwaitingOrInternal(
  projections: PreSurgeryIllustrativeProjection[]
): ProjectionReportInclusionState | null {
  const sameCase = projections;
  if (sameCase.some((p) => p.status === "superseded" && !sameCase.some((x) => x.status === "approved"))) {
    return "superseded";
  }
  if (
    sameCase.some((p) =>
      ["generated", "clinician_review", "draft_request", "pending", "queued", "generating"].includes(p.status)
    )
  ) {
    return "generated_awaiting_review";
  }
  return null;
}

function deriveCaseSpecificLimitations(input: {
  projection: PreSurgeryIllustrativeProjection;
  graftPlan: PatientSafeGraftPlanForReport | null;
  planningOutcomeId: PreSurgeryPlanningOutcomeId;
  stabilisationPriorityBand?: string | null;
  imageReviews?: ClinicalImageReview[];
}): string[] {
  const out: string[] = [];
  const codes = new Set<CaseSpecificLimitationCode>();

  codes.add("provisional_graft_range");
  codes.add("hair_calibre_yield_unreliable");

  if (input.graftPlan?.deferredZones.includes("crown")) {
    codes.add("deferred_crown_coverage");
  }
  if (
    input.planningOutcomeId === "medical_stabilisation_recommended_first" ||
    input.stabilisationPriorityBand === "high"
  ) {
    codes.add("treatment_stabilisation_requirement");
    codes.add("progression_uncertainty");
  }
  if (
    input.graftPlan?.donorAvailabilityBand === "apparently_limited" ||
    input.graftPlan?.donorAvailabilityBand === "not_assessable"
  ) {
    codes.add("insufficient_donor_measurement");
  }

  const qualityFlags = (input.imageReviews ?? []).flatMap((r) => r.qualityFlags);
  if (
    qualityFlags.some((f) =>
      ["poor_lighting", "blur", "obstruction", "inconsistent_angle"].includes(f)
    )
  ) {
    codes.add("image_quality_limitations");
  }

  for (const lim of input.projection.limitations) {
    if (/diffuse/i.test(lim)) codes.add("diffuse_thinning");
    if (/donor/i.test(lim) && /measure|insufficient|limited/i.test(lim)) {
      codes.add("insufficient_donor_measurement");
    }
  }

  for (const code of codes) {
    out.push(CASE_SPECIFIC_LIMITATION_COPY[code]);
  }
  return out;
}

function reviewerAttribution(projection: PreSurgeryIllustrativeProjection): string | null {
  const role = projection.approvedRole?.trim();
  if (role) {
    return `Reviewed and approved by ${sanitizePatientReportText(role)}`;
  }
  if (projection.approvedBy) {
    return "Reviewed and approved by the treating clinical team";
  }
  return null;
}

function modelledZones(
  graftPlan: PatientSafeGraftPlanForReport | null,
  mode: PreSurgeryProjectionMode
): Array<{ zone: string; priority: string; grafts: number | null }> {
  if (!graftPlan) return [];
  return graftPlan.zoneSummaries.map((z) => {
    let grafts: number | null = null;
    if (z.priority === "defer") {
      grafts = 0;
    } else if (mode === "conservative") {
      grafts = z.minimumGrafts;
    } else if (mode === "planned") {
      grafts = z.targetGrafts;
    } else {
      grafts = z.maximumGrafts;
    }
    return { zone: z.zone, priority: z.priority, grafts };
  });
}

function emptySection(
  state: ProjectionReportInclusionState,
  omitExplanation: string | null,
  now: string,
  consistencyIssues: ProjectionReportConsistencyIssue[] = []
): IllustrativeProjectedResultSection {
  return {
    title: ILLUSTRATIVE_PROJECTED_RESULT_TITLE,
    intro: ILLUSTRATIVE_PROJECTED_RESULT_INTRO,
    limitationPanel: ILLUSTRATIVE_PROJECTED_RESULT_LIMITATION_PANEL,
    inclusionState: state,
    omitExplanation,
    showImagery: false,
    projectionSnapshotId: null,
    projectionVersion: null,
    inputChecksum: null,
    outputChecksum: null,
    mode: null,
    planningModeLabel: null,
    patientSafeLabel: null,
    provisionalGraftRange: null,
    modelledTreatmentZones: [],
    deferredZones: [],
    keyAssumptions: [],
    caseSpecificLimitations: [],
    snapshotVersionLabel: null,
    approvalDate: null,
    reviewerAttribution: null,
    sourceImageId: null,
    media: null,
    discussionOnly: false,
    consistencyIssues: consistencyIssues.map((i) => ({ code: i.code, message: i.message })),
    includedAt: now,
  };
}

/**
 * Resolve the single recommended approved projection for Pre-Surgery Review report inclusion.
 * Fail closed: returns a controlled omit section when ineligible.
 */
export function resolveIllustrativeProjectedResultForReport(
  input: ResolveReportProjectionInput
): IllustrativeProjectedResultSection {
  const now = input.now ?? new Date().toISOString();

  if (input.pathway !== "pre_surgery") {
    return emptySection("not_eligible", PROJECTION_NOT_INCLUDED_EXPLANATION, now);
  }

  if (input.inclusionActivationAllowed === false) {
    return emptySection("not_eligible", PROJECTION_NOT_INCLUDED_EXPLANATION, now);
  }

  const caseProjections = input.projections.filter((p) => p.caseId === input.caseId);
  const graftPlan = selectApprovedGraftPlanForReport(input.graftPlans);

  const eligible = selectReportEligibleProjections(
    caseProjections,
    graftPlan,
    input.pinnedProjectionId
  );

  if (eligible.length === 0) {
    const withheld = caseProjections.some((p) =>
      (p.limitations ?? []).some((l) => /evidence|image quality|insufficient/i.test(l))
    );
    if (withheld) {
      return emptySection("withheld_evidence_limitations", PROJECTION_WITHHELD_EVIDENCE_EXPLANATION, now);
    }
    const awaiting = classifyAwaitingOrInternal(caseProjections);
    if (awaiting === "generated_awaiting_review") {
      // Internal only — patient report omits imagery without leaking draft status details.
      return emptySection("generated_awaiting_review", PROJECTION_NOT_INCLUDED_EXPLANATION, now);
    }
    if (awaiting === "superseded") {
      return emptySection("superseded", PROJECTION_NOT_INCLUDED_EXPLANATION, now);
    }
    return emptySection("not_available", PROJECTION_NOT_INCLUDED_EXPLANATION, now);
  }

  const projection = pickPreferredProjection(eligible);
  if (!projection) {
    return emptySection("not_available", PROJECTION_NOT_INCLUDED_EXPLANATION, now);
  }

  // Source image role / orientation gate
  const sourceReview = (input.imageReviews ?? []).find((r) => r.imageId === projection.sourceImageId);
  if (sourceReview) {
    if (!isProjectionSourceRole(sourceReview.assignedRole)) {
      return emptySection("not_eligible", PROJECTION_NOT_INCLUDED_EXPLANATION, now);
    }
    if (
      sourceReview.reviewStatus === "unusable" ||
      sourceReview.reviewStatus === "replacement_requested"
    ) {
      return emptySection("withheld_evidence_limitations", PROJECTION_WITHHELD_EVIDENCE_EXPLANATION, now);
    }
  }

  if (!graftPlan) {
    return emptySection("not_eligible", PROJECTION_NOT_INCLUDED_EXPLANATION, now);
  }

  const hasZones = graftPlan.zoneSummaries.some((z) => z.priority !== "defer");
  if (!hasZones || graftPlan.totalMaximumGrafts <= 0) {
    return emptySection("not_eligible", PROJECTION_NOT_INCLUDED_EXPLANATION, now);
  }

  const discussionOnly = isDiscussionOnlyIllustrationApproved(projection);
  const consistencyIssues = validateProjectionReportConsistency({
    caseId: input.caseId,
    pathway: input.pathway,
    planningOutcomeId: input.planningOutcomeId,
    stabilisationPriorityBand: input.stabilisationPriorityBand,
    restorationSuitabilityBand: input.restorationSuitabilityBand,
    graftEstimateRange: input.graftEstimateRange ?? {
      min: graftPlan.totalMinimumGrafts,
      max: graftPlan.totalMaximumGrafts,
    },
    graftPlan,
    projection,
    discussionOnlyIllustrationApproved: discussionOnly,
  });

  if (hasBlockingConsistencyIssues(consistencyIssues)) {
    const suitBlock = consistencyIssues.some((i) => i.code === "suitability_requires_discussion_only");
    return emptySection(
      suitBlock ? "suitability_not_established" : "not_eligible",
      suitBlock ? PROJECTION_NOT_INCLUDED_EXPLANATION : PROJECTION_NOT_INCLUDED_EXPLANATION,
      now,
      consistencyIssues
    );
  }

  const sourcePath =
    input.sourceStoragePathByImageId?.[projection.sourceImageId] ?? null;

  const assumptions = [
    ...projection.planningAssumptions.map((a) => sanitizePatientReportText(a)).filter(Boolean),
  ];
  if (discussionOnly) {
    assumptions.unshift(
      "Discussion-only illustration: restoration suitability is not yet established; surgical decisions remain subject to in-person assessment."
    );
  }
  if (
    input.stabilisationPriorityBand === "high" ||
    input.planningOutcomeId === "medical_stabilisation_recommended_first"
  ) {
    assumptions.push(
      "This planning visual assumes the surgical plan later becomes clinically appropriate after stabilisation."
    );
  }

  const caseSpecificLimitations = deriveCaseSpecificLimitations({
    projection,
    graftPlan,
    planningOutcomeId: input.planningOutcomeId,
    stabilisationPriorityBand: input.stabilisationPriorityBand,
    imageReviews: input.imageReviews,
  });

  const version = projection.projectionVersion ?? 1;

  return {
    title: ILLUSTRATIVE_PROJECTED_RESULT_TITLE,
    intro: ILLUSTRATIVE_PROJECTED_RESULT_INTRO,
    limitationPanel: ILLUSTRATIVE_PROJECTED_RESULT_LIMITATION_PANEL,
    inclusionState: "approved_for_inclusion",
    omitExplanation: null,
    showImagery: true,
    projectionSnapshotId: projection.id,
    projectionVersion: version,
    inputChecksum: projection.inputChecksum,
    outputChecksum: projection.outputChecksum,
    mode: projection.mode,
    planningModeLabel: REPORT_PLANNING_MODE_LABELS[projection.mode],
    patientSafeLabel:
      sanitizePatientReportText(projection.patientSafeLabel) ||
      PRE_SURGERY_PROJECTION_PATIENT_LABELS[projection.mode],
    provisionalGraftRange: {
      min: graftPlan.totalMinimumGrafts,
      max: graftPlan.totalMaximumGrafts,
    },
    modelledTreatmentZones: modelledZones(graftPlan, projection.mode),
    deferredZones: [...graftPlan.deferredZones],
    keyAssumptions: assumptions,
    caseSpecificLimitations,
    snapshotVersionLabel: `Projection snapshot v${version}`,
    approvalDate: projection.approvedAt,
    reviewerAttribution: reviewerAttribution(projection),
    sourceImageId: projection.sourceImageId,
    media: {
      projectedStoragePath: projection.storagePath,
      sourceImageId: projection.sourceImageId,
      sourceStoragePath: sourcePath,
    },
    discussionOnly,
    consistencyIssues: consistencyIssues
      .filter((i) => i.severity === "warn")
      .map((i) => ({ code: i.code, message: i.message })),
    includedAt: now,
  };
}

/** Audit metadata for projection inclusion in a report version (no PHI). */
export function buildProjectionReportInclusionAuditMetadata(input: {
  reportId: string;
  reportVersion: number;
  section: IllustrativeProjectedResultSection;
}): Record<string, unknown> {
  return {
    reportId: input.reportId,
    reportVersion: input.reportVersion,
    projectionSnapshotId: input.section.projectionSnapshotId,
    sourceImageId: input.section.sourceImageId,
    mode: input.section.mode,
    projectionVersion: input.section.projectionVersion,
    inputChecksum: input.section.inputChecksum,
    outputChecksum: input.section.outputChecksum,
    inclusionState: input.section.inclusionState,
    showImagery: input.section.showImagery,
    includedAt: input.section.includedAt,
    discussionOnly: input.section.discussionOnly,
  };
}
