/** Qualitative patient-facing domain labels — no numeric scores in UI. */
export type PatientDomainAssessmentTone = "positive" | "neutral" | "attention" | "limited";

export type PatientDomainAssessment = {
  label: string;
  tone: PatientDomainAssessmentTone;
};

export function getPatientDomainAssessment(score: number | null): PatientDomainAssessment {
  if (score == null || !Number.isFinite(score)) {
    return { label: "Limited photo coverage", tone: "limited" };
  }
  if (score >= 80) return { label: "Within expected range", tone: "positive" };
  if (score >= 65) return { label: "Generally acceptable", tone: "neutral" };
  if (score >= 50) return { label: "Worth discussing with your clinician", tone: "attention" };
  return { label: "May benefit from follow-up", tone: "attention" };
}
