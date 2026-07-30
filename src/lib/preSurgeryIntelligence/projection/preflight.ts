/**
 * HA-PRE-SURGERY-INTELLIGENCE-2D — Preflight verification before ImagingOS contact.
 *
 * A failed preflight creates an auditable rejection without contacting the provider.
 */

import type {
  ClinicalImageAnnotation,
  ClinicalImageReview,
  ClinicalObservation,
  PreSurgeryGraftPlan,
  PreSurgeryProjectionMode,
} from "../types";
import { isProjectionSourceRole } from "../imageRoles";
import { canGenerateProjectionFromPlan } from "../graftPlanTotals";
import {
  decideProjectionActivation,
  type ActivationDecision,
  type ProjectionActivationControls,
} from "./activationControls";
import type { ProjectionProviderHealth } from "./health";

export type PreflightCheckCode =
  | "case_not_pre_surgery"
  | "professional_not_authorised"
  | "source_images_missing"
  | "image_corrections_incomplete"
  | "graft_plan_not_current"
  | "checksum_mismatch"
  | "mode_not_enabled"
  | "provider_unhealthy"
  | "generation_limit_exceeded"
  | "consent_or_policy_unsatisfied"
  | "activation_denied"
  | "required_images_missing"
  | "source_image_unusable";

export type PreflightCheckResult = {
  code: PreflightCheckCode | string;
  passed: boolean;
  message: string;
};

export type PreflightInput = {
  casePathway: string | null | undefined;
  professionalAuthorised: boolean;
  professionalAssigned: boolean;
  sourceReviews: ClinicalImageReview[];
  primarySourceImageId: string;
  /** Upload rows that still exist for source image IDs. */
  existingSourceImageIds: string[];
  /** Required pathway upload completeness. */
  requiredImagesPresent: boolean;
  /** True when pending role/orientation corrections remain open. */
  pendingImageCorrections: boolean;
  approvedPlan: PreSurgeryGraftPlan | null;
  /** Plan id/version the request intends to use. */
  intendedPlanId: string;
  intendedPlanVersion: number;
  intendedPlanChecksum: string;
  /** Checksum of the immutable snapshot the caller intends to send. */
  intendedInputChecksum: string;
  /** Freshly computed checksum of the canonical request about to be sent. */
  computedInputChecksum: string;
  mode: PreSurgeryProjectionMode;
  providerHealth: ProjectionProviderHealth;
  activation: {
    controls: ProjectionActivationControls;
    providerKind: "stub" | "imagingos" | "disabled";
    clinicId: string | null;
    clinicianId: string;
    caseId: string;
    requestsForCase: number;
    requestsToday: number;
    caseLevelEnabled: boolean;
  };
  /** Clinic policy + patient consent satisfied for generation (not necessarily sharing). */
  clinicPolicySatisfied: boolean;
  patientGenerationConsentSatisfied: boolean;
  approvedAnnotations: ClinicalImageAnnotation[];
  approvedObservations: ClinicalObservation[];
};

export type PreflightOutcome =
  | {
      ok: true;
      checks: PreflightCheckResult[];
      activation: Extract<ActivationDecision, { allowed: true }>;
      contactedProvider: false;
    }
  | {
      ok: false;
      checks: PreflightCheckResult[];
      failures: PreflightCheckResult[];
      /** Always false — preflight never contacts ImagingOS. */
      contactedProvider: false;
      auditEventType: "projection_preflight_rejected";
      auditMetadata: Record<string, unknown>;
    };

function check(
  code: PreflightCheckCode | string,
  passed: boolean,
  message: string
): PreflightCheckResult {
  return { code, passed, message };
}

/**
 * Run all 2D preflight checks. On failure, callers must persist an auditable
 * rejection and must not invoke the projection provider.
 */
export function runProjectionPreflight(input: PreflightInput): PreflightOutcome {
  const checks: PreflightCheckResult[] = [];

  checks.push(
    check(
      "case_not_pre_surgery",
      input.casePathway === "pre_surgery",
      input.casePathway === "pre_surgery"
        ? "Case is on the pre_surgery pathway"
        : "Case is not pre_surgery"
    )
  );

  checks.push(
    check(
      "professional_not_authorised",
      input.professionalAuthorised && input.professionalAssigned,
      input.professionalAuthorised && input.professionalAssigned
        ? "Professional remains assigned and authorised"
        : "Professional is not assigned or not authorised"
    )
  );

  const primaryExists = input.existingSourceImageIds.includes(input.primarySourceImageId);
  const allSourcesExist = input.sourceReviews.every((r) =>
    input.existingSourceImageIds.includes(r.imageId)
  );
  checks.push(
    check(
      "source_images_missing",
      primaryExists && allSourcesExist,
      primaryExists && allSourcesExist
        ? "Source images still exist"
        : "One or more source images are missing"
    )
  );

  checks.push(
    check(
      "required_images_missing",
      input.requiredImagesPresent,
      input.requiredImagesPresent
        ? "Required pathway images are present"
        : "Required pathway images are incomplete"
    )
  );

  checks.push(
    check(
      "image_corrections_incomplete",
      !input.pendingImageCorrections,
      input.pendingImageCorrections
        ? "Required image corrections are incomplete"
        : "Required image corrections are complete"
    )
  );

  const primary = input.sourceReviews.find((r) => r.imageId === input.primarySourceImageId);
  const sourceOk =
    primary != null &&
    isProjectionSourceRole(primary.assignedRole) &&
    primary.reviewStatus !== "unusable" &&
    primary.reviewStatus !== "replacement_requested";
  checks.push(
    check(
      "source_image_unusable",
      sourceOk,
      sourceOk
        ? "Primary source image is eligible"
        : "Primary source image is unusable or ineligible"
    )
  );

  const planCurrent =
    input.approvedPlan != null &&
    input.approvedPlan.status === "approved" &&
    canGenerateProjectionFromPlan(input.approvedPlan) &&
    input.approvedPlan.id === input.intendedPlanId &&
    input.approvedPlan.version === input.intendedPlanVersion &&
    input.approvedPlan.checksum === input.intendedPlanChecksum;
  checks.push(
    check(
      "graft_plan_not_current",
      planCurrent,
      planCurrent
        ? "Approved graft-plan version remains current"
        : "Approved graft-plan version is not current"
    )
  );

  const checksumOk =
    Boolean(input.intendedInputChecksum) &&
    input.intendedInputChecksum === input.computedInputChecksum;
  checks.push(
    check(
      "checksum_mismatch",
      checksumOk,
      checksumOk
        ? "Immutable snapshot checksum matches the intended request"
        : "Immutable snapshot checksum does not match the intended request"
    )
  );

  const activation = decideProjectionActivation({
    controls: input.activation.controls,
    providerKind: input.activation.providerKind,
    clinicId: input.activation.clinicId,
    clinicianId: input.activation.clinicianId,
    caseId: input.activation.caseId,
    mode: input.mode,
    requestsForCase: input.activation.requestsForCase,
    requestsToday: input.activation.requestsToday,
    caseLevelEnabled: input.activation.caseLevelEnabled,
  });

  if (!activation.allowed) {
    checks.push(
      check(
        activation.code === "mode_not_allowlisted" ? "mode_not_enabled" : "activation_denied",
        false,
        activation.message
      )
    );
    if (
      activation.code === "case_generation_ceiling" ||
      activation.code === "daily_generation_ceiling"
    ) {
      checks.push(
        check("generation_limit_exceeded", false, activation.message)
      );
    }
  } else {
    checks.push(check("activation_denied", true, "Activation controls allow generation"));
    checks.push(
      check(
        "mode_not_enabled",
        true,
        `Projection mode "${input.mode}" is enabled`
      )
    );
  }

  checks.push(
    check(
      "provider_unhealthy",
      input.providerHealth.healthy,
      input.providerHealth.healthy
        ? "Provider is healthy"
        : input.providerHealth.detail || "Provider health check failed"
    )
  );

  const consentOk =
    input.clinicPolicySatisfied && input.patientGenerationConsentSatisfied;
  checks.push(
    check(
      "consent_or_policy_unsatisfied",
      consentOk,
      consentOk
        ? "Patient consent and clinic policy requirements are satisfied"
        : "Patient consent or clinic policy requirements are not satisfied"
    )
  );

  // Annotations / observations are informational for preflight completeness —
  // generation still requires approved plan; empty approved sets are allowed
  // when the plan itself encodes zones.
  void input.approvedAnnotations;
  void input.approvedObservations;

  const failures = checks.filter((c) => !c.passed);
  if (failures.length > 0 || !activation.allowed) {
    const uniqueFailures =
      failures.length > 0
        ? failures
        : [
            check(
              "activation_denied",
              false,
              !activation.allowed ? activation.message : "Preflight failed"
            ),
          ];
    return {
      ok: false,
      checks,
      failures: uniqueFailures,
      contactedProvider: false,
      auditEventType: "projection_preflight_rejected",
      auditMetadata: {
        codes: uniqueFailures.map((f) => f.code),
        messages: uniqueFailures.map((f) => f.message),
        contactedProvider: false,
        mode: input.mode,
        caseId: input.activation.caseId,
      },
    };
  }

  return {
    ok: true,
    checks,
    activation,
    contactedProvider: false,
  };
}
