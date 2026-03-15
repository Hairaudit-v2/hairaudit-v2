/**
 * Scenario definition types for the audit test harness.
 */

import type { SubmissionType } from "../config/canonicalMappings";

export type ProcedureType = "fue" | "fut" | "combined" | "dhi" | "robotic" | "not_sure" | "other";

/** Which image categories to attach (category key → optional path to file; empty path = use default fixture) */
export type ImageMapping = Record<string, string | true>;

/** Scenario classification for summary display (positive vs negative, gold, legacy, etc.). */
export type ScenarioClassification =
  | "gold"
  | "negative-readiness"
  | "negative-validation"
  | "legacy"
  | "provenance"
  | "normalization"
  | "positive";

/** Short "why this scenario passes" / expected outcome for table display. */
export type PassReason =
  | "expected full pass"
  | "expected readiness fail"
  | "expected validation fail"
  | "expected score blocked"
  | "expected legacy normalization"
  | "expected provenance"
  | "other";

export interface ScenarioMeta {
  id: string;
  name: string;
  submissionType: SubmissionType;
  procedureType?: ProcedureType;
  description?: string;
  /** Legacy naming / alias scenario */
  legacyAliases?: boolean;
  /** Defaults / provenance scenario (doctor/clinic) */
  provenance?: boolean;
  /** Override defaults scenario */
  overrides?: boolean;
}

export interface ScenarioExpectations {
  /** Case and answers should be stored successfully */
  caseCreated?: boolean;
  answersStored?: boolean;
  uploadsStored?: boolean;
  /** Evidence manifest should recognize uploaded categories */
  evidenceRecognizesCategories?: boolean;
  /** canSubmit(submitterType, photos) result */
  readinessPass?: boolean;
  /** Expected missing categories when readiness fails (exact match not required; harness checks subset) */
  expectedMissingCategories?: string[];
  /** Expected missing fields (form) when validation fails */
  expectedMissingFields?: string[];
  /** Scoring should run when prerequisites met */
  scoringEligible?: boolean;
  /** Scoring should not run or be flagged when prerequisites missing */
  scoringBlocked?: boolean;
  /** Auditor-facing missing evidence consistent */
  auditorMissingConsistent?: boolean;
  /** Provenance present where expected */
  provenancePresent?: boolean;
  /** Defaults/overrides handled correctly */
  defaultsHandled?: boolean;
  /** Notes for human reader */
  notes?: string;
}

/** Optional legacy upload to insert (type = e.g. patient_photo:donor_rear). Storage path can be faked for DB-only test. */
export interface LegacyUploadSpec {
  type: string;
  storage_path?: string;
}

export interface ScenarioDefinition {
  meta: ScenarioMeta;
  /** Answers payload (patient_audit_v2, doctor_answers, or clinic_answers shape) */
  answers: Record<string, unknown>;
  /** Categories we will attach images for (key = category, value = path or true for default) */
  imageMapping: ImageMapping;
  /** Optional: legacy upload types to insert (e.g. patient_photo:donor_rear) to assert normalization */
  legacyUploads?: LegacyUploadSpec[];
  expectations: ScenarioExpectations;
}
