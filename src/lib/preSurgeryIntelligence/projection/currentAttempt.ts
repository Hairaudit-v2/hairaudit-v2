/**
 * HA projection UX regression — select one current generation per clinical key.
 */

import type { PreSurgeryIllustrativeProjection, PreSurgeryProjectionMode } from "../types";
import { classifyProjectionStoragePath } from "../projectionAssetStatus";
import {
  resolveProjectionArtifactType,
  type PreSurgeryArtifactType,
} from "./artifactTypes";

export type CurrentAttemptKey = {
  graftPlanId: string;
  graftPlanVersion: number;
  sourceImageId: string;
  mode: PreSurgeryProjectionMode;
  artifactType: PreSurgeryArtifactType;
  /** Approved hairline design version when known (outcomes). */
  hairlineDesignVersion?: number | null;
};

/** Precise empty-state reasons when no eligible current generation hydrates. */
export type NoCurrentAttemptReason =
  | "no_completed_generation"
  | "latest_attempt_rejected"
  | "latest_attempt_failed"
  | "source_asset_unavailable"
  | "signed_url_unavailable"
  | "generation_superseded"
  | "no_attempt_matches_key";

export const NO_CURRENT_ATTEMPT_MESSAGES: Record<NoCurrentAttemptReason, string> = {
  no_completed_generation: "No completed generation for this plan · hairline · source · view · mode.",
  latest_attempt_rejected: "Latest attempt was rejected — it is not eligible as the current candidate.",
  latest_attempt_failed: "Latest attempt failed — it is not eligible as the current candidate.",
  source_asset_unavailable: "Source asset unavailable for the matched generation.",
  signed_url_unavailable: "Signed URL unavailable for the current generation asset.",
  generation_superseded: "Latest generation was superseded — it is not eligible as the current candidate.",
  no_attempt_matches_key:
    "No attempt matches the current plan · hairline · source · view · mode.",
};

const CURRENT_ELIGIBLE = new Set([
  "approved",
  "clinician_review",
  "generated",
]);

const NEVER_CURRENT = new Set([
  "rejected",
  "validation_failed",
  "failed",
  "superseded",
  "expired",
  "pending",
  "queued",
  "generating",
  "draft_request",
]);

const ARTIFACT_HYDRATION_PRIORITY: PreSurgeryArtifactType[] = [
  "illustrative_projected_outcome",
  "proposed_hairline_design",
  "graft_allocation_map",
];

function artifactOf(p: PreSurgeryIllustrativeProjection): PreSurgeryArtifactType {
  return resolveProjectionArtifactType({
    artifactType: p.artifactType,
    providerId: p.providerId,
  });
}

function isStub(p: PreSurgeryIllustrativeProjection): boolean {
  return classifyProjectionStoragePath(p.storagePath).kind === "stub_placeholder";
}

function statusRank(status: string): number {
  if (status === "approved") return 3;
  if (status === "clinician_review") return 2;
  if (status === "generated") return 1;
  return 0;
}

function timeKey(p: PreSurgeryIllustrativeProjection): string {
  return p.generatedAt ?? p.requestedAt ?? "";
}

function sortMatched(a: PreSurgeryIllustrativeProjection, b: PreSurgeryIllustrativeProjection): number {
  const rank = statusRank(b.status) - statusRank(a.status);
  if (rank !== 0) return rank;
  return timeKey(b).localeCompare(timeKey(a));
}

export function isEligibleCurrentAttempt(p: PreSurgeryIllustrativeProjection): boolean {
  if (NEVER_CURRENT.has(p.status)) return false;
  if (!CURRENT_ELIGIBLE.has(p.status)) return false;
  if (isStub(p)) return false;
  if (!p.storagePath) return false;
  return true;
}

export function projectionMatchesCurrentKey(
  p: PreSurgeryIllustrativeProjection,
  key: CurrentAttemptKey
): boolean {
  if (p.graftPlanId !== key.graftPlanId) return false;
  if (p.graftPlanVersion !== key.graftPlanVersion) return false;
  if (p.sourceImageId !== key.sourceImageId) return false;
  if (p.mode !== key.mode) return false;
  if (artifactOf(p) !== key.artifactType) return false;
  if (
    key.artifactType === "illustrative_projected_outcome" &&
    key.hairlineDesignVersion != null
  ) {
    const snap = p.inputSnapshot as { hairlineGate?: { hairlineVersion?: number } } | null;
    const v = snap?.hairlineGate?.hairlineVersion;
    if (v != null && v !== key.hairlineDesignVersion) return false;
  }
  return true;
}

export function selectCurrentProjectionAttempt(input: {
  projections: PreSurgeryIllustrativeProjection[];
  key: CurrentAttemptKey;
}): {
  current: PreSurgeryIllustrativeProjection | null;
  historical: PreSurgeryIllustrativeProjection[];
  matched: PreSurgeryIllustrativeProjection[];
} {
  const matched = input.projections
    .filter((p) => projectionMatchesCurrentKey(p, input.key))
    .slice()
    .sort(sortMatched);

  const eligible = matched.filter(isEligibleCurrentAttempt);
  const current = eligible[0] ?? null;
  const historical = matched.filter((p) => p.id !== current?.id);

  return { current, historical, matched };
}

/**
 * When opening the workspace, pick the strongest artifact that already has an
 * eligible current generation so the canvas hydrates without a thumbnail click.
 */
export function pickHydrationArtifactType(input: {
  projections: PreSurgeryIllustrativeProjection[];
  baseKey: Omit<CurrentAttemptKey, "artifactType">;
  preferred?: PreSurgeryArtifactType | null;
}): PreSurgeryArtifactType {
  if (input.preferred) {
    const preferredHit = selectCurrentProjectionAttempt({
      projections: input.projections,
      key: { ...input.baseKey, artifactType: input.preferred },
    }).current;
    if (preferredHit) return input.preferred;
  }
  for (const artifactType of ARTIFACT_HYDRATION_PRIORITY) {
    const hit = selectCurrentProjectionAttempt({
      projections: input.projections,
      key: { ...input.baseKey, artifactType },
    }).current;
    if (hit) return artifactType;
  }
  return input.preferred ?? "illustrative_projected_outcome";
}

export type ProjectionMediaDiagnostic = {
  sourceSignedUrl?: string | null;
  projectedSignedUrl?: string | null;
  loadError?: string | null;
  assetKind?: string | null;
};

/**
 * Diagnose why no eligible current candidate hydrates into the canvas.
 * Returns null when an eligible current attempt exists (asset URL issues are separate).
 */
export function diagnoseNoCurrentAttempt(input: {
  projections: PreSurgeryIllustrativeProjection[];
  key: CurrentAttemptKey;
  media?: ProjectionMediaDiagnostic | null;
}): {
  reason: NoCurrentAttemptReason;
  message: string;
  latestMatched: PreSurgeryIllustrativeProjection | null;
} | null {
  const { current, matched } = selectCurrentProjectionAttempt({
    projections: input.projections,
    key: input.key,
  });

  if (current) return null;

  const latest = matched[0] ?? null;
  if (!latest) {
    const anySameMode = input.projections.some(
      (p) =>
        p.graftPlanId === input.key.graftPlanId &&
        p.mode === input.key.mode &&
        artifactOf(p) === input.key.artifactType
    );
    return {
      reason: anySameMode || input.projections.length > 0 ? "no_attempt_matches_key" : "no_completed_generation",
      message:
        anySameMode || input.projections.length > 0
          ? NO_CURRENT_ATTEMPT_MESSAGES.no_attempt_matches_key
          : NO_CURRENT_ATTEMPT_MESSAGES.no_completed_generation,
      latestMatched: null,
    };
  }

  if (latest.status === "rejected") {
    return {
      reason: "latest_attempt_rejected",
      message: NO_CURRENT_ATTEMPT_MESSAGES.latest_attempt_rejected,
      latestMatched: latest,
    };
  }
  if (latest.status === "failed" || latest.status === "validation_failed") {
    return {
      reason: "latest_attempt_failed",
      message: NO_CURRENT_ATTEMPT_MESSAGES.latest_attempt_failed,
      latestMatched: latest,
    };
  }
  if (latest.status === "superseded") {
    return {
      reason: "generation_superseded",
      message: NO_CURRENT_ATTEMPT_MESSAGES.generation_superseded,
      latestMatched: latest,
    };
  }
  if (isStub(latest) || !latest.storagePath) {
    return {
      reason: "source_asset_unavailable",
      message: NO_CURRENT_ATTEMPT_MESSAGES.source_asset_unavailable,
      latestMatched: latest,
    };
  }
  if (input.media?.loadError || (input.media && !input.media.projectedSignedUrl)) {
    return {
      reason: "signed_url_unavailable",
      message: NO_CURRENT_ATTEMPT_MESSAGES.signed_url_unavailable,
      latestMatched: latest,
    };
  }
  if (NEVER_CURRENT.has(latest.status)) {
    return {
      reason: "no_completed_generation",
      message: NO_CURRENT_ATTEMPT_MESSAGES.no_completed_generation,
      latestMatched: latest,
    };
  }
  return {
    reason: "no_completed_generation",
    message: NO_CURRENT_ATTEMPT_MESSAGES.no_completed_generation,
    latestMatched: latest,
  };
}

/** Asset / signed-URL diagnostics for an already-selected attempt. */
export function diagnoseProjectionMedia(
  media: ProjectionMediaDiagnostic | null | undefined
): { reason: "signed_url_unavailable" | "source_asset_unavailable"; message: string } | null {
  if (!media) {
    return {
      reason: "signed_url_unavailable",
      message: NO_CURRENT_ATTEMPT_MESSAGES.signed_url_unavailable,
    };
  }
  if (media.loadError || !media.projectedSignedUrl) {
    return {
      reason: "signed_url_unavailable",
      message: NO_CURRENT_ATTEMPT_MESSAGES.signed_url_unavailable,
    };
  }
  if (!media.sourceSignedUrl) {
    return {
      reason: "source_asset_unavailable",
      message: NO_CURRENT_ATTEMPT_MESSAGES.source_asset_unavailable,
    };
  }
  return null;
}

/** Clinical role label for attempt chips — never confuses historical with current. */
export function attemptRoleLabel(input: {
  attempt: PreSurgeryIllustrativeProjection;
  currentId: string | null;
  viewingHistorical: boolean;
}): string {
  if (input.viewingHistorical && input.attempt.id !== input.currentId) {
    return "Historical";
  }
  if (input.currentId && input.attempt.id === input.currentId) {
    return "Current candidate";
  }
  if (input.attempt.status === "approved") return "Approved";
  if (input.attempt.status === "rejected") return "Rejected";
  if (input.attempt.status === "failed" || input.attempt.status === "validation_failed") {
    return "Failed";
  }
  if (input.attempt.status === "superseded") return "Superseded";
  return "Historical";
}

/** Extract generation latency (ms) from snapshot / planning assumptions when present. */
export function readGenerationLatencyMs(
  p: PreSurgeryIllustrativeProjection
): number | null {
  const snap = p.inputSnapshot as { generationLatencyMs?: unknown } | null | undefined;
  if (typeof snap?.generationLatencyMs === "number" && Number.isFinite(snap.generationLatencyMs)) {
    return snap.generationLatencyMs;
  }
  for (const a of p.planningAssumptions ?? []) {
    const m = /^latencyMs=(\d+)$/.exec(a);
    if (m) return Number(m[1]);
  }
  return null;
}

export function readMaskStoragePath(p: PreSurgeryIllustrativeProjection): string | null {
  const snap = p.inputSnapshot as { maskStoragePath?: unknown } | null | undefined;
  if (typeof snap?.maskStoragePath === "string" && snap.maskStoragePath.trim()) {
    return snap.maskStoragePath.trim();
  }
  for (const a of p.planningAssumptions ?? []) {
    const m = /^maskStoragePath=(.+)$/.exec(a);
    if (m) return m[1]!.trim();
  }
  return null;
}

export function hairAuditDecisionLabel(p: PreSurgeryIllustrativeProjection): string {
  if (p.status === "approved") return "Approved";
  if (p.status === "rejected") {
    return p.rejectionReason
      ? `Rejected — ${p.rejectionReason}`
      : "Rejected";
  }
  if (p.status === "validation_failed" || p.status === "failed") {
    return p.failureMessage
      ? `Technically rejected — ${p.failureMessage}`
      : "Technically rejected";
  }
  if (p.status === "clinician_review" || p.status === "generated") {
    return "Pending clinician review";
  }
  if (p.status === "superseded") return "Superseded";
  return clinicianLifecycleFallback(p.status);
}

function clinicianLifecycleFallback(status: string): string {
  return status.replaceAll("_", " ");
}

export function technicalValidationVerdict(
  p: PreSurgeryIllustrativeProjection
): "pass" | "fail" | "pending" | "n/a" {
  const snap = p.inputSnapshot as {
    outcomeValidation?: { ok?: boolean } | Record<string, unknown>;
  } | null;
  const ov = snap?.outcomeValidation;
  if (ov && typeof ov === "object" && "ok" in ov && typeof (ov as { ok?: boolean }).ok === "boolean") {
    return (ov as { ok: boolean }).ok ? "pass" : "fail";
  }
  if (p.status === "validation_failed") return "fail";
  if (p.validationPass?.length) {
    return p.validationPass.every((v) => v.passed) ? "pass" : "fail";
  }
  if (p.status === "approved" || p.status === "clinician_review" || p.status === "generated") {
    return "pending";
  }
  return "n/a";
}
