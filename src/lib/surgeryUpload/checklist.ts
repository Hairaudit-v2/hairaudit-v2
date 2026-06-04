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

export const REQUIRED_SURGERY_PHOTO_SLOTS: SurgeryPhotoSlotKey[] =
  SURGERY_PHOTO_SLOTS.filter((s) => s.required).map((s) => s.key);

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

/** Returns the required slots that have zero uploads. */
export function getMissingRequiredSurgerySlots(
  uploadTypes: { type: string }[]
): SurgeryPhotoSlotKey[] {
  const present = new Set<string>();
  for (const u of uploadTypes) {
    const slot = slotFromSurgeryType(u.type);
    if (slot) present.add(slot);
  }
  return REQUIRED_SURGERY_PHOTO_SLOTS.filter((slot) => !present.has(slot));
}
