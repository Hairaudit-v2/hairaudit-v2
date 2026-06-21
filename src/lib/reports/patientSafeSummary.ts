import {
  getConcernBandDisplay,
  mapSeverityToConcernBand,
  maxConcernBand,
  normalizeForensicSeverity,
  PATIENT_CLINICAL_SAFETY_DISCLAIMER,
  type PatientConcernBand,
} from "./patientConcernBands";
import { buildPatientWhatHappensNext } from "./patientWhatHappensNext";
import {
  getPathwayDefinition,
  normalizePatientReviewPathway,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";

export type PatientSafeSummaryObservationStage =
  | "preop"
  | "day0"
  | "early_healing"
  | "month_1_3"
  | "month_4_6"
  | "month_7_12"
  | "month_12_plus"
  | "unknown";

export type PatientSafeSummaryObservation = {
  stage: PatientSafeSummaryObservationStage;
  text: string;
  severity?: "low" | "medium" | "high" | "critical";
  concernBand?: PatientConcernBand;
  isRedFlag?: boolean;
  impact?: string;
  recommendedNextStep?: string;
};

export type PatientSafeReportSummary = {
  overallConcernBand: PatientConcernBand;
  overallConcernLabel: string;
  overallConcernDescription: string;
  plainEnglishSummary: string;
  acceptableHighlights: string[];
  attentionItems: PatientSafeSummaryObservation[];
  concernItems: PatientSafeSummaryObservation[];
  whatHappensNext: ReturnType<typeof buildPatientWhatHappensNext>;
  clinicalDisclaimer: string;
  /** Backward-compatible flat list for translation pipeline */
  observations: PatientSafeSummaryObservation[];
  /** HA-DUAL-PATHWAY-1 — pathway-specific review focus areas */
  patientReviewPathway?: PatientReviewPathway;
  pathwayFocusAreas?: readonly string[];
};

/**
 * Generated narrative source remains canonical English. A later bounded render-layer
 * pilot may serve translated patient-safe summary observations, but this helper still
 * structures the English source summary only.
 */
export const PATIENT_SAFE_SUMMARY_NARRATIVE_MODE = "english_generated" as const;

function extractObservationText(entry: unknown): string {
  if (typeof entry === "string") return entry.trim();
  if (entry && typeof entry === "object" && "title" in (entry as Record<string, unknown>)) {
    const record = entry as Record<string, unknown>;
    return String(record.title ?? record.flag ?? "").trim();
  }
  if (entry && typeof entry === "object" && "flag" in (entry as Record<string, unknown>)) {
    return String((entry as Record<string, unknown>).flag ?? "").trim();
  }
  return "";
}

function extractField(entry: unknown, field: string): string | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  const v = (entry as Record<string, unknown>)[field];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function inferStage(text: string): PatientSafeSummaryObservationStage {
  const lower = text.toLowerCase();
  if (lower.includes("pre-op") || lower.includes("preop")) return "preop";
  if (lower.includes("day 0") || lower.includes("day0") || lower.includes("surgery day")) return "day0";
  if (lower.includes("healing")) return "early_healing";
  if (lower.includes("1 month") || lower.includes("3 month")) return "month_1_3";
  if (lower.includes("4 month") || lower.includes("5 month") || lower.includes("6 month")) return "month_4_6";
  if (
    lower.includes("7 month") ||
    lower.includes("8 month") ||
    lower.includes("9 month") ||
    lower.includes("10 month") ||
    lower.includes("11 month")
  ) {
    return "month_7_12";
  }
  if (lower.includes("12 month") || lower.includes("final")) return "month_12_plus";
  return "unknown";
}

function buildObservationFromEntry(
  entry: unknown,
  opts: { isRedFlag: boolean }
): PatientSafeSummaryObservation | null {
  const text = extractObservationText(entry);
  if (!text) return null;
  const severity = normalizeForensicSeverity(
    entry && typeof entry === "object" ? (entry as Record<string, unknown>).severity : null
  );
  const concernBand = mapSeverityToConcernBand(severity, { isRedFlag: opts.isRedFlag });
  return {
    stage: inferStage(text),
    text,
    severity: severity ?? undefined,
    concernBand,
    isRedFlag: opts.isRedFlag,
    impact: extractField(entry, "impact"),
    recommendedNextStep: extractField(entry, "recommended_next_step") ?? extractField(entry, "next_step"),
  };
}

function isPositiveFinding(text: string, severity: ReturnType<typeof normalizeForensicSeverity>): boolean {
  if (severity === "high" || severity === "critical") return false;
  const lower = text.toLowerCase();
  return (
    lower.includes("acceptable") ||
    lower.includes("within expected") ||
    lower.includes("good") ||
    lower.includes("healthy") ||
    lower.includes("no major") ||
    lower.includes("no significant")
  );
}

function buildPlainEnglishSummary(band: PatientConcernBand, concernCount: number): string {
  switch (band) {
    case "none":
      return "Based on your uploaded images, nothing urgent stands out in this review. Continue routine follow-up with your clinic.";
    case "minor":
      return "Most areas look acceptable. We noted a few minor observations you may want to mention at your next check-in.";
    case "needs_review":
      return "Some areas may benefit from a closer look with your clinician. This does not confirm a problem — it highlights topics worth discussing.";
    case "significant":
      return `We identified ${concernCount} area${concernCount === 1 ? "" : "s"} that may need attention. Please follow up with your treating clinic.`;
    case "urgent":
      return "We identified findings that should be reviewed by a clinician promptly. HairAudit cannot diagnose — please contact your doctor or clinic.";
    default:
      return "Your review summary is ready. The sections below explain what we observed and practical next steps.";
  }
}

export function buildPatientSafeReportSummary(
  summary: Record<string, unknown> | null | undefined,
  opts?: { patientReviewPathway?: PatientReviewPathway | unknown }
): PatientSafeReportSummary {
  const patientReviewPathway = normalizePatientReviewPathway(
    opts?.patientReviewPathway ??
      (summary as Record<string, unknown> | null | undefined)?.patient_review_pathway ??
      (
        (summary as Record<string, unknown> | null | undefined)?.metadata as
          | Record<string, unknown>
          | undefined
      )?.patientReviewPathway
  );
  const pathwayFocusAreas = getPathwayDefinition(patientReviewPathway).reportFocusAreas;
  const keyFindings = Array.isArray(summary?.key_findings) ? summary.key_findings : [];
  const redFlags = Array.isArray(summary?.red_flags) ? summary.red_flags : [];

  const structured: PatientSafeSummaryObservation[] = [];
  let overallBand: PatientConcernBand = "none";

  for (const entry of keyFindings.slice(0, 8)) {
    const obs = buildObservationFromEntry(entry, { isRedFlag: false });
    if (!obs) continue;
    structured.push(obs);
    if (obs.concernBand) overallBand = maxConcernBand(overallBand, obs.concernBand);
  }

  for (const entry of redFlags.slice(0, 4)) {
    const obs = buildObservationFromEntry(entry, { isRedFlag: true });
    if (!obs) continue;
    structured.push(obs);
    if (obs.concernBand) overallBand = maxConcernBand(overallBand, obs.concernBand);
  }

  const concernItems = structured.filter(
    (o) => o.concernBand && o.concernBand !== "none" && o.concernBand !== "minor"
  );
  const attentionItems = structured.filter((o) => o.concernBand === "minor" || o.isRedFlag);
  const acceptableHighlights = structured
    .filter((o) => isPositiveFinding(o.text, o.severity ?? null))
    .map((o) => o.text)
    .slice(0, 4);

  if (acceptableHighlights.length === 0 && overallBand === "none" && structured.length > 0) {
    acceptableHighlights.push("Several reviewed areas appear within expected ranges based on your images.");
  }

  const display = getConcernBandDisplay(overallBand);

  return {
    overallConcernBand: overallBand,
    overallConcernLabel: display.label,
    overallConcernDescription: display.description,
    plainEnglishSummary: buildPlainEnglishSummary(overallBand, concernItems.length),
    acceptableHighlights,
    attentionItems,
    concernItems,
    whatHappensNext: buildPatientWhatHappensNext(overallBand),
    clinicalDisclaimer: PATIENT_CLINICAL_SAFETY_DISCLAIMER,
    observations: structured,
    patientReviewPathway,
    pathwayFocusAreas,
  };
}

/** @deprecated Prefer buildPatientSafeReportSummary — kept for translation pipeline compatibility */
export function buildPatientSafeSummaryObservations(
  summary: Record<string, unknown> | null | undefined
): PatientSafeSummaryObservation[] {
  return buildPatientSafeReportSummary(summary).observations;
}

/**
 * Whether structured clinic answers exist on a report summary (aligned with CaseReadinessCard).
 * Ignores `field_provenance`-only objects.
 */
export function hasClinicAnswersInSummary(summary: Record<string, unknown> | null | undefined): boolean {
  const clinicAnswers = summary?.clinic_answers;
  if (!clinicAnswers || typeof clinicAnswers !== "object" || Array.isArray(clinicAnswers)) return false;
  const keys = Object.keys(clinicAnswers as Record<string, unknown>).filter((k) => k !== "field_provenance");
  return keys.length > 0;
}
