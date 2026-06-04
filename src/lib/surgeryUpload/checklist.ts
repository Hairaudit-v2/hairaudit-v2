// HairAudit Mobile Surgery Upload Portal — photo checklist (Stage 1)
// Images are stored in the shared `uploads` table with type `surgery_photo:<slot>`
// and storage path `cases/{caseId}/surgery/{slot}/...`.

export const SURGERY_PHOTO_TYPE_PREFIX = "surgery_photo:" as const;

export type SurgeryPhotoSlotKey =
  | "preop_donor"
  | "preop_recipient"
  | "hairline_design"
  | "graft_quality"
  | "postop_donor"
  | "postop_recipient"
  | "extraction_progress"
  | "implantation_progress"
  | "petri_graft_sorting"
  | "complication"
  | "other";

export type SurgeryPhotoSlot = {
  readonly key: SurgeryPhotoSlotKey;
  readonly label: string;
  readonly help: string;
  readonly required: boolean;
  /** UI grouping for the checklist. */
  readonly group: "required" | "optional";
  readonly accept: string;
  readonly maxFiles: number;
};

export const SURGERY_PHOTO_SLOTS: readonly SurgeryPhotoSlot[] = [
  {
    key: "preop_donor",
    label: "Pre-op donor",
    help: "Donor area before extraction (back/sides of head).",
    required: true,
    group: "required",
    accept: "image/*",
    maxFiles: 6,
  },
  {
    key: "preop_recipient",
    label: "Pre-op recipient",
    help: "Recipient/transplant area before the procedure.",
    required: true,
    group: "required",
    accept: "image/*",
    maxFiles: 6,
  },
  {
    key: "hairline_design",
    label: "Hairline / design markings",
    help: "Drawn hairline and design markings on the patient.",
    required: true,
    group: "required",
    accept: "image/*",
    maxFiles: 6,
  },
  {
    key: "graft_quality",
    label: "Graft quality / sample",
    help: "Close-up of a graft sample showing quality.",
    required: true,
    group: "required",
    accept: "image/*",
    maxFiles: 6,
  },
  {
    key: "postop_donor",
    label: "Immediate post-op donor",
    help: "Donor area immediately after surgery.",
    required: true,
    group: "required",
    accept: "image/*",
    maxFiles: 6,
  },
  {
    key: "postop_recipient",
    label: "Immediate post-op recipient",
    help: "Recipient area immediately after placement.",
    required: true,
    group: "required",
    accept: "image/*",
    maxFiles: 6,
  },
  {
    key: "extraction_progress",
    label: "Extraction in progress",
    help: "Optional — extraction underway.",
    required: false,
    group: "optional",
    accept: "image/*",
    maxFiles: 12,
  },
  {
    key: "implantation_progress",
    label: "Implantation in progress",
    help: "Optional — implantation underway.",
    required: false,
    group: "optional",
    accept: "image/*",
    maxFiles: 12,
  },
  {
    key: "petri_graft_sorting",
    label: "Petri dish / graft sorting",
    help: "Optional — grafts being counted/sorted.",
    required: false,
    group: "optional",
    accept: "image/*",
    maxFiles: 12,
  },
  {
    key: "complication",
    label: "Complication / concern",
    help: "Optional — anything noteworthy or concerning.",
    required: false,
    group: "optional",
    accept: "image/*",
    maxFiles: 12,
  },
  {
    key: "other",
    label: "Other",
    help: "Optional — any other relevant photos.",
    required: false,
    group: "optional",
    accept: "image/*",
    maxFiles: 12,
  },
] as const;

const SLOT_KEYS = new Set<string>(SURGERY_PHOTO_SLOTS.map((s) => s.key));
const SLOT_BASE_INDEX = new Map<SurgeryPhotoSlotKey, number>(
  SURGERY_PHOTO_SLOTS.map((s, i) => [s.key, i])
);

export const REQUIRED_SURGERY_PHOTO_SLOTS: SurgeryPhotoSlotKey[] =
  SURGERY_PHOTO_SLOTS.filter((s) => s.required).map((s) => s.key);

// ---------------------------------------------------------------------------
// Stage 3 — per-clinic / per-case photo checklist configuration
// ---------------------------------------------------------------------------
// The config is stored as JSONB in two places:
//   * surgery_upload_clinic_defaults.default_photo_checklist_config (clinic preference)
//   * surgery_upload_details.photo_checklist_config (per-case snapshot, copied at create)
// HairAudit's six minimum evidence slots are LOCKED to "required" for Stage 3 and
// cannot be made optional/hidden by clinic users (or auditors yet). Optional slots
// can be promoted to required, kept optional, or hidden by a clinic.

export type SurgerySlotState = "required" | "optional" | "hidden";

export type SurgeryChecklistSlotConfig = {
  state: SurgerySlotState;
  order?: number;
  /**
   * Stage 3.1: minimum number of photos required when this slot is effectively
   * required. Always sanitizes to an integer in [MIN_SLOT_MIN_COUNT, MAX_SLOT_MIN_COUNT].
   * Ignored for optional/hidden slots (they require zero photos at runtime).
   */
  minCount?: number;
};

export type SurgeryChecklistConfig = {
  version: number;
  slots: Partial<Record<SurgeryPhotoSlotKey, SurgeryChecklistSlotConfig>>;
};

export const CHECKLIST_CONFIG_VERSION = 1;

// ---------------------------------------------------------------------------
// Stage 3.1 — per-slot minimum photo counts
// ---------------------------------------------------------------------------
// Required slots may demand more than one photo (e.g. donor from two angles).
// Defaults to 1 so existing configs (and configs without minCount) behave exactly
// as before. Clinics/auditors may raise a slot's minimum but never below 1 for a
// required (or locked) slot. A suggested ceiling keeps the UI/control sane.
export const DEFAULT_SLOT_MIN_COUNT = 1;
export const MIN_SLOT_MIN_COUNT = 1;
export const MAX_SLOT_MIN_COUNT = 10;

/**
 * Coerce arbitrary stored/incoming minCount into a safe integer.
 * Invalid / missing values fall back to DEFAULT_SLOT_MIN_COUNT (1) and the result
 * is always clamped to [MIN_SLOT_MIN_COUNT, MAX_SLOT_MIN_COUNT]. Required and
 * locked slots can therefore never drop below 1.
 */
export function coerceMinCount(value: unknown): number {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isFinite(num)) return DEFAULT_SLOT_MIN_COUNT;
  const floored = Math.floor(num);
  if (floored < MIN_SLOT_MIN_COUNT) return MIN_SLOT_MIN_COUNT;
  if (floored > MAX_SLOT_MIN_COUNT) return MAX_SLOT_MIN_COUNT;
  return floored;
}

/** The six HairAudit minimum evidence slots — always required, locked for clinics. */
export const LOCKED_REQUIRED_SURGERY_SLOTS: readonly SurgeryPhotoSlotKey[] =
  SURGERY_PHOTO_SLOTS.filter((s) => s.required).map((s) => s.key);

/** Slots a clinic may toggle between required / optional / hidden. */
export const OPTIONAL_SURGERY_SLOT_KEYS: readonly SurgeryPhotoSlotKey[] =
  SURGERY_PHOTO_SLOTS.filter((s) => !s.required).map((s) => s.key);

const LOCKED_SLOT_SET = new Set<SurgeryPhotoSlotKey>(LOCKED_REQUIRED_SURGERY_SLOTS);

export function isLockedRequiredSlot(key: string): boolean {
  return LOCKED_SLOT_SET.has(key as SurgeryPhotoSlotKey);
}

function isValidState(value: unknown): value is SurgerySlotState {
  return value === "required" || value === "optional" || value === "hidden";
}

function coerceOrder(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** The base HairAudit checklist (six required, the rest optional) as a config object. */
export function getBaseChecklistConfig(): SurgeryChecklistConfig {
  const slots: SurgeryChecklistConfig["slots"] = {};
  SURGERY_PHOTO_SLOTS.forEach((slot, index) => {
    slots[slot.key] = {
      state: slot.required ? "required" : "optional",
      order: index,
      minCount: DEFAULT_SLOT_MIN_COUNT,
    };
  });
  return { version: CHECKLIST_CONFIG_VERSION, slots };
}

/**
 * Validate + coerce arbitrary stored/incoming JSON into a safe checklist config.
 * - Locked HairAudit minimum slots are always forced to "required".
 * - Optional slots accept required/optional/hidden; anything else falls back to base.
 * - Unknown slot keys are ignored. Invalid/missing input yields the base checklist.
 * Always returns an entry for every known slot so resolution is total.
 */
export function sanitizeSurgeryChecklistConfig(raw: unknown): SurgeryChecklistConfig {
  const rawSlots =
    raw && typeof raw === "object" && raw !== null
      ? ((raw as { slots?: unknown }).slots as Record<string, unknown> | undefined)
      : undefined;

  const slots: SurgeryChecklistConfig["slots"] = {};

  SURGERY_PHOTO_SLOTS.forEach((slot, index) => {
    const entry =
      rawSlots && typeof rawSlots === "object"
        ? (rawSlots[slot.key] as {
            state?: unknown;
            order?: unknown;
            minCount?: unknown;
          } | undefined)
        : undefined;

    const order = coerceOrder(entry?.order, index);
    // minCount always sanitizes to a safe integer (>= 1). It is stored for every
    // slot for forward-compatibility but only applies at runtime when the slot is
    // effectively required.
    const minCount = coerceMinCount(entry?.minCount);

    if (LOCKED_SLOT_SET.has(slot.key)) {
      // Locked slots can never be optional/hidden; minCount can be raised but the
      // clamp in coerceMinCount keeps it at least 1.
      slots[slot.key] = { state: "required", order, minCount };
      return;
    }

    const state: SurgerySlotState = isValidState(entry?.state)
      ? entry!.state
      : "optional";
    slots[slot.key] = { state, order, minCount };
  });

  return { version: CHECKLIST_CONFIG_VERSION, slots };
}

export type ResolvedSurgerySlot = SurgeryPhotoSlot & {
  /** Effective state after applying config + locks. */
  state: SurgerySlotState;
  /** True for the six HairAudit minimum slots. */
  locked: boolean;
  /** Convenience flag: state === "required". */
  effectiveRequired: boolean;
  /** Configured minimum photo count (>= 1). Always present after resolution. */
  minCount: number;
  /** Photos this slot demands at runtime: minCount when required, else 0. */
  requiredCount: number;
  order: number;
};

/**
 * Resolve a stored config (or null) into the full, ordered slot list. Accepts raw
 * JSONB; invalid configs safely fall back to the base HairAudit checklist.
 */
export function getResolvedSurgeryChecklist(config?: unknown): ResolvedSurgerySlot[] {
  const sane = sanitizeSurgeryChecklistConfig(config);
  const resolved: ResolvedSurgerySlot[] = SURGERY_PHOTO_SLOTS.map((slot) => {
    const entry =
      sane.slots[slot.key] ??
      ({ state: "optional", minCount: DEFAULT_SLOT_MIN_COUNT } as SurgeryChecklistSlotConfig);
    const state = LOCKED_SLOT_SET.has(slot.key) ? "required" : entry.state;
    const effectiveRequired = state === "required";
    const minCount = coerceMinCount(entry.minCount);
    return {
      ...slot,
      state,
      locked: LOCKED_SLOT_SET.has(slot.key),
      effectiveRequired,
      minCount,
      requiredCount: effectiveRequired ? minCount : 0,
      order: coerceOrder(entry.order, SLOT_BASE_INDEX.get(slot.key) ?? 0),
    };
  });
  resolved.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return (SLOT_BASE_INDEX.get(a.key) ?? 0) - (SLOT_BASE_INDEX.get(b.key) ?? 0);
  });
  return resolved;
}

/** Required slot keys for a config (always includes the six locked minimum slots). */
export function getRequiredSurgerySlots(config?: unknown): SurgeryPhotoSlotKey[] {
  return getResolvedSurgeryChecklist(config)
    .filter((s) => s.effectiveRequired)
    .map((s) => s.key);
}

/** Visible (non-hidden) slots for the mobile upload flow, in display order. */
export function getVisibleSurgerySlots(config?: unknown): ResolvedSurgerySlot[] {
  return getResolvedSurgeryChecklist(config).filter((s) => s.state !== "hidden");
}

function presentSlotsFromUploads(uploadTypes: { type: string }[]): Set<SurgeryPhotoSlotKey> {
  const present = new Set<SurgeryPhotoSlotKey>();
  for (const u of uploadTypes) {
    const slot = slotFromSurgeryType(u.type);
    if (slot) present.add(slot);
  }
  return present;
}

/** Count uploaded photos per slot (Stage 3.1 minCount-aware calculations). */
function countsBySlotFromUploads(
  uploadTypes: { type: string }[]
): Map<SurgeryPhotoSlotKey, number> {
  const counts = new Map<SurgeryPhotoSlotKey, number>();
  for (const u of uploadTypes) {
    const slot = slotFromSurgeryType(u.type);
    if (slot) counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }
  return counts;
}

/** A required slot whose minCount is not yet satisfied, with reviewer-ready copy. */
export type SurgeryRequirementFailure = {
  key: SurgeryPhotoSlotKey;
  label: string;
  /** Photos required (minCount). */
  required: number;
  /** Photos currently uploaded for the slot. */
  current: number;
  /** Human-readable, e.g. "Pre-op donor requires 2 photos; currently has 1." */
  message: string;
};

function formatRequirementMessage(label: string, required: number, current: number): string {
  return `${label} requires ${required} photo${required === 1 ? "" : "s"}; currently has ${current}.`;
}

export function isValidSurgerySlot(value: string): value is SurgeryPhotoSlotKey {
  return SLOT_KEYS.has(value.trim().toLowerCase());
}

export function normalizeSurgerySlot(value: string): SurgeryPhotoSlotKey {
  const trimmed = value.trim().toLowerCase();
  if (!SLOT_KEYS.has(trimmed)) {
    throw new Error(`Invalid surgery photo slot: ${value}`);
  }
  return trimmed as SurgeryPhotoSlotKey;
}

export function surgeryTypeFromSlot(slot: SurgeryPhotoSlotKey): string {
  return `${SURGERY_PHOTO_TYPE_PREFIX}${slot}`;
}

export function slotFromSurgeryType(type: string): SurgeryPhotoSlotKey | null {
  if (!type?.startsWith(SURGERY_PHOTO_TYPE_PREFIX)) return null;
  const raw = type.slice(SURGERY_PHOTO_TYPE_PREFIX.length);
  return isValidSurgerySlot(raw) ? (raw as SurgeryPhotoSlotKey) : null;
}

/**
 * Required slots whose minCount is not satisfied (Stage 3.1). A slot counts as
 * "missing" when its uploaded photo count is below the configured minimum (>= 1).
 * When `config` is omitted/invalid this falls back to the base HairAudit checklist
 * (minCount 1), preserving Stage 1/2 behaviour for cases without a stored config.
 */
export function getMissingRequiredSurgerySlots(
  uploadTypes: { type: string }[],
  config?: unknown
): SurgeryPhotoSlotKey[] {
  return getSurgeryRequirementFailures(uploadTypes, config).map((f) => f.key);
}

/**
 * Per-slot requirement failures with reviewer-ready labels/messages. Authoritative
 * source for both server-side submission validation and client UX mirroring.
 */
export function getSurgeryRequirementFailures(
  uploadTypes: { type: string }[],
  config?: unknown
): SurgeryRequirementFailure[] {
  const counts = countsBySlotFromUploads(uploadTypes);
  const failures: SurgeryRequirementFailure[] = [];
  for (const slot of getResolvedSurgeryChecklist(config)) {
    if (!slot.effectiveRequired) continue;
    const required = slot.requiredCount;
    const current = counts.get(slot.key) ?? 0;
    if (current < required) {
      failures.push({
        key: slot.key,
        label: slot.label,
        required,
        current,
        message: formatRequirementMessage(slot.label, required, current),
      });
    }
  }
  return failures;
}

/**
 * Required-photo completion summary for progress UIs and counts. "total"/"done"
 * are slot-level (a slot is "done" once its minCount is met); "failures" carries
 * the count-aware detail used to render "1/2 required" style labels.
 */
export function getRequiredPhotoCompletion(
  uploadTypes: { type: string }[],
  config?: unknown
): {
  total: number;
  done: number;
  missing: SurgeryPhotoSlotKey[];
  failures: SurgeryRequirementFailure[];
} {
  const required = getRequiredSurgerySlots(config);
  const failures = getSurgeryRequirementFailures(uploadTypes, config);
  const missing = failures.map((f) => f.key);
  return {
    total: required.length,
    done: required.length - missing.length,
    missing,
    failures,
  };
}

/**
 * Stage 4A: minCount-aware required-photo completion for index/list summaries.
 *
 * Unlike getRequiredPhotoCompletion (which reports slot-level done/total — a slot
 * is "done" once its minCount is met), this reports PHOTO-COUNT totals so labels
 * read like "7/8 required photos" where 8 is the SUM of per-slot minCounts. Both
 * helpers share the same resolved checklist, so the six locked minimum slots plus
 * any clinic-promoted required slots and their minCounts are respected here too.
 *
 * - requiredCountTotal: sum of requiredCount (minCount) across required slots.
 * - requiredSatisfiedCount: sum of min(uploaded, requiredCount) per required slot,
 *   so extra photos in one slot never mask a shortfall in another.
 * - missingRequired: true when any required slot is below its minCount.
 */
export function getRequiredPhotoCountSummary(
  uploadTypes: { type: string }[],
  config?: unknown
): {
  requiredCountTotal: number;
  requiredSatisfiedCount: number;
  missingRequired: boolean;
} {
  const counts = countsBySlotFromUploads(uploadTypes);
  let requiredCountTotal = 0;
  let requiredSatisfiedCount = 0;
  for (const slot of getResolvedSurgeryChecklist(config)) {
    if (!slot.effectiveRequired) continue;
    const required = slot.requiredCount;
    const current = counts.get(slot.key) ?? 0;
    requiredCountTotal += required;
    requiredSatisfiedCount += Math.min(current, required);
  }
  return {
    requiredCountTotal,
    requiredSatisfiedCount,
    missingRequired: requiredSatisfiedCount < requiredCountTotal,
  };
}

/** Slots that are hidden by config but still have uploaded photos (evidence to surface). */
export function getHiddenSlotsWithUploads(
  uploadTypes: { type: string }[],
  config?: unknown
): SurgeryPhotoSlotKey[] {
  const present = presentSlotsFromUploads(uploadTypes);
  return getResolvedSurgeryChecklist(config)
    .filter((s) => s.state === "hidden" && present.has(s.key))
    .map((s) => s.key);
}
