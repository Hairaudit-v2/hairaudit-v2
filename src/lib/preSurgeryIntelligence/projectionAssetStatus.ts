/**
 * HA-PRE-SURGERY-PROJECTION-VISIBILITY-FIX — Classify projection storage assets for clinician UX.
 * Distinguishes stub placeholders from real imagery without fabricating assets.
 */

export type ProjectionAssetKind =
  | "missing_path"
  | "stub_placeholder"
  | "image"
  | "load_error";

export type ProjectionAssetDisplay = {
  kind: ProjectionAssetKind;
  storagePath: string | null;
  /** Human-readable lifecycle message for clinician UI. */
  message: string;
  /** True when a signed image URL should be attempted / shown. */
  canAttemptSignedUrl: boolean;
};

export function classifyProjectionStoragePath(
  storagePath: string | null | undefined
): ProjectionAssetDisplay {
  const path = typeof storagePath === "string" ? storagePath.trim() : "";
  if (!path) {
    return {
      kind: "missing_path",
      storagePath: null,
      message: "No storage path recorded for this projection.",
      canAttemptSignedUrl: false,
    };
  }
  if (/\.stub$/i.test(path) || path.includes("/stub/") || path.endsWith(".stub")) {
    return {
      kind: "stub_placeholder",
      storagePath: path,
      message:
        "Generation used the stub provider — a planning checksum was stored, but no illustrative image file exists yet.",
      canAttemptSignedUrl: false,
    };
  }
  return {
    kind: "image",
    storagePath: path,
    message: "Illustrative projected-result asset is available.",
    canAttemptSignedUrl: true,
  };
}

export function projectionMatchesCurrentPlan(input: {
  projectionGraftPlanId: string;
  projectionGraftPlanVersion: number;
  currentApprovedPlanId: string | null;
  currentApprovedPlanVersion: number | null;
}): { matches: boolean; reason: string | null } {
  if (!input.currentApprovedPlanId || input.currentApprovedPlanVersion == null) {
    return { matches: false, reason: "No approved graft plan on this case." };
  }
  if (input.projectionGraftPlanId !== input.currentApprovedPlanId) {
    return {
      matches: false,
      reason: `Tied to a different graft plan (v${input.projectionGraftPlanVersion}); current approved plan is v${input.currentApprovedPlanVersion}.`,
    };
  }
  if (input.projectionGraftPlanVersion !== input.currentApprovedPlanVersion) {
    return {
      matches: false,
      reason: `Tied to superseded plan v${input.projectionGraftPlanVersion}; current approved plan is v${input.currentApprovedPlanVersion}.`,
    };
  }
  return { matches: true, reason: null };
}

export function clinicianProjectionLifecycleLabel(status: string): string {
  switch (status) {
    case "approved":
      return "Clinically approved";
    case "clinician_review":
    case "generated":
      return "Awaiting clinical approval";
    case "failed":
      return "Generation failed";
    case "validation_failed":
      return "Validation failed";
    case "rejected":
      return "Rejected";
    case "superseded":
      return "Superseded";
    case "queued":
    case "generating":
    case "pending":
    case "draft_request":
      return "Generation in progress";
    default:
      return status.replaceAll("_", " ");
  }
}
