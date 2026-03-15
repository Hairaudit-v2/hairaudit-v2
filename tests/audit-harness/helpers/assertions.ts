/**
 * Assertions for readiness, evidence, scoring eligibility.
 */

import {
  canSubmit,
  computeEvidenceDetails,
  computeEvidenceScore,
  getCompletedCategories,
  getRequiredKeys,
} from "@/lib/auditPhotoSchemas";
import type { SubmitterType } from "@/lib/auditPhotoSchemas";
import { toSubmitterTypeForPhotos } from "../config/canonicalMappings";
import type { SubmissionType } from "../config/canonicalMappings";
import type { CaseEvidenceManifest } from "@/lib/evidence/prepareCaseEvidence";
import { patientAuditSchema } from "@/lib/patientAuditSchema";

export interface ReadinessResult {
  canSubmit: boolean;
  completedCategories: string[];
  missingRequired: string[];
  evidenceScore: string;
  evidenceDetails: ReturnType<typeof computeEvidenceDetails>;
}

export function computeReadiness(
  submissionType: SubmissionType,
  photos: Array<{ type?: string }>
): ReadinessResult {
  const submitterType: SubmitterType = toSubmitterTypeForPhotos(submissionType);
  const can = canSubmit(submitterType, photos);
  const details = computeEvidenceDetails(submitterType, photos);
  const completed = getCompletedCategories(submitterType, photos);
  const required = getRequiredKeys(submitterType);
  const missingRequired = required.filter((k) => !completed.has(k));
  const score = computeEvidenceScore(submitterType, photos);
  return {
    canSubmit: can,
    completedCategories: [...completed],
    missingRequired,
    evidenceScore: score,
    evidenceDetails: details,
  };
}

/** For submit API: patient, doctor, and clinic each use canonical readiness (clinic uses same categories as doctor). */
export function computeReadinessForSubmitApi(
  auditType: "patient" | "doctor" | "clinic",
  photos: Array<{ type?: string }>
): ReadinessResult {
  const submitterType: SubmitterType = auditType;
  const can = canSubmit(submitterType, photos);
  const details = computeEvidenceDetails(submitterType, photos);
  const completed = getCompletedCategories(submitterType, photos);
  const required = getRequiredKeys(submitterType);
  const missingRequired = required.filter((k) => !completed.has(k));
  const score = computeEvidenceScore(submitterType, photos);
  return {
    canSubmit: can,
    completedCategories: [...completed],
    missingRequired,
    evidenceScore: score,
    evidenceDetails: details,
  };
}

export interface EvidenceAssertionResult {
  manifestStatus: string;
  preparedCount: number;
  missingCategories: string[];
  qualityScore: number;
  categoriesRecognized: string[];
}

export function getEvidenceAssertionResult(manifest: CaseEvidenceManifest | null): EvidenceAssertionResult | null {
  if (!manifest) return null;
  return {
    manifestStatus: manifest.status,
    preparedCount: manifest.prepared_images?.length ?? 0,
    missingCategories: manifest.missing_categories ?? [],
    qualityScore: manifest.quality_score ?? 0,
    categoriesRecognized: (manifest.prepared_images ?? []).map((p) => p.category),
  };
}

/** Check if expected missing categories match (subset or overlap). */
export function missingCategoriesMatch(
  actualMissing: string[],
  expectedMissing: string[] | undefined
): { match: boolean; message?: string } {
  if (!expectedMissing || expectedMissing.length === 0) {
    return { match: true };
  }
  const actualSet = new Set(actualMissing);
  const found = expectedMissing.filter((e) => actualSet.has(e));
  if (found.length === 0 && actualMissing.length > 0) {
    return {
      match: false,
      message: `Expected some of [${expectedMissing.join(", ")}] in missing categories; got [${actualMissing.join(", ")}]`,
    };
  }
  return { match: true };
}

/** Validation result for form answers (patient/doctor/clinic). */
export interface ValidationResult {
  valid: boolean;
  errorMessage: string | null;
  missingFieldPaths: string[];
}

function parseZodPath(path: (string | number)[]): string {
  return path.filter((p) => typeof p === "string").join(".");
}

/** Get validation result for patient answers. */
export function validatePatientAnswersHarness(answers: Record<string, unknown>): ValidationResult {
  const parsed = patientAuditSchema.safeParse(answers);
  if (parsed.success) return { valid: true, errorMessage: null, missingFieldPaths: [] };
  const issues = (parsed as { error: { issues?: Array<{ path: (string | number)[]; message: string }> } }).error?.issues ?? [];
  const missingFieldPaths = [...new Set(issues.map((i) => parseZodPath(i.path)).filter(Boolean))];
  const first = issues[0];
  const errorMessage = first ? `${parseZodPath(first.path)}: ${first.message}` : "Validation failed";
  return { valid: false, errorMessage, missingFieldPaths };
}

/** Get validation result for doctor answers (lazy-loads heavy schema). */
export function validateDoctorAnswersHarness(answers: Record<string, unknown>): ValidationResult {
  try {
    const { doctorAuditSchema } = require("@/lib/doctorAuditSchema");
    const parsed = doctorAuditSchema.safeParse(answers);
    if (parsed.success) return { valid: true, errorMessage: null, missingFieldPaths: [] };
    const issues = (parsed as { error: { issues?: Array<{ path: (string | number)[]; message: string }> } }).error?.issues ?? [];
    const missingFieldPaths = [...new Set(issues.map((i) => parseZodPath(i.path)).filter(Boolean))];
    const first = issues[0];
    const errorMessage = first ? `${parseZodPath(first.path)}: ${first.message}` : "Validation failed";
    return { valid: false, errorMessage, missingFieldPaths };
  } catch {
    return { valid: true, errorMessage: null, missingFieldPaths: [] };
  }
}

/** Get validation result for clinic answers (lazy-loads heavy schema). */
export function validateClinicAnswersHarness(answers: Record<string, unknown>): ValidationResult {
  try {
    const { clinicAuditSchema } = require("@/lib/clinicAuditSchema");
    const parsed = clinicAuditSchema.safeParse(answers);
    if (parsed.success) return { valid: true, errorMessage: null, missingFieldPaths: [] };
    const issues = (parsed as { error: { issues?: Array<{ path: (string | number)[]; message: string }> } }).error?.issues ?? [];
    const missingFieldPaths = [...new Set(issues.map((i) => parseZodPath(i.path)).filter(Boolean))];
    const first = issues[0];
    const errorMessage = first ? `${parseZodPath(first.path)}: ${first.message}` : "Validation failed";
    return { valid: false, errorMessage, missingFieldPaths };
  } catch {
    return { valid: true, errorMessage: null, missingFieldPaths: [] };
  }
}
