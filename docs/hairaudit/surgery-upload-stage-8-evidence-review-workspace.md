# Surgery upload — Stage 8: Evidence review workspace

## Purpose

Stage 8 adds an **auditor-only evidence review workspace** on the surgery-upload case page. It supports structured review of uploaded surgery evidence **before or alongside** requesting the non-AI **Evidence Review Report** PDF (Stage 7B/7C).

The workspace is explicitly **not** the legacy HairAudit forensic audit:

- It does **not** call `/api/submit`.
- It does **not** emit `case/submitted`.
- It does **not** mutate `cases.status` or `cases.submitted_at`.
- It does **not** start the forensic AI audit pipeline.

Clinic-facing “overall evidence review” notes (Stage 5) remain on `surgery_upload_details.evidence_review_notes` / `evidence_review_status`. Stage 8 stores **internal workspace** notes and flags separately so the non-AI PDF can summarize reviewer intent without conflating workflows.

## UI placement

- Component: `src/components/surgery-upload/SurgeryUploadEvidenceWorkspace.tsx`
- Rendered inside `SurgeryUploadReviewPanel` when `isAuditor` is true (same gate as the non-AI report request panel).
- The **Non-AI evidence review report** strip shows a compact summary (completeness ratio, flag count, last workspace note timestamp) and links to `#surgery-upload-evidence-workspace`.

## Evidence grouping

Uploads are grouped into reviewer-facing categories derived from existing `surgery_photo:<slot>` types and light heuristics for non-photo filenames:

| Group | Typical sources |
| --- | --- |
| Pre-op / baseline | `preop_donor`, `preop_recipient` |
| Donor extraction | `extraction_progress` |
| Recipient implantation | `implantation_progress` |
| Hairline design | `hairline_design` |
| Graft handling / graft quality | `graft_quality`, `petri_graft_sorting` |
| Post-op / immediate result | `postop_donor`, `postop_recipient` |
| Consent / documentation | Non–`surgery_photo` types whose names suggest documents/consents, or `other` slot uploads tagged with `metadata.evidence_workspace_category = "consent_documentation"` |
| Uncategorised | `complication`, `other` (default), or unmatched types |

Implementation: `src/lib/surgeryUpload/evidenceReviewWorkspace.ts` (`groupUploadsByEvidenceWorkspaceCategory`, `evidenceWorkspaceCategoryForUpload`).

## Completeness checklist

The checklist is **derived** from `surgery_upload_details` + `uploads` (not stored as its own row). It covers administrative items such as procedure date, clinic, surgeon, graft counts, extraction/implantation methods, punch size (optional row — excluded from the headline ratio), donor/recipient/hairline/post-op photo presence, and consent/documentation when document-like uploads exist.

Counts for the workspace header and report summary use **only rows where `countsTowardRatio` is true** (everything except the optional punch row).

## Reviewer notes and flags (persisted)

Stored on `surgery_upload_details`:

| Column | Meaning |
| --- | --- |
| `evidence_review_workspace_notes` | Internal reviewer notes for the evidence workspace / PDF |
| `evidence_review_workspace_notes_updated_by` | `auth.users` id |
| `evidence_review_workspace_notes_updated_at` | Timestamp |
| `evidence_review_workspace_flags` | JSONB array of `{ "code": string, "detail"?: string }` |
| `evidence_review_workspace_flags_updated_by` | `auth.users` id |
| `evidence_review_workspace_flags_updated_at` | Timestamp |

Allowed flag codes: `missing_donor_photos`, `missing_recipient_photos`, `missing_graft_count`, `poor_image_quality`, `incomplete_clinic_doctor_details`, `inconsistent_procedure_metadata`, `other` (requires `detail`).

Writes go through **`PATCH /api/admin/hair-audit/surgery-upload/[caseId]/evidence-workspace`** (auditor/admin gate mirrors the Stage 7B report request route).

## Sign-off readiness (display only)

`deriveEvidenceReportReadiness` maps pipeline + checklist + flags to one of:

- **Report completed** — `evidence_report_pipeline_status === succeeded`
- **Report already requested** — `queued`, `running`, `failed`, or `cancelled`
- **Ready for evidence report** — `not_started`, checklist ratio satisfied, no flags
- **Needs more evidence** — `not_started`, gaps or flags

This **does not** change Stage 7B server gating; `evaluateSurgeryEvidenceReportRequest` remains authoritative for whether a report can be queued.

## How data feeds the non-AI PDF

`buildSurgeryEvidenceReviewPdfInput` (`src/lib/reports/surgeryUpload/surgeryEvidenceReviewPdfModel.ts`) assembles:

- Completeness checklist + ratio
- Workspace notes + parsed flags
- Non-empty grouped evidence counts (labels + counts + sample upload types)

`buildSurgeryEvidenceReviewPdfBuffer` embeds that as **Section 6 — Evidence review workspace (Stage 8)** ahead of the existing per-slot thumbnail section.

## Separation from forensic / legacy audit reports

- Evidence review PDFs use `report_kind = surgery_upload_evidence_review_v1` (Stage 7A/7B).
- Forensic reports remain filtered via `filterForensicAuditReports` (Stage 7C) so evidence PDFs never replace the latest forensic audit row in UI.

## Migration

`supabase/migrations/20260604120000_surgery_upload_evidence_review_workspace_stage8.sql` adds the workspace columns to `surgery_upload_details`.
