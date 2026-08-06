/**
 * HA-PHOTO-TIMELINE-2A Phase C — Pure multi-signal session grouping.
 * Filename is a weak conflict check only; never the sole merge key.
 */

import {
  milestoneFromLegacyCategory,
  roleFromLegacyCategory,
} from "@/lib/photoSessions/deriveSessionsFromUploads";
import {
  weakCategoryFromFilename,
  type ReconcileUploadSignal,
} from "@/lib/photoSessions/reconcileSignals";
import type {
  PhotoSessionImageRole,
  PhotoSessionMilestone,
  PhotoSessionMilestoneSource,
  PhotoSessionStatus,
} from "@/lib/photoSessions/types";

/** Same-milestone uploads within this window may share a session when confidence is high. */
export const SESSION_CLUSTER_WINDOW_MS = 2 * 60 * 60 * 1000;

export type SessionCandidate = {
  milestone: PhotoSessionMilestone;
  milestoneSource: PhotoSessionMilestoneSource;
  confidence: number;
  status: PhotoSessionStatus;
  uploads: ReconcileUploadSignal[];
  roles: PhotoSessionImageRole[];
  clusterKey: string;
};

function resolvedMilestoneForSignal(
  signal: ReconcileUploadSignal,
  monthsSinceBand?: string | null
): {
  milestone: PhotoSessionMilestone;
  source: PhotoSessionMilestoneSource;
  confidence: number;
} {
  const primary = milestoneFromLegacyCategory(signal.effectiveCategory, monthsSinceBand);

  // Capture-stage metadata can reinforce follow-up month bands.
  if (signal.captureStage) {
    const fromStage = milestoneFromLegacyCategory(
      `postop_${signal.captureStage}`,
      monthsSinceBand
    );
    if (
      fromStage.milestone !== "unknown" &&
      primary.milestone !== "unknown" &&
      fromStage.milestone !== primary.milestone
    ) {
      return {
        milestone: "unknown",
        source: "needs_review",
        confidence: Math.min(primary.confidence, 0.4),
      };
    }
  }

  const weakCat = weakCategoryFromFilename(signal.originalName);
  if (weakCat) {
    const weak = milestoneFromLegacyCategory(weakCat, monthsSinceBand);
    if (
      weak.milestone !== "unknown" &&
      primary.milestone !== "unknown" &&
      weak.milestone !== primary.milestone
    ) {
      // Conflicting signals → needs_review; do not silently pick.
      return {
        milestone: "unknown",
        source: "needs_review",
        confidence: 0.35,
      };
    }
  }

  if (primary.confidence < 0.6 || primary.source === "needs_review") {
    return {
      milestone: primary.milestone === "unknown" ? "unknown" : primary.milestone,
      source: primary.confidence < 0.6 ? "needs_review" : primary.source,
      confidence: primary.confidence,
    };
  }

  return primary;
}

function clusterIndexForTimes(
  times: Array<number | null>,
  windowMs: number
): number[] {
  // Sort by time, assign cluster ids greedily.
  const indexed = times.map((t, i) => ({ i, t: t ?? null }));
  const withTime = indexed.filter((x) => x.t != null).sort((a, b) => (a.t! - b.t!));
  const clusterOf = new Array(times.length).fill(0);
  let clusterId = 0;
  let clusterStart: number | null = null;
  let last: number | null = null;

  for (const item of withTime) {
    const t = item.t!;
    if (clusterStart == null || last == null || t - last > windowMs) {
      clusterId += 1;
      clusterStart = t;
    }
    clusterOf[item.i] = clusterId;
    last = t;
  }

  // Untimed uploads each get their own cluster slot (do not silently merge).
  for (const item of indexed) {
    if (item.t == null) {
      clusterId += 1;
      clusterOf[item.i] = clusterId;
    }
  }

  return clusterOf;
}

/**
 * Group upload signals into session candidates.
 * Same high-confidence milestone + same ~2h cluster → one session.
 * Gaps or low confidence → separate / needs_review sessions.
 */
export function groupUploadsIntoSessionCandidates(
  signals: ReconcileUploadSignal[],
  opts?: { monthsSinceBand?: string | null; clusterWindowMs?: number }
): SessionCandidate[] {
  const monthsSinceBand = opts?.monthsSinceBand ?? null;
  const windowMs = opts?.clusterWindowMs ?? SESSION_CLUSTER_WINDOW_MS;

  type Annotated = {
    signal: ReconcileUploadSignal;
    milestone: PhotoSessionMilestone;
    source: PhotoSessionMilestoneSource;
    confidence: number;
  };

  const annotated: Annotated[] = signals.map((signal) => {
    const resolved = resolvedMilestoneForSignal(signal, monthsSinceBand);
    return {
      signal,
      milestone: resolved.milestone,
      source: resolved.source,
      confidence: resolved.confidence,
    };
  });

  // Bucket by milestone + review flag first.
  const byMilestone = new Map<string, Annotated[]>();
  for (const a of annotated) {
    const key = `${a.milestone}|${a.source === "needs_review" || a.confidence < 0.6 ? "review" : "ok"}`;
    const list = byMilestone.get(key) ?? [];
    list.push(a);
    byMilestone.set(key, list);
  }

  const candidates: SessionCandidate[] = [];

  for (const [bucketKey, items] of byMilestone) {
    const times = items.map((a) => {
      const t = a.signal.createdAt ? Date.parse(a.signal.createdAt) : NaN;
      return Number.isFinite(t) ? t : null;
    });

    const highConfidence = items.every((a) => a.confidence >= 0.6 && a.source !== "needs_review");
    let clusterIds: number[];

    if (highConfidence) {
      clusterIds = clusterIndexForTimes(times, windowMs);
    } else {
      // Low confidence / needs_review: do not merge across time; each upload own cluster
      // except identical batch_id may group.
      clusterIds = items.map((a, i) => {
        if (a.signal.batchId) {
          // Stable hash-ish: reuse index of first same batch in this bucket.
          const first = items.findIndex((x) => x.signal.batchId === a.signal.batchId);
          return first + 1;
        }
        return 1000 + i;
      });
    }

    const byCluster = new Map<number, Annotated[]>();
    for (let i = 0; i < items.length; i++) {
      const cid = clusterIds[i]!;
      const list = byCluster.get(cid) ?? [];
      list.push(items[i]!);
      byCluster.set(cid, list);
    }

    for (const [cid, clusterItems] of byCluster) {
      const confidence = Math.min(...clusterItems.map((a) => a.confidence));
      const source = clusterItems.some((a) => a.source === "needs_review")
        ? ("needs_review" as const)
        : clusterItems[0]!.source;
      const status: PhotoSessionStatus =
        source === "needs_review" || confidence < 0.6 ? "needs_review" : "active";
      const roles = [
        ...new Set(
          clusterItems.map((a) => roleFromLegacyCategory(a.signal.effectiveCategory))
        ),
      ];
      candidates.push({
        milestone: clusterItems[0]!.milestone,
        milestoneSource: source,
        confidence,
        status,
        uploads: clusterItems.map((a) => a.signal),
        roles,
        clusterKey: `${bucketKey}|c${cid}`,
      });
    }
  }

  return candidates;
}
