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
} {
  const matched = input.projections
    .filter((p) => projectionMatchesCurrentKey(p, input.key))
    .slice()
    .sort((a, b) => {
      const rank = statusRank(b.status) - statusRank(a.status);
      if (rank !== 0) return rank;
      return timeKey(b).localeCompare(timeKey(a));
    });

  const eligible = matched.filter(isEligibleCurrentAttempt);
  const current = eligible[0] ?? null;
  const historical = matched.filter((p) => p.id !== current?.id);

  return { current, historical };
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
