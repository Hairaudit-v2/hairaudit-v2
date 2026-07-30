/**
 * HA-PATIENT-REPORT-UI-1A / 1A.2 — shared patient-safe donor copy.
 * Used by the web adapter and PDF HTML so limitations stay in sync.
 */

/** Evidence limitations shown on donor web shell and donor PDF. */
export const DONOR_EVIDENCE_LIMITATIONS = [
  "Photographs do not measure exact donor density.",
  "Permanent follicle loss may not be determinable from images alone.",
  "Lighting, hair length, angle, haircut, and image quality affect interpretation.",
  "Some conclusions require in-person examination.",
  "HairAudit does not replace urgent medical care.",
] as const;

export const DONOR_PDF_ORIENTATION_SECTION_TITLE = "Donor healing orientation";
export const DONOR_PDF_LIMITATIONS_TITLE = "Evidence limitations";
export const DONOR_PDF_STATUS_HEALING_STAGE = "Healing stage";
export const DONOR_PDF_STATUS_EVIDENCE = "Evidence";
export const DONOR_PDF_STATUS_NEXT_STEP = "Next step";
export const DONOR_PDF_HERO_SUBTITLE =
  "Donor healing review — structured orientation from your submitted photographs to discuss with your treating clinic.";
