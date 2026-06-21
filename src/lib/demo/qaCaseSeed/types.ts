import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import type { PreSurgeryPlanningOutcomeId } from "@/lib/reports/preSurgeryPlanningReport";
import type { PostSurgeryProceduralOutcomeId } from "@/lib/reports/postSurgeryAuditReport";

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
};

export type DemoQaSeededCaseSummary = {
  scenario: DemoQaScenario;
  email: string;
  externalCaseId: string;
  summary: Record<string, unknown>;
  uploadTypes: string[];
};
