# HairAudit Operations Runbook

This runbook is for diagnosing stuck cases, failed audits, and PDF generation issues.

## 1. Common Failure Modes

- Case stuck in `submitted` or `processing`
- Latest report in `failed`
- Latest report in `pdf_pending`
- No downloadable PDF even when audit appears complete
- Graft Integrity estimate missing or stale

---

## 2. Critical Tables to Inspect

- `cases`
- `reports`
- `uploads`
- `case_evidence_manifests`
- `graft_integrity_estimates`
- `audit_rerun_log`

Use dashboard pages and debug endpoints first when available:

- `/dashboard/auditor`
- `/cases/:caseId`
- `/api/debug/cases`
- `/api/debug/reports`

---

## 3. Troubleshooting by Symptom

### A) Case submitted but no audit progress

Check:

1. `cases.status` and `submitted_at`
2. whether `/api/submit` returned success to client
3. Inngest delivery to `/api/inngest`
4. environment keys:
   - `INNGEST_EVENT_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

Primary code paths:

- `src/app/api/submit/route.ts`
- `src/app/api/inngest/route.ts`
- `src/lib/inngest/functions.ts`

Recovery:

- Auditor rerun using `/api/auditor/rerun` action `regenerate_ai_audit` or `full_reaudit`.

### B) Report failed (`status=failed`)

Check:

1. `reports.error` on latest version
2. `cases.status` (`audit_failed` expected on hard failure)
3. whether AI call failed in `runAIAudit`
4. evidence prep/manifests quality and errors

Primary code paths:

- `src/lib/inngest/functions.ts` (`run-audit` + onFailure)
- `src/lib/ai/audit.ts`
- `src/lib/evidence/prepareCaseEvidence.ts`

Recovery:

- If data issue: collect missing photos/answers, then rerun.
- If transient AI issue: auditor rerun `regenerate_ai_audit`.
- If repeated: auditor manual finalize path `/api/audit/finalize`.

### C) Report stuck in `pdf_pending`

Check:

1. readiness guard failures (`AUDIT_NOT_READY`) from print route
2. latest `reports.summary` completeness for print requirements
3. internal auth for render endpoints:
   - `INTERNAL_API_KEY`
   - `REPORT_RENDER_TOKEN`
   - `INTERNAL_BUILD_PDF_TOKEN`
4. Vercel protection bypass:
   - `VERCEL_AUTOMATION_BYPASS_SECRET`

Primary code paths:

- `src/lib/inngest/functions.ts` (pdf retry loop)
- `src/lib/reports/renderPdfInternal.ts`
- `src/app/api/internal/render-pdf/route.ts`
- `src/app/api/print/report/route.ts`
- `src/lib/pdf/generateReportPdf.ts`

Recovery:

- Trigger rerun action `rebuild_pdf`.
- If still failing, run `full_reaudit`.
- Validate Vercel protection bypass and print token config.

### D) Graft Integrity missing or not approved

Check:

1. latest row in `graft_integrity_estimates`
2. `auditor_status` (`pending`, `approved`, `needs_more_evidence`, `rejected`)
3. evidence sufficiency and limitation flags

Primary code paths:

- `src/lib/inngest/functions.ts` (`run-graft-integrity-estimate`)
- `src/lib/ai/graftIntegrity.ts`
- `src/app/api/auditor/graft-integrity/review/route.ts`

Recovery:

- Auditor rerun `regenerate_graft_integrity`.
- Auditor review route to approve/override.

---

## 4. Rerun Action Guide

Endpoint: `POST /api/auditor/rerun`

- `regenerate_ai_audit`: rerun AI + report pipeline
- `regenerate_graft_integrity`: rerun only GII estimation
- `rebuild_pdf`: rerender current latest complete report PDF
- `full_reaudit`: GII + AI audit sequence

Tracking:

- `audit_rerun_log.status`: `pending` -> `processing` -> `complete|failed`
- `audit_rerun_log.error`: failure details

---

## 5. Data Integrity Checks

Before reruns, verify:

1. Case exists and user assignments are valid (`cases`).
2. Required patient photos exist (`uploads` with patient categories).
3. Latest report summary exists and is parseable.
4. Storage objects exist for referenced paths.
5. No stale or conflicting status rows for same case/version.

---

## 6. Environment Validation Checklist

### Required core

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CASE_FILES_BUCKET`

### Pipeline + AI

- `INNGEST_EVENT_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional override)

### PDF/internal render

- `REPORT_RENDER_TOKEN` or `INTERNAL_API_KEY`/`INTERNAL_BUILD_PDF_TOKEN`
- `NEXT_PUBLIC_APP_URL` or `SITE_URL`
- `VERCEL_AUTOMATION_BYPASS_SECRET` (if deployment protection enabled)

### Notifications

- `RESEND_API_KEY`
- `NOTIFICATION_FROM_EMAIL`
- `AUDITOR_NOTIFICATION_EMAIL`

---

## 7. Known Risk Points (Operational)

- `POST /api/submit` can update case before event send; event send failure leaves partial progression.
- Upload helper routes currently have weaker auth scoping than report signed URL route.
- Legacy print path can cause confusion in debugging if accidentally used.
- Optional-feature table fallbacks can mask schema drift between environments.

---

## 8. Suggested On-Call Playbook

1. Open `/cases/:caseId` as auditor and review status chips + latest report error.
2. Check `audit_rerun_log` history for recent retries.
3. If missing evidence, request user data completion.
4. Run targeted rerun first (`rebuild_pdf` or `regenerate_graft_integrity`).
5. Escalate to `full_reaudit` if outputs are inconsistent.
6. If still failing, verify env config and internal token/protection setup.

