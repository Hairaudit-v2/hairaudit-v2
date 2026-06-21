/**
 * Lightweight row shapes for core HairAudit tables.
 * Partial types inferred from migrations + insert/select usage — not from generated Supabase types.
 * Replace with `Database['public']['Tables'][...]['Row']` once `database.types.ts` is generated.
 */

import type {
  AuditorReviewEligibility,
  AuditorReviewReason,
  AuditorReviewStatus,
  ProvisionalStatus,
} from "@/lib/auditor/eligibility";
import type { CaseIntakeStatus, CaseStatus, ProfileRole, ReportStatus } from "./statusCatalog";

/** Minimal `cases` row for access checks and dashboards. */
export type CaseRow = {
  id: string;
  user_id?: string | null;
  patient_id?: string | null;
  doctor_id?: string | null;
  clinic_id?: string | null;
  title?: string | null;
  status?: CaseStatus | string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  audit_type?: "patient" | "doctor" | "clinic" | string | null;
  /** HA-DUAL-PATHWAY-1: pre_surgery | post_surgery patient public review pathway */
  patient_review_pathway?: "pre_surgery" | "post_surgery" | string | null;
  audit_mode?: "internal" | "public" | string | null;
  visibility_scope?: "public" | "internal" | string | null;
  submission_channel?:
    | "patient_submitted"
    | "clinic_submitted"
    | "doctor_submitted"
    | "imported"
    | string
    | null;
  assigned_auditor_id?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  is_test?: boolean | null;
  intake_status?: CaseIntakeStatus | string | null;
  external_case_id?: string | null;
  batch_id?: string | null;
  rerun_count?: number | null;
};

/** Versioned forensic or surgery-upload report row (subset). */
export type ReportRow = {
  id: string;
  case_id: string;
  version?: number | null;
  status?: ReportStatus | string | null;
  error?: string | null;
  pdf_path?: string | null;
  summary?: Record<string, unknown> | null;
  created_at?: string | null;
  report_kind?: string | null;
  patient_audit_version?: number | null;
  patient_audit_v2?: Record<string, unknown> | null;
  auditor_review_eligibility?: AuditorReviewEligibility | string | null;
  auditor_review_status?: AuditorReviewStatus | string | null;
  auditor_review_reason?: AuditorReviewReason | string | null;
  provisional_status?: ProvisionalStatus | string | null;
  counts_for_awards?: boolean | null;
  validation_method?: "auditor" | "evidence" | "consistency" | string | null;
  validated_at?: string | null;
  report_ready_email_sent_at?: string | null;
  external_document_id?: string | null;
};

/** `uploads` table row (forensic / surgery photo metadata). */
export type UploadRow = {
  id: string;
  case_id: string;
  user_id?: string | null;
  type: string;
  storage_path: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};
/** Canonical evidence photo metadata (`audit_photos`). */
export type AuditPhotoRow = {
  id: string;
  case_id: string;
  submitter_type: "doctor" | "patient" | string;
  photo_key: string;
  storage_path: string;
  public_url?: string | null;
  created_at?: string | null;
};

/** Evidence prep manifest (`case_evidence_manifests`). */
export type CaseEvidenceManifestRow = {
  id: string;
  case_id: string;
  status: "processing" | "ready" | "failed" | string;
  prepared_images?: unknown;
  quality_score?: number | null;
  missing_categories?: string[] | null;
  errors?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** `profiles` app role row. */
export type ProfileRow = {
  id: string;
  role: ProfileRole | string;
  display_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
