/**
 * HA-PRE-SURGERY-INTELLIGENCE-2B — Optimistic concurrency for graft-plan edits.
 * Prevents silent overwrites when two clinicians edit from the same base version.
 */

import type { PreSurgeryGraftPlan } from "./types";

export type GraftPlanConflict = {
  code: "version_conflict";
  message: string;
  expectedBasePlanId: string;
  expectedBaseVersion: number;
  currentHeadPlanId: string;
  currentHeadVersion: number;
  currentHeadStatus: PreSurgeryGraftPlan["status"];
  resolveBy: "reload_and_rebase" | "explicit_force_from_head";
};

export type ResolveGraftPlanBaseResult =
  | { ok: true; base: PreSurgeryGraftPlan; head: PreSurgeryGraftPlan }
  | { ok: false; conflict: GraftPlanConflict };

/**
 * Edits must target the current non-superseded head, or explicitly force from head.
 * Historical plan payloads remain immutable — revisions always create a new version row.
 */
export function resolveGraftPlanBaseForEdit(args: {
  plans: PreSurgeryGraftPlan[];
  basePlanId?: string | null;
  /** Client-known version of the plan being edited. */
  expectedBaseVersion?: number | null;
  /**
   * When true and base is stale, rebase onto current head after explicit acknowledgement.
   * Never silently overwrites.
   */
  forceRebaseFromHead?: boolean;
}): ResolveGraftPlanBaseResult {
  const sorted = [...args.plans].sort((a, b) => a.version - b.version);
  if (sorted.length === 0) {
    return {
      ok: false,
      conflict: {
        code: "version_conflict",
        message: "No graft plan found",
        expectedBasePlanId: args.basePlanId ?? "",
        expectedBaseVersion: args.expectedBaseVersion ?? 0,
        currentHeadPlanId: "",
        currentHeadVersion: 0,
        currentHeadStatus: "draft",
        resolveBy: "reload_and_rebase",
      },
    };
  }

  const head =
    [...sorted].reverse().find((p) => p.status !== "superseded") ?? sorted[sorted.length - 1]!;

  const requested =
    (args.basePlanId ? sorted.find((p) => p.id === args.basePlanId) : null) ?? head;

  const versionMismatch =
    args.expectedBaseVersion != null && args.expectedBaseVersion !== requested.version;

  const notCurrentHead = requested.id !== head.id || requested.status === "superseded";

  if ((versionMismatch || notCurrentHead) && !args.forceRebaseFromHead) {
    return {
      ok: false,
      conflict: {
        code: "version_conflict",
        message:
          "Another clinician saved a newer graft plan. Reload and rebase, or explicitly force from the current head.",
        expectedBasePlanId: requested.id,
        expectedBaseVersion: args.expectedBaseVersion ?? requested.version,
        currentHeadPlanId: head.id,
        currentHeadVersion: head.version,
        currentHeadStatus: head.status,
        resolveBy: "reload_and_rebase",
      },
    };
  }

  if ((versionMismatch || notCurrentHead) && args.forceRebaseFromHead) {
    return { ok: true, base: head, head };
  }

  return { ok: true, base: requested, head };
}

/** Historical plan rows must not be mutated in place — only supersession status is mutable. */
export function assertGraftPlanPayloadImmutable(
  stored: PreSurgeryGraftPlan,
  attemptedMutation: Partial<PreSurgeryGraftPlan>
): string | null {
  const frozenKeys: (keyof PreSurgeryGraftPlan)[] = [
    "zones",
    "totalMinimumGrafts",
    "totalTargetGrafts",
    "totalMaximumGrafts",
    "checksum",
    "version",
    "caseId",
    "createdBy",
    "createdAt",
  ];
  for (const key of frozenKeys) {
    if (key in attemptedMutation && attemptedMutation[key] !== undefined) {
      const a = JSON.stringify(stored[key]);
      const b = JSON.stringify(attemptedMutation[key]);
      if (a !== b) {
        return `Cannot mutate immutable graft-plan field "${key}" in place; create a new version`;
      }
    }
  }
  return null;
}
