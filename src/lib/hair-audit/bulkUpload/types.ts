import type { BulkBatchStatus, BulkImageCategory, BulkIntakeStatus } from "./constants";

export type HairAuditCaseBatchRow = {
  id: string;
  created_by: string | null;
  doctor_id: string | null;
  clinic_id: string | null;
  batch_name: string;
  source_type: string;
  shared_surgery_date: string | null;
  shared_location: string | null;
  shared_punch_type: string | null;
  shared_punch_size: string | null;
  shared_extraction_method: string | null;
  shared_implantation_method: string | null;
  shared_equipment_notes: string | null;
  shared_preservation_notes: string | null;
  shared_general_notes: string | null;
  status: BulkBatchStatus;
  created_at: string;
  updated_at: string;
};

export type BulkCaseRow = {
  id: string;
  batch_id: string | null;
  case_label: string | null;
  patient_reference: string | null;
  patient_email: string | null;
  graft_count: number | null;
  hair_count: number | null;
  case_specific_notes: string | null;
  intake_status: BulkIntakeStatus | null;
  status: string | null;
  title: string | null;
  audit_type: string | null;
  doctor_id: string | null;
  clinic_id: string | null;
  created_at: string;
};

export type BulkCaseImageRow = {
  id: string;
  case_id: string | null;
  batch_id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  image_category: BulkImageCategory | null;
  sort_order: number;
  uploaded_by: string | null;
  created_at: string;
};

export type BulkCaseDraftInput = {
  clientKey: string;
  id?: string;
  case_label: string;
  patient_reference: string;
  patient_email: string;
  graft_count: number | null;
  hair_count: number | null;
  case_specific_notes: string;
};

export type BulkBatchDetailsInput = {
  batch_name: string;
  doctor_id: string | null;
  clinic_id: string | null;
  shared_surgery_date: string | null;
  shared_location: string;
  shared_punch_type: string;
  shared_punch_size: string;
  shared_extraction_method: string;
  shared_implantation_method: string;
  shared_equipment_notes: string;
  shared_preservation_notes: string;
  shared_general_notes: string;
};

export type BulkCaseReadiness = {
  intakeStatus: BulkIntakeStatus;
  isReady: boolean;
  missingFields: string[];
  imageCount: number;
};
