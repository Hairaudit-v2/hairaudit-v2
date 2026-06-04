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
};

export type SurgeryChecklistConfig = {
  version: number;
  slots: Partial<Record<SurgeryPhotoSlotKey, SurgeryChecklistSlotConfig>>;
};

export const CHECKLIST_CONFIG_VERSION = 1;

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
    slots[slot.key] = { state: slot.required ? "required" : "optional", order: index };
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
        ? (rawSlots[slot.key] as { state?: unknown; order?: unknown } | undefined)
        : undefined;

    if (LOCKED_SLOT_SET.has(slot.key)) {
      // Locked slots can never be optional/hidden in Stage 3.
      slots[slot.key] = { state: "required", order: coerceOrder(entry?.order, index) };
      return;
    }

    const state: SurgerySlotState = isValidState(entry?.state)
      ? entry!.state
      : "optional";
    slots[slot.key] = { state, order: coerceOrder(entry?.order, index) };
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
  order: number;
};

/**
 * Resolve a stored config (or null) into the full, ordered slot list. Accepts raw
 * JSONB; invalid configs safely fall back to the base HairAudit checklist.
 */
export function getResolvedSurgeryChecklist(config?: unknown): ResolvedSurgerySlot[] {
  const sane = sanitizeSurgeryChecklistConfig(config);
  const resolved: ResolvedSurgerySlot[] = SURGERY_PHOTO_SLOTS.map((slot) => {
    const entry = sane.slots[slot.key] ?? { state: "optional" as SurgerySlotState };
    const state = LOCKED_SLOT_SET.has(slot.key) ? "required" : entry.state;
    return {
      ...slot,
      state,
      locked: LOCKED_SLOT_SET.has(slot.key),
      effectiveRequired: state === "required",
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
 * Returns the required slots that have zero uploads, using the resolved checklist.
 * When `config` is omitted/invalid this falls back to the base HairAudit checklist,
 * preserving Stage 1/2 behaviour for cases without a stored config.
 */
export function getMissingRequiredSurgerySlots(
  uploadTypes: { type: string }[],
  config?: unknown
): SurgeryPhotoSlotKey[] {
  const present = presentSlotsFromUploads(uploadTypes);
  return getRequiredSurgerySlots(config).filter((slot) => !present.has(slot));
}

/** Required-photo completion summary for progress UIs and counts. */
export function getRequiredPhotoCompletion(
  uploadTypes: { type: string }[],
  config?: unknown
): { total: number; done: number; missing: SurgeryPhotoSlotKey[] } {
  const required = getRequiredSurgerySlots(config);
  const present = presentSlotsFromUploads(uploadTypes);
  const missing = required.filter((slot) => !present.has(slot));
  return { total: required.length, done: required.length - missing.length, missing };
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
