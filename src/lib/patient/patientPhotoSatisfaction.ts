/**
 * HA-PHOTO-ALLOCATION-UNIFICATION-1 — Canonical patient photo satisfaction.
 *
 * Bidirectional logical equivalence between pathway upload keys and legacy
 * audit buckets. Does not mutate stored categories or storage paths.
 *
 * Callers supply `requiredKeys` (typically pathway required upload keys) to
 * avoid circular imports with patientReviewPathway.
 */

import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

const MONTHS_SINCE_VALUES = ["under_3", "3_6", "6_9", "9_12", "12_plus"] as const;
export type SatisfactionMonthsSinceBand = (typeof MONTHS_SINCE_VALUES)[number];

export type PatientPhotoSatisfactionContext = {
  pathway: PatientReviewPathway;
  /** Pathway (or other) required keys to evaluate — usually PATHWAY required upload keys. */
  requiredKeys: readonly string[];
  /** Numeric months since procedure when known (maps to intake bands). */
  monthsSinceProcedure?: number | null;
  /** Preferred when available — matches patient intake `months_since`. */
  monthsSinceBand?: SatisfactionMonthsSinceBand | null;
};

export type PatientPhotoSatisfactionResult = {
  /** Required pathway keys that are satisfied. */
  satisfiedKeys: Set<string>;
  /** Required pathway keys still missing. */
  missingKeys: string[];
  /** Which uploaded category keys contributed to each satisfied required key. */
  sourceKeysBySatisfiedKey: Map<string, string[]>;
  isComplete: boolean;
};

/** Wide-view bidirectional equivalents (logical only). Close-ups are never filled by these. */
export const WIDE_VIEW_EQUIVALENCE_GROUPS: Readonly<Record<string, readonly string[]>> = {
  front: ["preop_front", "patient_current_front"],
  top: ["preop_top", "patient_current_top"],
  donor_rear: ["preop_donor_rear", "patient_current_donor_rear"],
};

/** Close-up slots: exact key (or listed peers) only — never wide-view inference. */
export const CLOSEUP_EQUIVALENCE_GROUPS: Readonly<Record<string, readonly string[]>> = {
  recipient_closeup: ["current_recipient_closeup"],
  donor_closeup: ["preop_donor_closeup"],
};

/**
 * Extra donors that may fill the wide front slot only after the recipient
 * close-up requirement is already satisfied (surplus close-ups).
 * A single close-up must never fill both front and recipient-closeup.
 */
const FRONT_SURPLUS_CLOSEUP_KEYS = ["current_recipient_closeup"] as const;

/** Anatomical view → postfix for milestone keys (`postop_month{N}_{view}`). */
const MILESTONE_VIEW_BY_WIDE_GROUP: Readonly<Record<string, readonly string[]>> = {
  front: ["front"],
  top: ["top"],
  donor_rear: ["donor"],
};

const MILESTONE_BAND_MONTH: Readonly<
  Record<Exclude<SatisfactionMonthsSinceBand, "under_3">, 3 | 6 | 9 | 12>
> = {
  "3_6": 3,
  "6_9": 6,
  "9_12": 9,
  "12_plus": 12,
};

function normalizeCategory(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t.startsWith("patient_photo:")) return t.slice("patient_photo:".length).trim();
  return t;
}

/** Extract storage category suffixes from upload rows / photo payloads. */
export function extractUploadedPatientPhotoCategories(
  photos: ReadonlyArray<{ type?: string | null; photo_key?: string | null }>
): string[] {
  const out: string[] = [];
  for (const p of photos) {
    if (p.photo_key && String(p.photo_key).trim()) {
      out.push(normalizeCategory(String(p.photo_key)));
      continue;
    }
    const t = String(p.type ?? "").trim();
    if (!t) continue;
    if (t.toLowerCase().startsWith("patient_photo:")) {
      out.push(normalizeCategory(t));
    }
  }
  return out;
}

export function monthsSinceProcedureToBand(
  months: number | null | undefined
): SatisfactionMonthsSinceBand | null {
  if (months == null || !Number.isFinite(months) || months < 0) return null;
  if (months < 3) return "under_3";
  if (months < 6) return "3_6";
  if (months < 9) return "6_9";
  if (months < 12) return "9_12";
  return "12_plus";
}

export function resolveSatisfactionMonthsBand(
  context: PatientPhotoSatisfactionContext
): SatisfactionMonthsSinceBand | null {
  const band = context.monthsSinceBand;
  if (band && (MONTHS_SINCE_VALUES as readonly string[]).includes(band)) return band;
  return monthsSinceProcedureToBand(context.monthsSinceProcedure);
}

/** Eligible milestone month number for current-result wide views, or null. */
export function eligibleMilestoneMonth(
  context: PatientPhotoSatisfactionContext
): 3 | 6 | 9 | 12 | null {
  const band = resolveSatisfactionMonthsBand(context);
  if (!band || band === "under_3") return null;
  return MILESTONE_BAND_MONTH[band] ?? null;
}

function groupForRequiredKey(requiredKey: string): {
  kind: "wide" | "closeup";
  groupId: string;
  candidates: readonly string[];
} | null {
  for (const [groupId, keys] of Object.entries(WIDE_VIEW_EQUIVALENCE_GROUPS)) {
    if (keys.includes(requiredKey)) {
      return { kind: "wide", groupId, candidates: keys };
    }
  }
  for (const [groupId, keys] of Object.entries(CLOSEUP_EQUIVALENCE_GROUPS)) {
    if (keys.includes(requiredKey)) {
      return { kind: "closeup", groupId, candidates: keys };
    }
  }
  return null;
}

function milestoneCandidatesForWideGroup(
  groupId: string,
  month: 3 | 6 | 9 | 12
): string[] {
  const views = MILESTONE_VIEW_BY_WIDE_GROUP[groupId];
  if (!views) return [];
  return views.map((v) => `postop_month${month}_${v}`);
}

type Pool = Map<string, number>;

function takeFromPool(pool: Pool, key: string): boolean {
  const n = pool.get(key) ?? 0;
  if (n < 1) return false;
  pool.set(key, n - 1);
  return true;
}

function buildPool(uploadedCategories: readonly string[]): Pool {
  const pool: Pool = new Map();
  for (const raw of uploadedCategories) {
    const k = normalizeCategory(raw);
    if (!k) continue;
    pool.set(k, (pool.get(k) ?? 0) + 1);
  }
  return pool;
}

/**
 * Canonical satisfaction: assign each upload instance to at most one required slot.
 * Exact matches first, then wide-view equivalents / eligible milestones, then surplus close-up→front.
 */
export function resolvePatientPhotoSatisfaction(
  uploadedCategories: readonly string[],
  context: PatientPhotoSatisfactionContext
): PatientPhotoSatisfactionResult {
  const requiredKeys = [...context.requiredKeys];
  const pool = buildPool(uploadedCategories);
  const satisfiedKeys = new Set<string>();
  const sourceKeysBySatisfiedKey = new Map<string, string[]>();
  const milestoneMonth =
    context.pathway === "post_surgery" ? eligibleMilestoneMonth(context) : null;

  const record = (requiredKey: string, sourceKey: string) => {
    satisfiedKeys.add(requiredKey);
    const prev = sourceKeysBySatisfiedKey.get(requiredKey) ?? [];
    prev.push(sourceKey);
    sourceKeysBySatisfiedKey.set(requiredKey, prev);
  };

  // Pass 1 — exact key matches (preserves close-up distinctness).
  for (const requiredKey of requiredKeys) {
    if (takeFromPool(pool, requiredKey)) {
      record(requiredKey, requiredKey);
    }
  }

  // Pass 2+ — post-surgery only: wide-view bucket equivalents, milestones, surplus close-up→front.
  // Pre-surgery remains exact-key (pass 1) so planning pathways do not regress.
  if (context.pathway === "post_surgery") {
    for (const requiredKey of requiredKeys) {
      if (satisfiedKeys.has(requiredKey)) continue;
      const meta = groupForRequiredKey(requiredKey);
      if (!meta || meta.kind !== "wide") continue;

      let taken: string | null = null;
      for (const candidate of meta.candidates) {
        if (candidate === requiredKey) continue;
        if (takeFromPool(pool, candidate)) {
          taken = candidate;
          break;
        }
      }
      if (!taken && milestoneMonth != null) {
        for (const mKey of milestoneCandidatesForWideGroup(meta.groupId, milestoneMonth)) {
          if (takeFromPool(pool, mKey)) {
            taken = mKey;
            break;
          }
        }
      }
      if (taken) record(requiredKey, taken);
    }

    for (const requiredKey of requiredKeys) {
      if (satisfiedKeys.has(requiredKey)) continue;
      const meta = groupForRequiredKey(requiredKey);
      if (!meta || meta.groupId !== "front") continue;
      for (const closeupKey of FRONT_SURPLUS_CLOSEUP_KEYS) {
        if (takeFromPool(pool, closeupKey)) {
          record(requiredKey, closeupKey);
          break;
        }
      }
    }
  }

  const missingKeys = requiredKeys.filter((k) => !satisfiedKeys.has(k));
  return {
    satisfiedKeys,
    missingKeys,
    sourceKeysBySatisfiedKey,
    isComplete: missingKeys.length === 0,
  };
}

export function resolvePatientPhotoSatisfactionFromUploads(
  photos: ReadonlyArray<{ type?: string | null; photo_key?: string | null }>,
  context: PatientPhotoSatisfactionContext
): PatientPhotoSatisfactionResult {
  return resolvePatientPhotoSatisfaction(extractUploadedPatientPhotoCategories(photos), context);
}

/** Display labels for post-surgery current-outcome evidence (auditor + readiness). */
export const POST_SURGERY_CURRENT_VIEW_LABELS: Readonly<Record<string, string>> = {
  preop_front: "Current Front View",
  current_recipient_closeup: "Current Recipient Close-up",
  preop_top: "Current Top View",
  preop_donor_rear: "Current Donor Rear",
  preop_donor_closeup: "Current Donor Close-up",
  patient_current_front: "Current Front View",
  patient_current_top: "Current Top View",
  patient_current_donor_rear: "Current Donor Rear",
  patient_current_left: "Current Left Side",
  patient_current_right: "Current Right Side",
  patient_current_crown: "Current Crown View",
};

export function patientPhotoSatisfactionLabel(
  key: string,
  pathway: PatientReviewPathway
): string | null {
  if (pathway !== "post_surgery") return null;
  return POST_SURGERY_CURRENT_VIEW_LABELS[key] ?? null;
}

/** Whether two category keys are wide-view equivalents (not close-up). */
export function areWideViewEquivalentCategories(a: string, b: string): boolean {
  const left = normalizeCategory(a);
  const right = normalizeCategory(b);
  if (left === right) return true;
  for (const keys of Object.values(WIDE_VIEW_EQUIVALENCE_GROUPS)) {
    if (keys.includes(left) && keys.includes(right)) return true;
  }
  return false;
}
