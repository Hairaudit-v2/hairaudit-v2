/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Clinician image roles mapped to canonical upload keys.
 *
 * Do not invent incompatible role names. Clinician-facing roles alias existing
 * patient_photo / projection evidence categories where equivalents exist.
 */

/** Clinician-facing pathway roles (spec vocabulary). */
export type PreSurgeryImageRole =
  | "frontal"
  | "frontal_hairline"
  | "top"
  | "crown"
  | "left_temporal"
  | "right_temporal"
  | "left_profile"
  | "right_profile"
  | "donor_occipital"
  | "donor_left"
  | "donor_right"
  | "miscellaneous"
  | "baseline"
  | "surgery_day"
  | "follow_up";

export const PRE_SURGERY_IMAGE_ROLES = [
  "frontal",
  "frontal_hairline",
  "top",
  "crown",
  "left_temporal",
  "right_temporal",
  "left_profile",
  "right_profile",
  "donor_occipital",
  "donor_left",
  "donor_right",
  "miscellaneous",
  "baseline",
  "surgery_day",
  "follow_up",
] as const satisfies readonly PreSurgeryImageRole[];

/** Canonical patient_photo category keys used by pathway / classifier. */
export type CanonicalUploadCategoryKey = string;

/**
 * Maps clinician roles → preferred patient upload category keys.
 * Multiple upload keys may resolve to one clinician role.
 */
export const IMAGE_ROLE_TO_UPLOAD_KEYS: Record<PreSurgeryImageRole, readonly string[]> = {
  frontal: ["preop_front", "patient_current_front"],
  frontal_hairline: ["preop_hairline_closeup", "preop_front"],
  top: ["preop_top", "patient_current_top"],
  crown: ["preop_crown", "patient_current_crown"],
  left_temporal: ["preop_left", "patient_current_left"],
  right_temporal: ["preop_right", "patient_current_right"],
  left_profile: ["preop_left", "patient_current_left"],
  right_profile: ["preop_right", "patient_current_right"],
  donor_occipital: ["preop_donor", "preop_donor_rear", "patient_current_donor_rear"],
  donor_left: ["donor_left", "preop_donor_left"],
  donor_right: ["donor_right", "preop_donor_right"],
  miscellaneous: ["misc", "supplemental", "uncategorized"],
  baseline: ["preop_front", "preop_top", "preop_left", "preop_right", "preop_donor"],
  surgery_day: ["any_day0", "surgery_day_recipient", "surgery_day_donor"],
  follow_up: ["follow_up", "month_3", "month_6", "month_12"],
};

/** Upload category / type suffix → clinician role. */
const UPLOAD_KEY_TO_ROLE: ReadonlyArray<{ match: RegExp; role: PreSurgeryImageRole }> = [
  { match: /hairline/i, role: "frontal_hairline" },
  { match: /preop_front|patient_current_front|^front$/i, role: "frontal" },
  { match: /preop_top|patient_current_top|^top$|vertex/i, role: "top" },
  { match: /preop_crown|patient_current_crown|^crown$/i, role: "crown" },
  { match: /donor_left|preop_donor_left/i, role: "donor_left" },
  { match: /donor_right|preop_donor_right/i, role: "donor_right" },
  { match: /donor|preop_donor|patient_current_donor/i, role: "donor_occipital" },
  { match: /preop_left|patient_current_left|left_profile/i, role: "left_profile" },
  { match: /preop_right|patient_current_right|right_profile/i, role: "right_profile" },
  { match: /day0|surgery_day|intraop/i, role: "surgery_day" },
  { match: /month_|follow_?up|postop/i, role: "follow_up" },
];

export function isPreSurgeryImageRole(value: unknown): value is PreSurgeryImageRole {
  return typeof value === "string" && (PRE_SURGERY_IMAGE_ROLES as readonly string[]).includes(value);
}

/** Resolve clinician role from upload type (`patient_photo:preop_front`) or bare category key. */
export function resolveImageRoleFromUploadKey(uploadTypeOrKey: string): PreSurgeryImageRole {
  const raw = String(uploadTypeOrKey ?? "").trim();
  const key = raw.includes(":") ? raw.split(":").slice(1).join(":") : raw;
  for (const row of UPLOAD_KEY_TO_ROLE) {
    if (row.match.test(key)) return row.role;
  }
  return "miscellaneous";
}

/** Preferred storage category when clinician assigns a role. */
export function preferredUploadKeyForRole(role: PreSurgeryImageRole): string {
  return IMAGE_ROLE_TO_UPLOAD_KEYS[role][0] ?? "misc";
}

/** Roles eligible as projection source images (frontal / overhead). */
export const PROJECTION_SOURCE_ROLES: readonly PreSurgeryImageRole[] = [
  "frontal",
  "frontal_hairline",
  "top",
] as const;

export function isProjectionSourceRole(role: PreSurgeryImageRole): boolean {
  return (PROJECTION_SOURCE_ROLES as readonly string[]).includes(role);
}

export const IMAGE_ROLE_LABELS: Record<PreSurgeryImageRole, string> = {
  frontal: "Frontal",
  frontal_hairline: "Frontal hairline",
  top: "Top / overhead",
  crown: "Crown",
  left_temporal: "Left temporal",
  right_temporal: "Right temporal",
  left_profile: "Left profile",
  right_profile: "Right profile",
  donor_occipital: "Donor (occipital)",
  donor_left: "Donor (left)",
  donor_right: "Donor (right)",
  miscellaneous: "Miscellaneous",
  baseline: "Baseline",
  surgery_day: "Surgery day",
  follow_up: "Follow-up",
};
