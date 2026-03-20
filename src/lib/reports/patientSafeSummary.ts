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
    return String((entry as Record<string, unknown>).title ?? "").trim();
  }
  return "";
}

function inferStage(text: string): PatientSafeSummaryObservationStage {
  const lower = text.toLowerCase();
  if (lower.includes("pre-op") || lower.includes("preop")) return "preop";
  if (lower.includes("day 0") || lower.includes("day0") || lower.includes("surgery day")) return "day0";
  if (lower.includes("healing")) return "early_healing";
  if (lower.includes("1 month") || lower.includes("3 month")) return "month_1_3";
  if (lower.includes("4 month") || lower.includes("5 month") || lower.includes("6 month")) return "month_4_6";
  if (lower.includes("7 month") || lower.includes("8 month") || lower.includes("9 month") || lower.includes("10 month") || lower.includes("11 month")) {
    return "month_7_12";
  }
  if (lower.includes("12 month") || lower.includes("final")) return "month_12_plus";
  return "unknown";
}

export function buildPatientSafeSummaryObservations(
  summary: Record<string, unknown> | null | undefined
): PatientSafeSummaryObservation[] {
  const keyFindings = Array.isArray(summary?.key_findings) ? summary.key_findings : [];
  const redFlags = Array.isArray(summary?.red_flags) ? summary.red_flags : [];
  const structured: PatientSafeSummaryObservation[] = [];

  for (const entry of [...keyFindings, ...redFlags].slice(0, 8)) {
    const text = extractObservationText(entry);
    if (!text) continue;
    structured.push({ stage: inferStage(text), text });
  }

  return structured;
}
