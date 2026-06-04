// Stage 8C — stable CRM/CMS manifest identifiers and CSV column order.

/** Integer version for CRM/CMS parsers (bump only on breaking CSV/JSON shape changes). */
export const EXPORT_MANIFEST_VERSION = 1 as const;

/** Stable product identifier for downstream ingestion. */
export const EXPORT_SOURCE = "hairaudit_mobile_surgery_upload" as const;

/** Alias for export logs; kept equal to manifest version unless schemas diverge. */
export const EXPORT_MANIFEST_SCHEMA_VERSION = EXPORT_MANIFEST_VERSION;

/**
 * CRM-facing CSV columns (order is stable; document changes in
 * docs/hairaudit/surgery-upload-crm-cms-integration-stage8c.md).
 */
export const CRM_CSV_COLUMNS = [
  "manifest_version",
  "export_source",
  "patient_name",
  "patient_reference",
  "case_reference",
  "surgery_date",
  "clinic_name",
  "surgeon",
  "procedure_type",
  "photo_category",
  "photo_category_key",
  "original_filename",
  "exported_filename",
  "uploaded_at",
  "uploaded_by",
  "added_after_review_request",
  "quality_warning",
  "width",
  "height",
  "original_size_bytes",
  "compressed_size_bytes",
  "file_included",
  "skip_reason",
] as const;

export type CrmCsvColumn = (typeof CRM_CSV_COLUMNS)[number];
