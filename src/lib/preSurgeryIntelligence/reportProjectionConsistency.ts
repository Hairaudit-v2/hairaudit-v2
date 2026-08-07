/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — Report ↔ projection consistency validator.
 * Material conflicts block projection inclusion (fail closed); the base report may still publish.
 */

import type { PreSurgeryPlanningOutcomeId } from "@/lib/reports/preSurgeryPlanningReport";
import type { PatientSafeGraftPlanForReport } from "./reportIntegration";
import type { PreSurgeryIllustrativeProjection } from "./types";
import { findForbiddenProjectionReportLanguage } from "./reportProjectionCopy";

export type ProjectionReportConsistencyIssue = {
  code:
    | "pathway_mismatch"
    | "case_mismatch"
    | "graft_range_mismatch"
    | "deferred_zone_mismatch"
    | "zone_plan_mismatch"
    | "suitability_requires_discussion_only"
    | "stabilisation_context_missing"
    | "unsafe_patient_copy"
    | "superseded_or_withdrawn"
    | "unapproved_status"
    | "sharing_disabled"
    | "validation_incomplete";
  severity: "block" | "warn";
  message: string;
};

export type ProjectionReportConsistencyInput = {
  caseId: string;
  pathway: "pre_surgery" | string;
  planningOutcomeId: PreSurgeryPlanningOutcomeId;
  stabilisationPriorityBand?: string | null;
  restorationSuitabilityBand?: string | null;
  graftEstimateRange?: { min: number; max: number } | null;
  graftPlan: PatientSafeGraftPlanForReport | null;
  projection: PreSurgeryIllustrativeProjection;
  /** Explicit clinician approval for discussion-only illustration when suitability is not established. */
  discussionOnlyIllustrationApproved: boolean;
};

const NOT_RECOMMENDED_YET_OUTCOMES: ReadonlySet<PreSurgeryPlanningOutcomeId> = new Set([
  "medical_stabilisation_recommended_first",
  "further_professional_review_recommended",
]);

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) if (!sa.has(x)) return false;
  return true;
}

/**
 * Validate projection content against the report planning outcome.
 * Returns blocking issues when inclusion must be refused.
 */
export function validateProjectionReportConsistency(
  input: ProjectionReportConsistencyInput
): ProjectionReportConsistencyIssue[] {
  const issues: ProjectionReportConsistencyIssue[] = [];
  const { projection, graftPlan } = input;

  if (input.pathway !== "pre_surgery") {
    issues.push({
      code: "pathway_mismatch",
      severity: "block",
      message: "Only pre_surgery pathway reports may include illustrative projections",
    });
  }

  if (projection.caseId !== input.caseId) {
    issues.push({
      code: "case_mismatch",
      severity: "block",
      message: "Projection does not belong to this case",
    });
  }

  if (projection.status === "superseded" || projection.supersededAt) {
    issues.push({
      code: "superseded_or_withdrawn",
      severity: "block",
      message: "Superseded or withdrawn projections cannot enter the report",
    });
  }

  if (projection.status !== "approved") {
    issues.push({
      code: "unapproved_status",
      severity: "block",
      message: `Projection status ${projection.status} is not eligible for patient report inclusion`,
    });
  }

  if (projection.patientSharingEnabled !== true) {
    issues.push({
      code: "sharing_disabled",
      severity: "block",
      message: "Patient sharing is not enabled for this projection",
    });
  }

  const failedChecks = (projection.validationPass ?? []).filter((c) => !c.passed);
  if (failedChecks.length > 0) {
    issues.push({
      code: "validation_incomplete",
      severity: "block",
      message: `Projection safety checks failed: ${failedChecks.map((c) => c.check).join(", ")}`,
    });
  }

  if (graftPlan) {
    if (
      projection.graftPlanId !== graftPlan.graftPlanId ||
      projection.graftPlanVersion !== graftPlan.graftPlanVersion
    ) {
      issues.push({
        code: "zone_plan_mismatch",
        severity: "block",
        message: "Projection graft-plan version does not match the report planning snapshot",
      });
    }

    const reportDeferred = [...graftPlan.deferredZones].sort();
    const planDeferred = [...graftPlan.deferredZones].sort();
    if (!setsEqual(reportDeferred, planDeferred)) {
      // Same source — retained for explicit zone alignment checks below via zoneSummaries.
    }

    // Prefer the approved graft-plan snapshot as the displayed band. A preliminary AI
    // estimate that differs must not block inclusion of a clinician-approved illustration.
    if (
      input.graftEstimateRange &&
      (input.graftEstimateRange.min !== graftPlan.totalMinimumGrafts ||
        input.graftEstimateRange.max !== graftPlan.totalMaximumGrafts)
    ) {
      issues.push({
        code: "graft_range_mismatch",
        severity: "warn",
        message:
          "Preliminary graft estimate differs from the approved planning snapshot; report display should prefer the approved plan",
      });
    }

    // Deferred zones on the approved plan must remain deferred in the projection assumptions/limitations.
    for (const zone of graftPlan.deferredZones) {
      const zoneLower = zone.toLowerCase();
      const filledClaim = [...projection.limitations, ...projection.planningAssumptions].some((t) =>
        /filled|restored densit|full coverage/i.test(t) && t.toLowerCase().includes(zoneLower)
      );
      if (filledClaim) {
        issues.push({
          code: "deferred_zone_mismatch",
          severity: "block",
          message: `Deferred zone ${zone} must not be presented as restored coverage`,
        });
      }
    }
  }

  const suitabilityNotEstablished =
    NOT_RECOMMENDED_YET_OUTCOMES.has(input.planningOutcomeId) ||
    input.restorationSuitabilityBand === "caution" ||
    input.restorationSuitabilityBand === "limited";

  if (suitabilityNotEstablished && !input.discussionOnlyIllustrationApproved) {
    issues.push({
      code: "suitability_requires_discussion_only",
      severity: "block",
      message:
        "Suitability is not established — discussion-only illustration requires explicit clinician approval before report inclusion",
    });
  }

  if (
    (input.stabilisationPriorityBand === "high" ||
      input.planningOutcomeId === "medical_stabilisation_recommended_first") &&
    !input.discussionOnlyIllustrationApproved
  ) {
    const mentionsStabilisation = [...projection.limitations, ...projection.planningAssumptions].some((t) =>
      /stabilisation|stabilization|assumes.*surgical plan later|clinically appropriate/i.test(t)
    );
    if (!mentionsStabilisation) {
      issues.push({
        code: "stabilisation_context_missing",
        severity: "warn",
        message:
          "High stabilisation priority: projection should state that the surgical plan later becomes clinically appropriate",
      });
    }
  }

  for (const text of [
    projection.patientSafeLabel,
    projection.patientSafeDisclaimer ?? "",
    ...projection.limitations,
    ...projection.planningAssumptions,
  ]) {
    const hit = findForbiddenProjectionReportLanguage(text);
    if (hit) {
      issues.push({
        code: "unsafe_patient_copy",
        severity: "block",
        message: `Unsafe patient-facing projection language: ${hit}`,
      });
      break;
    }
  }

  return issues;
}

export function hasBlockingConsistencyIssues(
  issues: ProjectionReportConsistencyIssue[]
): boolean {
  return issues.some((i) => i.severity === "block");
}
