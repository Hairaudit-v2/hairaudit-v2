import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import type { DonorHealingOrientation } from "@/lib/patient/donorHealingEntry";
import type { PreSurgeryPlanningOutcomeId } from "@/lib/reports/preSurgeryPlanningReport";
import type { PostSurgeryProceduralOutcomeId } from "@/lib/reports/postSurgeryAuditReport";

/** HA-PATIENT-REPORT-UI-1A.1 — deterministic donor report fixture kinds. */
export type DemoQaDonorFixtureKind =
  | "orientation_confirmed"
  | "orientation_corrected"
  | "missing_orientation_fallback"
  | "partial_donor_evidence"
  | "direct_clinical_assessment";

export type DemoQaDonorFixtureConfig = {
  kind: DemoQaDonorFixtureKind;
  /**
   * When true, omit donor_healing_orientation from the stored summary
   * while keeping entry_context (fallback adapter path).
   */
  omitOrientationRecord?: boolean;
  /** Force clinician-corrected next state when kind is orientation_corrected. */
  correctedState?: DonorHealingOrientation;
  /** Override upload keys for partial / full donor evidence sets. */
  donorUploadKeys?: readonly string[];
};

export type DemoQaForensicConfig = {
  overallScore: number;
  sectionScores: Record<string, number>;
  summary: string;
  keyFindings: Array<{ title: string; severity: "low" | "medium" | "high" }>;
  redFlags?: Array<{ flag: string; severity: "low" | "medium" | "high" }>;
  photoObservations?: Array<{ category: string; observation: string }>;
};

export type DemoQaIntelligencePatch = {
  norwoodStage?: string;
  crownProgression?: string;
  diffuseThinningPattern?: string;
  donorDensityBand?: string;
  donorReserveRisk?: string;
  miniaturisationSuspicion?: string;
  overharvestingIndicators?: string;
  repairComplexityBand?: string;
  overallConfidence?: string;
};

export type DemoQaScenario = {
  id: string;
  pathway: PatientReviewPathway;
  index: number;
  slug: string;
  title: string;
  intakeAnswers: Record<string, unknown>;
  forensic: DemoQaForensicConfig;
  intelligencePatch?: DemoQaIntelligencePatch;
  /** Extra recommended upload keys beyond pathway defaults (first 1–2 used when seeding). */
  extraRecommendedUploadKeys?: readonly string[];
  expectedPreOutcome?: PreSurgeryPlanningOutcomeId;
  expectedPostOutcome?: PostSurgeryProceduralOutcomeId;
  /** HA-PATIENT-REPORT-UI-1A.1 — donor-healing patient report fixtures. */
  donorFixture?: DemoQaDonorFixtureConfig;
};

export type DemoQaSeededCaseSummary = {
  scenario: DemoQaScenario;
  email: string;
  externalCaseId: string;
  summary: Record<string, unknown>;
  uploadTypes: string[];
};
