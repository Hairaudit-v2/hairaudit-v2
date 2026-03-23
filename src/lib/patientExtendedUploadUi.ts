/**
 * UI-only grouping for Stage 2 optional patient categories (storage keys).
 * Does not change REQUIRED_PATIENT_UPLOAD_CATEGORY_KEYS or audit bucket mapping.
 */

import {
  PATIENT_UPLOAD_CATEGORY_DEFS,
  type PatientUploadCategoryDef,
  type PatientUploadCategoryKey,
} from "./patientPhotoCategoryConfig";

export type PatientExtendedUploadGroupId =
  | "donor_monitoring"
  | "early_recovery"
  | "intraoperative_evidence"
  | "graft_handling_evidence"
  | "progress_tracking";

export type PatientExtendedUploadGroupSpec = {
  readonly id: PatientExtendedUploadGroupId;
  readonly title: string;
  /** Group-specific line (shown under section title). */
  readonly groupDescription: string;
  readonly keys: readonly PatientUploadCategoryKey[];
};

/** Ordered specs: keys must match Stage 2 hidden defs in patientPhotoCategoryConfig. */
export const PATIENT_EXTENDED_UPLOAD_GROUP_SPECS = [
  {
    id: "donor_monitoring",
    title: "Before Surgery & Surgery Day — back of head",
    groupDescription: "Before Surgery donor views, then Surgery Day and later back-of-head progress (1 Week Photos, 3 Month Photos, …).",
    keys: [
      "preop_donor_left",
      "preop_donor_right",
      "preop_donor_closeup",
      "day0_donor_rear",
      "day0_donor_left",
      "day0_donor_right",
      "day0_donor_closeup",
      "postop_day1_donor",
      "postop_week1_donor",
      "postop_month3_donor",
      "postop_month6_donor",
      "postop_month9_donor",
      "postop_month12_donor",
    ],
  },
  {
    id: "early_recovery",
    title: "Day After Surgery & 1 Week Photos",
    groupDescription: "Day After Surgery and 1 Week Photos for hairline and back of head.",
    keys: ["postop_day1_recipient", "postop_week1_recipient"],
  },
  {
    id: "intraoperative_evidence",
    title: "Surgery Day — during procedure",
    groupDescription: "Photos from during your procedure, if your clinic shared them.",
    keys: [
      "intraop_extraction",
      "intraop_donor_closeup",
      "intraop_recipient_sites",
      "intraop_implantation",
    ],
  },
  {
    id: "graft_handling_evidence",
    title: "Grafts on the tray",
    groupDescription: "Photos of how grafts were kept and counted, if you have them.",
    keys: [
      "graft_tray_overview",
      "graft_tray_closeup",
      "graft_sorting",
      "graft_hydration_solution",
      "graft_count_board",
    ],
  },
  {
    id: "progress_tracking",
    title: "3 Month Photos, 6 Month Photos, and more",
    groupDescription: "Photos from about 3, 6, 9, and 12 months after surgery.",
    keys: [
      "postop_month3_front",
      "postop_month3_top",
      "postop_month3_crown",
      "postop_month6_front",
      "postop_month6_top",
      "postop_month6_crown",
      "postop_month9_front",
      "postop_month9_top",
      "postop_month9_crown",
      "postop_month12_front",
      "postop_month12_top",
      "postop_month12_crown",
    ],
  },
] as const satisfies readonly PatientExtendedUploadGroupSpec[];

export type PatientExtendedUploadGroupResolved = PatientExtendedUploadGroupSpec & {
  readonly categories: readonly PatientUploadCategoryDef[];
};

const defByKey = new Map(PATIENT_UPLOAD_CATEGORY_DEFS.map((d) => [d.key, d]));

/** Resolve config defs for each group (for rendering cards). */
export function getPatientExtendedUploadGroupsResolved(): PatientExtendedUploadGroupResolved[] {
  return PATIENT_EXTENDED_UPLOAD_GROUP_SPECS.map((spec) => ({
    ...spec,
    categories: spec.keys.map((k) => {
      const def = defByKey.get(k);
      if (!def) throw new Error(`patientExtendedUploadUi: missing PATIENT_UPLOAD_CATEGORY_DEFS for ${k}`);
      return def;
    }),
  }));
}

/** Copy for the extended block header (Stage 3). */
export const PATIENT_EXTENDED_UPLOAD_MICROCOPY = {
  eyebrow: "Before Surgery Photos (Optional)",
  body: "Extra Before Surgery angles, Surgery Day detail, Early Healing, and 3 / 6 / 9 / 12 Month Photos live below. None of this block is required to submit your case.",
} as const;
