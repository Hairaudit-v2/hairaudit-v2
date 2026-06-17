/**
 * Registry of core HairAudit tables and cross-module status consistency helpers.
 * Used by Phase 1A drift tests (no database connection required).
 */

import { TRAINING_CASE_STATUSES as ACADEMY_TRAINING_CASE_STATUSES } from "@/lib/academy/trainingCaseCorrections/constants";
import {
  CASE_STATUSES,
  CASE_STATUS_IMPLYING_SUBMIT,
  CONTRIBUTION_REQUEST_STATUSES,
  DOCTOR_CASE_STATUSES,
  TRAINING_CASE_STATUSES,
} from "./statusCatalog";

/** Priority core tables for RLS, types, and upload consolidation. */
export const CORE_TABLE_NAMES = [
  "cases",
  "reports",
  "uploads",
  "audit_photos",
  "case_evidence_manifests",
  "upload_audit_corrections",
  "doctor_cases",
  "community_cases",
  "training_cases",
  "profiles",
  "doctor_profiles",
  "clinic_profiles",
] as const;

export type CoreTableName = (typeof CORE_TABLE_NAMES)[number];

/** Tables with CREATE TABLE DDL in `supabase/migrations/`. */
export const CORE_TABLES_WITH_CREATE_DDL: readonly CoreTableName[] = [
  "audit_photos",
  "case_evidence_manifests",
  "upload_audit_corrections",
  "doctor_cases",
  "community_cases",
  "training_cases",
  "profiles",
  "doctor_profiles",
  "clinic_profiles",
];

/** Baseline forensic tables — ALTER-only in repo; CREATE predates migrations. */
export const CORE_TABLES_BASELINE_ONLY: readonly CoreTableName[] = ["cases", "reports", "uploads"];

export function isCoreTableName(value: string): value is CoreTableName {
  return (CORE_TABLE_NAMES as readonly string[]).includes(value);
}

/** Ensures post-submit case status set is a subset of the full inventory. */
export function caseStatusImplyingSubmitIsSubsetOfCatalog(): boolean {
  return CASE_STATUS_IMPLYING_SUBMIT.every((s) => (CASE_STATUSES as readonly string[]).includes(s));
}

/** Academy training corrections module must stay aligned with central catalog. */
export function trainingCaseStatusesMatchAcademyConstants(): boolean {
  if (ACADEMY_TRAINING_CASE_STATUSES.length !== TRAINING_CASE_STATUSES.length) return false;
  return ACADEMY_TRAINING_CASE_STATUSES.every((s) => (TRAINING_CASE_STATUSES as readonly string[]).includes(s));
}

/** Contribution overlay statuses on `cases` that are not on `case_contribution_requests.status`. */
export const CONTRIBUTION_CASE_ONLY_STATUSES = ["request_closed", "request_expired"] as const;

export function contributionRequestStatusesAreDocumented(): boolean {
  // `doctor_contribution_started` is written to case_contribution_requests only (contribution-portal submit).
  const mirroredOnCases = CONTRIBUTION_REQUEST_STATUSES.filter((s) => s !== "doctor_contribution_started");
  return mirroredOnCases.every((s) => (CASE_STATUSES as readonly string[]).includes(s));
}

export function doctorCaseStatusesMatchMigrationEnum(): boolean {
  // Postgres ENUM doctor_case_status — values frozen in 20260314000001
  const expected = [
    "draft",
    "submitted",
    "in_review",
    "needs_input",
    "completed",
    "archived",
  ] as const;
  return expected.every((s) => (DOCTOR_CASE_STATUSES as readonly string[]).includes(s));
}
