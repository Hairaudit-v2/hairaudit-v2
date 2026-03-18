# Report-ready patient notification

When a case successfully completes and the report is available, the patient receives an email: **"Your HairAudit report is ready"**.

## Where the notification is triggered

1. **Main audit pipeline (production)**  
   **File:** `src/lib/inngest/functions.ts`  
   **Function:** `runAudit` (Inngest event: `case/submitted` or `case/audit-only-requested`).  
   **Point:** After step 13 ("finalize-pdf-ready-phase") and step "refresh-transparency-metrics", step **"notify-patient-report-ready"** runs.  
   - Case status is already `complete`, report has `pdf_path` and status `pdf_ready`.  
   - Idempotency: `reports.report_ready_email_sent_at` is set in a conditional update; only the first run sends the email.

2. **Legacy/simple pipeline (case-submitted-v1)**  
   **File:** `src/lib/inngest/functions/caseSubmitted.ts`  
   **Function:** `caseSubmitted` (Inngest event: `case/submitted`).  
   **Point:** After step 8 ("update case status"), step **"notify patient report ready"** runs.  
   - This function is **not** currently registered in `src/app/api/inngest/route.ts`; only `runAudit` is served for `case/submitted`. The notification is implemented here for consistency if this function is ever enabled.

## Email implementation

- **Module:** `src/lib/email.ts`  
- **Function:** `notifyPatientReportReady({ to, caseId, firstName? })`  
- **Subject:** `Your HairAudit report is ready`  
- **Content:** Greeting (first name if available), case reference, confirmation that the report is in the dashboard, CTA links to dashboard and case page.  
- **Infrastructure:** Uses existing `sendEmail()` (Resend); same env: `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL` (or `SITE_URL`).

## When the email is **not** sent

- No patient email (user has no email or not found).  
- Report generation failed (notification runs only after successful completion).  
- Idempotency: `report_ready_email_sent_at` already set for this report (duplicate completion events do not resend).  
- Missing `report_ready_email_sent_at` column (migration not applied): step skips sending and does not fail the pipeline.

## Idempotency

- **Column:** `reports.report_ready_email_sent_at` (timestamptz, nullable).  
- **Migration:** `supabase/migrations/20260318000001_report_ready_email_sent.sql`.  
- **Logic:** Before sending, an update sets `report_ready_email_sent_at = now()` only where it is `NULL`. If the update returns no row, the email was already sent for this report; the step exits without sending.

## Failure notifications unchanged

Existing failure flow is untouched: `notifyPatientAuditFailed` and `notifyAuditorAuditFailed` in `runAudit`’s `onFailure` handler remain as before.
