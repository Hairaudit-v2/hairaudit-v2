/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Graft plan totals + validation.
 */

import { createHash } from "node:crypto";
import { canonicalizeForChecksum, stableStringifyForChecksum } from "@/lib/projection/canonicalChecksum";
import type {
  GraftPlanZone,
  PreSurgeryGraftPlan,
  PreSurgeryGraftPlanZoneRow,
} from "./types";
import {
  activeZoneRows,
  computeGraftPlanTotals,
  isDeferredPriority,
  withRecalculatedTotals,
} from "./graftPlanTotals";

export {
  activeZoneRows,
  computeGraftPlanTotals,
  isDeferredPriority,
  withRecalculatedTotals,
} from "./graftPlanTotals";

export type GraftPlanValidationIssue = {
  code: string;
  message: string;
  zone?: GraftPlanZone;
};

const LARGE_ALLOCATION_DELTA_RATIO = 0.35;
const LARGE_ALLOCATION_DELTA_ABSOLUTE = 400;

export function validateGraftPlanZoneRow(row: PreSurgeryGraftPlanZoneRow): GraftPlanValidationIssue[] {
  const issues: GraftPlanValidationIssue[] = [];
  if (row.minimumGrafts < 0 || row.targetGrafts < 0 || row.maximumGrafts < 0) {
    issues.push({ code: "negative_grafts", message: "Negative graft values are prohibited", zone: row.zone });
  }
  if (row.minimumGrafts > row.targetGrafts) {
    issues.push({
      code: "min_exceeds_target",
      message: "Minimum cannot exceed target",
      zone: row.zone,
    });
  }
  if (row.targetGrafts > row.maximumGrafts) {
    issues.push({
      code: "target_exceeds_max",
      message: "Target cannot exceed maximum",
      zone: row.zone,
    });
  }
  if (isDeferredPriority(row.priority)) {
    if (row.minimumGrafts !== 0 || row.targetGrafts !== 0 || row.maximumGrafts !== 0) {
      issues.push({
        code: "deferred_nonzero",
        message: "Deferred zones must not contribute to the current procedure total (use 0 grafts)",
        zone: row.zone,
      });
    }
  }
  return issues;
}

export type ValidateGraftPlanOptions = {
  /** AI / prior seed for large-change rationale checks. */
  aiSeed?: Pick<PreSurgeryGraftPlan, "zones" | "totalTargetGrafts"> | null;
  requireApprovalFields?: boolean;
};

export function validateGraftPlan(
  plan: Pick<
    PreSurgeryGraftPlan,
    | "zones"
    | "totalMinimumGrafts"
    | "totalTargetGrafts"
    | "totalMaximumGrafts"
    | "donorAvailabilityBand"
    | "status"
    | "clinicianNote"
  >,
  opts: ValidateGraftPlanOptions = {}
): GraftPlanValidationIssue[] {
  const issues: GraftPlanValidationIssue[] = [];
  for (const row of plan.zones) {
    issues.push(...validateGraftPlanZoneRow(row));
  }

  const totals = computeGraftPlanTotals(plan.zones);
  if (plan.totalMinimumGrafts !== totals.totalMinimumGrafts) {
    issues.push({ code: "total_min_mismatch", message: "Total minimum must equal sum of active zones" });
  }
  if (plan.totalTargetGrafts !== totals.totalTargetGrafts) {
    issues.push({ code: "total_target_mismatch", message: "Total target must equal sum of active zones" });
  }
  if (plan.totalMaximumGrafts !== totals.totalMaximumGrafts) {
    issues.push({ code: "total_max_mismatch", message: "Total maximum must equal sum of active zones" });
  }

  if (opts.requireApprovalFields || plan.status === "approved") {
    const evidenceCount = plan.zones.reduce((n, z) => n + z.evidenceImageIds.length, 0);
    if (evidenceCount < 1) {
      issues.push({
        code: "approval_requires_evidence",
        message: "Approved plans require at least one evidence image",
      });
    }
    if (!plan.donorAvailabilityBand) {
      issues.push({
        code: "approval_requires_donor_band",
        message: "Approved plans require a donor availability status",
      });
    }
  }

  if (opts.aiSeed) {
    const delta = Math.abs(plan.totalTargetGrafts - opts.aiSeed.totalTargetGrafts);
    const ratio =
      opts.aiSeed.totalTargetGrafts > 0 ? delta / opts.aiSeed.totalTargetGrafts : delta > 0 ? 1 : 0;
    if (delta >= LARGE_ALLOCATION_DELTA_ABSOLUTE || ratio >= LARGE_ALLOCATION_DELTA_RATIO) {
      const note = String(plan.clinicianNote ?? "").trim();
      if (!note) {
        issues.push({
          code: "large_change_requires_rationale",
          message: "Large allocation changes from the AI proposal require a short rationale",
        });
      }
    }
  }

  return issues;
}

export function canGenerateProjectionFromPlan(plan: Pick<PreSurgeryGraftPlan, "status">): boolean {
  return plan.status === "approved";
}

export function checksumGraftPlanPayload(
  plan: Omit<PreSurgeryGraftPlan, "checksum" | "id" | "createdAt" | "approvedAt">
): string {
  const payload = canonicalizeForChecksum({
    caseId: plan.caseId,
    version: plan.version,
    schemaVersion: plan.schemaVersion,
    zones: plan.zones,
    totalMinimumGrafts: plan.totalMinimumGrafts,
    totalTargetGrafts: plan.totalTargetGrafts,
    totalMaximumGrafts: plan.totalMaximumGrafts,
    proposedSessionCount: plan.proposedSessionCount,
    stageOneZones: plan.stageOneZones,
    deferredZones: plan.deferredZones,
    donorAvailabilityBand: plan.donorAvailabilityBand,
    donorConstraintNote: plan.donorConstraintNote,
    graftReserve: plan.graftReserve,
    planningAssumptions: plan.planningAssumptions,
    clinicianNote: plan.clinicianNote,
    status: plan.status,
  });
  return createHash("sha256").update(stableStringifyForChecksum(payload), "utf8").digest("hex");
}
