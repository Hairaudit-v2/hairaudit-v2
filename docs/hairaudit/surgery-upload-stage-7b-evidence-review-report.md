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

---

## Stage 7C — Admin polish and regression protection

**UI (`SurgeryUploadReviewPanel`):** Per-phase copy for the **non-AI evidence review report** (`not_started`, `queued`, `running`, `succeeded`, `failed`). Shows **requested at / requested by** and **completed at** when present; shows bounded **failure** text for auditors; if pipeline is `succeeded` but the PDF path is missing, shows an **amber warning** instead of a broken download. **Retry** uses the same POST route as the initial request (allowed from **`failed`** only server-side; **`cancelled`** remains blocked by policy).

**Forensic isolation:** `filterForensicAuditReports` in `src/lib/reports/forensicReportsFilter.ts` centralizes “latest forensic report” filtering so `report_kind = surgery_upload_evidence_review_v1` rows never replace forensic version history / latest card.

### Report state machine (current product)

```
not_started ──request──► queued ──Inngest claim──► running ──success──► succeeded
    ▲                        │                         │
    │                        │                         └──► failed
    └──── retry (request again) ◄─── only from failed (and not_started); API claim accepts not_started | failed
```

- **One successful PDF per case** is enforced by design: `evaluateSurgeryEvidenceReportRequest` returns **409** when `evidence_report_pipeline_status === succeeded` (download the existing file). A new version would require relaxing that gate, bumping `reports.version`, and optionally retaining history (e.g. child table or multiple `reports` rows with the same kind + UI to pick “latest evidence PDF”).

### Regression tests

- `tests/surgeryEvidenceReportRequest.test.ts` — eligibility matrix including **failed retry**, **running**, **null details**, **cancelled**.
- `tests/surgeryEvidenceReportStage7cRegression.test.ts` — source-level assertions that the request route and Inngest job do not reference **`case/submitted`**, **`/api/submit`**, **`submitted_at`**, or **`from("cases")`**; plus forensic filter behavior.

### Legacy submit path

Stage 7C does **not** change `/api/submit`, `runAudit`, or `cases` write paths; it only adds UI/docs/tests and a small report filter helper.
