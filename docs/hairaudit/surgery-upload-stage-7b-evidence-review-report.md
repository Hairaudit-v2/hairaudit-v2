# Surgery Upload — Stage 7B Evidence Review Report

Implemented: non-AI PDF report for mobile surgery-upload cases, triggered by auditors only.

## Flow

1. **Auditor** opens the case page (`/cases/[caseId]`) and uses **Request Evidence Review Report** in the surgery upload review panel.
2. **POST** ` /api/admin/hair-audit/surgery-upload/[caseId]/request-report` validates:
   - authenticated user, auditor (`resolveSurgeryUploadActor` + `canTriggerAuditHandoff`)
   - `canAccessCase`
   - `surgery_upload_details` exists and `status === submitted`
   - pipeline not already `queued` / `running` / `succeeded`
3. Server **atomically** sets `surgery_upload_details.evidence_report_pipeline_status = queued` (from `not_started` or `failed`), stamps request metadata, appends **`surgery-upload/report-requested`** to `surgery_upload_evidence_events`, then sends Inngest **`hairAudit/surgeryUploadReportRequested`**.
4. **Inngest** `runSurgeryUploadEvidenceReviewReport` claims `running`, builds a **PDFKit** PDF (`src/lib/reports/surgeryUpload/buildSurgeryEvidenceReviewPdf.ts`), uploads to `case-files` under `cases/{caseId}/surgery-upload/evidence-review-v{n}.pdf`, inserts a **`reports`** row with `report_kind = surgery_upload_evidence_review_v1` and `status = complete`, updates `surgery_upload_details` to `succeeded` + `evidence_report_id`, logs **`surgery-upload/report-completed`**. Failures set `failed`, bounded `evidence_report_error`, and **`surgery-upload/report-failed`**.
5. UI refreshes; **Download evidence review PDF** uses existing **`GET /api/reports/signed-url`** (path contains `cases/{caseId}/…`).

## How this avoids the legacy submit pipeline

- **No** `POST /api/submit`, **no** `case/submitted`, **no** `runAudit` / `runGraftIntegrityEstimate` / AI audit.
- **No** updates to `cases.status`, `cases.submitted_at`, or forensic `reports` expectations beyond inserting a **discriminated** `reports` row.
- Case page **forensic** “latest report” uses **`forensicReports`**: `reports` rows where `report_kind` is null, so the evidence PDF does not replace the forensic latest report card.

## Migrations

- `supabase/migrations/20260604100000_surgery_upload_evidence_review_report_stage7b.sql` — `reports.report_kind`, `surgery_upload_details.evidence_report_*`, extended `surgery_upload_evidence_events` event types.

## Related design doc

- `docs/hairaudit/surgery-upload-report-pipeline-stage-7a.md` (pipeline inspection; 7B implements the dedicated Inngest path described there).
