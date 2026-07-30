/**
 * HA-PRE-SURGERY-INTELLIGENCE-2D — Professional operations dashboard aggregation.
 */

import type { PreSurgeryIllustrativeProjection } from "../types";
import {
  summariseProjectionMetrics,
  type ProjectionMetricSample,
  type ProjectionMetricsSummary,
} from "./metrics";
import type { ProjectionProviderHealth } from "./health";
import type { ProjectionStaleReason } from "./staleness";

export type OpsRejectionReasonCount = {
  reasonCode: string;
  count: number;
};

export type ProjectionOpsDashboard = {
  providerHealth: ProjectionProviderHealth | null;
  queuedCount: number;
  generatingCount: number;
  failedCount: number;
  timedOutCount: number;
  awaitingClinicianReviewCount: number;
  approvalCount: number;
  rejectionCount: number;
  approvalRate: number | null;
  rejectionRate: number | null;
  commonRejectionReasons: OpsRejectionReasonCount[];
  medianGenerationTimeMs: number | null;
  casesWithStaleApprovedProjections: number;
  patientSharedProjectionCount: number;
  reportsPinnedToProjections: number;
  providerVersionsInUse: string[];
  modelVersionsInUse: string[];
  metrics: ProjectionMetricsSummary;
  shadowModeActive: boolean;
  patientSharingKillSwitch: boolean;
  providerKillSwitch: boolean;
};

export type OpsDashboardInput = {
  projections: PreSurgeryIllustrativeProjection[];
  samples: ProjectionMetricSample[];
  providerHealth?: ProjectionProviderHealth | null;
  /** Case IDs that have at least one stale approved projection. */
  staleApprovedCaseIds?: string[];
  /** Count of reports currently pinned to a projection. */
  reportsPinnedCount?: number;
  timedOutAttemptCount?: number;
  shadowModeActive?: boolean;
  patientSharingKillSwitch?: boolean;
  providerKillSwitch?: boolean;
};

export function buildProjectionOpsDashboard(input: OpsDashboardInput): ProjectionOpsDashboard {
  const { projections } = input;
  const queuedCount = projections.filter((p) => p.status === "queued").length;
  const generatingCount = projections.filter((p) => p.status === "generating").length;
  const failedCount = projections.filter((p) => p.status === "failed").length;
  const awaitingClinicianReviewCount = projections.filter(
    (p) => p.status === "clinician_review" || p.status === "generated"
  ).length;
  const approvalCount = projections.filter((p) => p.status === "approved").length;
  const rejectionCount = projections.filter((p) => p.status === "rejected").length;
  const decided = approvalCount + rejectionCount;
  const reasonMap = new Map<string, number>();
  for (const p of projections) {
    if (p.status !== "rejected") continue;
    const code = p.rejectionReasonCode ?? "other_safety_concern";
    reasonMap.set(code, (reasonMap.get(code) ?? 0) + 1);
  }
  const commonRejectionReasons = [...reasonMap.entries()]
    .map(([reasonCode, count]) => ({ reasonCode, count }))
    .sort((a, b) => b.count - a.count);

  const providerVersions = new Set<string>();
  const modelVersions = new Set<string>();
  for (const p of projections) {
    if (p.providerId) providerVersions.add(p.providerId);
    if (p.providerModelVersion) modelVersions.add(p.providerModelVersion);
  }

  const metrics = summariseProjectionMetrics(input.samples);
  const patientSharedProjectionCount = projections.filter(
    (p) => p.status === "approved" && p.patientSharingEnabled === true && !p.staleAt
  ).length;

  return {
    providerHealth: input.providerHealth ?? null,
    queuedCount,
    generatingCount,
    failedCount,
    timedOutCount: input.timedOutAttemptCount ?? projections.filter((p) => p.failureCode === "provider_timeout").length,
    awaitingClinicianReviewCount,
    approvalCount,
    rejectionCount,
    approvalRate: decided > 0 ? approvalCount / decided : null,
    rejectionRate: decided > 0 ? rejectionCount / decided : null,
    commonRejectionReasons,
    medianGenerationTimeMs: metrics.medianLatencyMs,
    casesWithStaleApprovedProjections: new Set(input.staleApprovedCaseIds ?? []).size,
    patientSharedProjectionCount,
    reportsPinnedToProjections: input.reportsPinnedCount ?? 0,
    providerVersionsInUse: [...providerVersions].sort(),
    modelVersionsInUse: [...modelVersions].sort(),
    metrics,
    shadowModeActive: input.shadowModeActive === true,
    patientSharingKillSwitch: input.patientSharingKillSwitch === true,
    providerKillSwitch: input.providerKillSwitch === true,
  };
}

export function collectStaleApprovedCaseIds(
  projections: PreSurgeryIllustrativeProjection[],
  isStale: (p: PreSurgeryIllustrativeProjection) => boolean
): string[] {
  const ids = new Set<string>();
  for (const p of projections) {
    if (p.status === "approved" && isStale(p)) ids.add(p.caseId);
  }
  return [...ids];
}

export type DocumentedQualityReviewOutcome = {
  cohortCategory: string;
  projectionId: string;
  decision: "approved" | "rejected";
  rejectionReasonCode?: string | null;
  staleReasons?: ProjectionStaleReason[] | null;
  reviewedAt: string;
};
