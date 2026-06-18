/**
 * Patient-facing concern severity bands derived from forensic audit findings.
 * Wording is intentionally cautious — not a clinical diagnosis.
 */

export type ForensicFindingSeverity = "low" | "medium" | "high" | "critical";

export type PatientConcernBand =
  | "none"
  | "minor"
  | "needs_review"
  | "significant"
  | "urgent";

const BAND_ORDER: readonly PatientConcernBand[] = [
  "none",
  "minor",
  "needs_review",
  "significant",
  "urgent",
];

export type PatientConcernBandDisplay = {
  band: PatientConcernBand;
  label: string;
  description: string;
  /** Tailwind classes for dark patient shell surfaces */
  shellClassName: string;
};

export const PATIENT_CONCERN_BAND_DISPLAY: Record<PatientConcernBand, PatientConcernBandDisplay> = {
  none: {
    band: "none",
    label: "No major concerns detected",
    description: "Based on your uploaded images, nothing urgent stands out. Continue routine follow-up with your clinic.",
    shellClassName: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  },
  minor: {
    band: "minor",
    label: "Minor observation",
    description: "We noticed a small point worth noting. This may be normal variation — discuss with your clinician if unsure.",
    shellClassName: "border-lime-300/30 bg-lime-300/10 text-lime-100",
  },
  needs_review: {
    band: "needs_review",
    label: "Needs review",
    description:
      "Something in your images may benefit from a closer look. This should be reviewed by a qualified clinician when convenient.",
    shellClassName: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  },
  significant: {
    band: "significant",
    label: "Significant concern",
    description:
      "This may indicate an issue that should be reviewed. Based on uploaded images only — please follow up with your treating clinic.",
    shellClassName: "border-orange-300/40 bg-orange-300/10 text-orange-100",
  },
  urgent: {
    band: "urgent",
    label: "Urgent — requires clinician review",
    description:
      "This should be reviewed by a qualified clinician promptly. HairAudit cannot diagnose — please contact your clinic or doctor.",
    shellClassName: "border-rose-300/45 bg-rose-300/15 text-rose-100",
  },
};

export const PATIENT_CLINICAL_SAFETY_DISCLAIMER =
  "This report is based on uploaded images and questionnaire answers only. It is not a medical diagnosis. Image quality may limit interpretation. Always follow advice from your treating clinician.";

export function normalizeForensicSeverity(value: unknown): ForensicFindingSeverity | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "low" || s === "medium" || s === "high" || s === "critical") return s;
  return null;
}

export function mapSeverityToConcernBand(
  severity: ForensicFindingSeverity | null | undefined,
  opts?: { isRedFlag?: boolean }
): PatientConcernBand {
  if (opts?.isRedFlag) {
    if (severity === "critical") return "urgent";
    if (severity === "high") return "significant";
    return "needs_review";
  }
  switch (severity) {
    case "critical":
      return "urgent";
    case "high":
      return "significant";
    case "medium":
      return "needs_review";
    case "low":
      return "minor";
    default:
      return "minor";
  }
}

export function maxConcernBand(a: PatientConcernBand, b: PatientConcernBand): PatientConcernBand {
  return BAND_ORDER.indexOf(a) >= BAND_ORDER.indexOf(b) ? a : b;
}

export function getConcernBandDisplay(band: PatientConcernBand): PatientConcernBandDisplay {
  return PATIENT_CONCERN_BAND_DISPLAY[band];
}
