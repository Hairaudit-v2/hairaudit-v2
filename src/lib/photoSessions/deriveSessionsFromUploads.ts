/**
 * Pure derivation of photo sessions from legacy upload category keys.
 * Does not persist; used by the resolver gate path and the DB bridge.
 */

import {
  CORE_BASELINE_ROLES,
  type PhotoSessionImageRole,
  type PhotoSessionMilestone,
  type PhotoSessionMilestoneSource,
  type PhotoSessionSummary,
} from "@/lib/photoSessions/types";
import {
  capturedAtFromProcedureAndRelativeDay,
  milestoneFromMonthsSinceBand,
  relativeDayFromMilestone,
} from "@/lib/photoSessions/milestones";

export type LegacyUploadSignal = {
  id?: string | null;
  type?: string | null;
  created_at?: string | null;
  metadata?: unknown;
};

export type DeriveSessionsContext = {
  caseId: string;
  procedureDate?: string | null;
  monthsSinceBand?: string | null;
};

function normalizeCategory(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t.startsWith("patient_photo:")) return t.slice("patient_photo:".length).trim();
  return t;
}

function categoryFromUpload(u: LegacyUploadSignal): string | null {
  const fromType = String(u.type ?? "").trim();
  if (fromType.toLowerCase().startsWith("patient_photo:")) {
    return normalizeCategory(fromType);
  }
  const meta =
    u.metadata && typeof u.metadata === "object" && !Array.isArray(u.metadata)
      ? (u.metadata as Record<string, unknown>)
      : null;
  if (meta && typeof meta.category === "string" && meta.category.trim()) {
    return normalizeCategory(meta.category);
  }
  return null;
}

export function roleFromLegacyCategory(category: string): PhotoSessionImageRole {
  const c = category.toLowerCase();
  if (/(recipient_closeup|hairline_closeup)/.test(c)) return "recipient_closeup";
  if (/donor_closeup/.test(c)) return "donor_closeup";
  if (/donor/.test(c)) return "donor_rear";
  if (/crown/.test(c)) return "crown";
  if (/_top$|vertex|^top$/.test(c) || c.includes("_top") || c.endsWith("top")) return "top";
  if (/left/.test(c)) return "left";
  if (/right/.test(c)) return "right";
  if (/front|frontal|recipient/.test(c)) return "front";
  return "unknown";
}

/**
 * Infer clinical milestone bucket from a storage category key.
 * Never returns `current` — patient_current_* maps to a follow-up / unknown band.
 */
export function milestoneFromLegacyCategory(
  category: string,
  monthsSinceBand?: string | null
): {
  milestone: PhotoSessionMilestone;
  source: PhotoSessionMilestoneSource;
  confidence: number;
} {
  const c = category.toLowerCase();

  if (c.startsWith("preop_") || c === "any_preop") {
    return { milestone: "pre_surgery", source: "legacy_category", confidence: 0.85 };
  }
  if (
    c.startsWith("day0_") ||
    c.includes("postop_day0") ||
    c === "postop_day0" ||
    c === "any_day0" ||
    c.includes("surgery_day")
  ) {
    return { milestone: "surgery_day", source: "legacy_category", confidence: 0.85 };
  }
  if (/postop_day1|postop_week1|early_postop|any_early_postop/.test(c)) {
    return { milestone: "early_recovery", source: "legacy_category", confidence: 0.7 };
  }

  const monthMatch = c.match(/postop_month(\d+)/);
  if (monthMatch) {
    const n = Number(monthMatch[1]);
    const map: Record<number, PhotoSessionMilestone> = {
      1: "month_1",
      3: "month_3",
      6: "month_6",
      9: "month_9",
      12: "month_12",
      18: "month_18",
    };
    if (map[n]) {
      return { milestone: map[n], source: "legacy_category", confidence: 0.9 };
    }
  }

  if (c.startsWith("patient_current_") || c.startsWith("current_")) {
    const fromBand = milestoneFromMonthsSinceBand(monthsSinceBand ?? null);
    if (fromBand) {
      return { milestone: fromBand, source: "legacy_category", confidence: 0.55 };
    }
    return { milestone: "unknown", source: "needs_review", confidence: 0.35 };
  }

  return { milestone: "unknown", source: "needs_review", confidence: 0.3 };
}

function stableSessionId(caseId: string, milestone: PhotoSessionMilestone, salt: string): string {
  // Deterministic non-UUID id for pure in-memory sessions (tests / gate path).
  return `derived:${caseId}:${milestone}:${salt}`;
}

type AccSession = {
  milestone: PhotoSessionMilestone;
  source: PhotoSessionMilestoneSource;
  confidence: number;
  roles: Set<PhotoSessionImageRole>;
  imageCount: number;
  uploadedAt: string;
  uploadIds: string[];
  categories: string[];
};

/**
 * Group patient photo uploads into session summaries by inferred milestone.
 * Ambiguous patient_current without band → unknown/needs_review group (not silently merged
 * into a high-confidence month session).
 */
export function deriveSessionSummariesFromUploads(
  uploads: LegacyUploadSignal[],
  ctx: DeriveSessionsContext
): PhotoSessionSummary[] {
  const groups = new Map<string, AccSession>();

  for (const u of uploads) {
    const category = categoryFromUpload(u);
    if (!category) continue;
    const { milestone, source, confidence } = milestoneFromLegacyCategory(
      category,
      ctx.monthsSinceBand
    );
    // Keep separate groups for needs_review unknown vs structured unknowns later if needed.
    const key = `${milestone}|${source === "needs_review" ? "review" : "ok"}`;
    let acc = groups.get(key);
    if (!acc) {
      acc = {
        milestone,
        source,
        confidence,
        roles: new Set(),
        imageCount: 0,
        uploadedAt: u.created_at ?? new Date(0).toISOString(),
        uploadIds: [],
        categories: [],
      };
      groups.set(key, acc);
    }
    acc.roles.add(roleFromLegacyCategory(category));
    acc.imageCount += 1;
    acc.confidence = Math.max(acc.confidence, confidence);
    const uploaded = u.created_at ?? acc.uploadedAt;
    if (uploaded > acc.uploadedAt) acc.uploadedAt = uploaded;
    if (u.id) acc.uploadIds.push(String(u.id));
    acc.categories.push(category);
  }

  const procedureDate = ctx.procedureDate ?? null;
  const summaries: PhotoSessionSummary[] = [];

  for (const [key, acc] of groups) {
    const relativeDay = relativeDayFromMilestone(acc.milestone);
    const capturedAt = capturedAtFromProcedureAndRelativeDay(procedureDate, relativeDay);
    summaries.push({
      id: stableSessionId(ctx.caseId, acc.milestone, key),
      caseId: ctx.caseId,
      milestone: acc.milestone,
      capturedAt,
      uploadedAt: acc.uploadedAt,
      relativeDay,
      milestoneSource: acc.source,
      milestoneConfidence: acc.confidence,
      status: acc.source === "needs_review" ? "needs_review" : "active",
      rolesPresent: [...acc.roles],
      imageCount: acc.imageCount,
    });
  }

  return summaries;
}

export function sessionHasRoles(
  session: PhotoSessionSummary | null | undefined,
  roles: readonly PhotoSessionImageRole[]
): boolean {
  if (!session) return false;
  const set = new Set(session.rolesPresent);
  return roles.every((r) => set.has(r));
}

export function sessionHasBaselineCore(session: PhotoSessionSummary | null | undefined): boolean {
  return sessionHasRoles(session, CORE_BASELINE_ROLES);
}

export function sessionHasFollowUpCore(session: PhotoSessionSummary | null | undefined): boolean {
  if (!session) return false;
  const set = new Set(session.rolesPresent);
  if (!set.has("front") || !set.has("top")) return false;
  return set.has("donor_rear") || set.has("crown");
}

export function missingCoreBaselineRoles(
  session: PhotoSessionSummary | null | undefined
): PhotoSessionImageRole[] {
  if (!session) return [...CORE_BASELINE_ROLES];
  const set = new Set(session.rolesPresent);
  return CORE_BASELINE_ROLES.filter((r) => !set.has(r));
}

export function missingFollowUpCoreHint(
  session: PhotoSessionSummary | null | undefined
): PhotoSessionImageRole[] {
  if (!session) return ["front", "top", "donor_rear"];
  const missing: PhotoSessionImageRole[] = [];
  const set = new Set(session.rolesPresent);
  if (!set.has("front")) missing.push("front");
  if (!set.has("top")) missing.push("top");
  if (!set.has("donor_rear") && !set.has("crown")) {
    missing.push("donor_rear");
  }
  return missing;
}
