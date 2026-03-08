# HairAudit Architecture Map

This document maps the current HairAudit system as implemented in the `hairaudit-v2` codebase.

## 1. System Overview

HairAudit is a Next.js App Router monolith that combines:

- Public marketing/auth website
- Role-based dashboards (patient, doctor, clinic, auditor)
- Case workflows (questionnaires, photos, submission, review)
- API layer (`src/app/api/**`)
- Async orchestration with Inngest
- Supabase (Auth + Postgres + Storage)
- OpenAI-powered analysis
- Playwright-based PDF rendering

Core production path:

1. Case data + photos are collected.
2. Submission emits `case/submitted`.
3. Inngest runs audit and graft-integrity jobs.
4. Report is versioned in DB and PDF is generated/uploaded.
5. Auditor can review/override/rerun.
6. Patient and participants view/download results.

---

## 2. Branch Schematic

```text
HairAudit
├── Public Website
│   ├── Marketing pages (`/`, `/about`, `/services`, `/how-it-works`, etc.)
│   ├── Auth pages (`/login`, `/login/auditor`, `/signup`)
│   └── Auth callback (`/auth/callback`)
├── Role Dashboards
│   ├── `/dashboard` role resolver
│   ├── `/dashboard/patient`
│   ├── `/dashboard/doctor`
│   ├── `/dashboard/clinic`
│   └── `/dashboard/auditor`
├── Case Workflows (`/cases/:caseId/*`)
│   ├── Patient questions/photos
│   ├── Doctor form/photos
│   ├── Clinic form/photos
│   ├── Submit for audit
│   ├── Graft Integrity view/review
│   └── Reports + rerun controls
├── API Layer
│   ├── Case APIs
│   ├── Answers APIs
│   ├── Upload APIs
│   ├── Auditor APIs
│   ├── Print/report/internal render APIs
│   └── Inngest endpoint
├── Background Jobs (Inngest)
│   ├── run-audit
│   ├── run-graft-integrity-estimate
│   ├── run-pdf-rebuild
│   └── auditor-rerun
├── Data Layer
│   ├── Supabase Postgres tables
│   └── Supabase storage bucket `case-files`
└── External Services
    ├── OpenAI
    ├── Inngest
    ├── Playwright/Chromium
    ├── Vercel runtime/protection integration
    └── Resend
```

---

## 3. Real System Flow

### 3.1 Patient submits case

1. Case created (`/api/cases/create` or `/cases/create`).
2. Patient answers saved via `/api/patient-answers`.
3. Patient photos uploaded via `/api/uploads/patient-photos`.
4. Submit button calls `/api/submit`.
5. `/api/submit` validates required photos, updates case status, emits `case/submitted`.
6. Inngest fan-out:
   - `run-audit`: evidence prep -> AI audit -> report version insert -> PDF phase
   - `run-graft-integrity-estimate`: estimate generation + DB upsert
7. PDF produced by internal renderer and uploaded to storage.
8. Patient views in `/cases/:caseId` and dashboard; downloads via `/api/reports/signed-url`.

### 3.2 Doctor/clinic submission

1. Doctor form `/cases/:caseId/doctor/form` -> `/api/doctor-answers`.
2. Doctor photos `/cases/:caseId/doctor/photos` -> `/api/uploads/doctor-photos`.
3. Clinic form `/cases/:caseId/clinic/form` -> `/api/clinic-answers`.
4. Clinic photos `/cases/:caseId/clinic/photos` -> `/api/uploads/clinic-photos`.
5. These signals are merged into report summary and used in next audit/rerun.

### 3.3 Auditor rerun + review

1. Auditor action sent to `/api/auditor/rerun`.
2. API logs `audit_rerun_log` row and emits `auditor/rerun`.
3. Inngest `auditor-rerun` invokes selected job(s):
   - `regenerate_ai_audit`
   - `regenerate_graft_integrity`
   - `rebuild_pdf`
   - `full_reaudit`
4. Auditor can review/approve/reject/override GII through `/api/auditor/graft-integrity/review`.

---

## 4. Major Components (Purpose Map)

| Component | Purpose | Primary Inputs | Primary Outputs | Depends On |
|---|---|---|---|---|
| `src/app/dashboard/page.tsx` | Role resolution + redirect | Auth user, profile role | Redirect to role dashboard | Supabase auth/admin |
| `src/app/cases/[caseId]/page.tsx` | Unified case command center | Case + role context | Submission/review/report UI | `cases`, `uploads`, `reports`, GII |
| `src/app/api/submit/route.ts` | Case submit + pipeline trigger | `caseId`, auth user | `cases` status update, event emit | `uploads`, Inngest |
| `src/lib/inngest/functions.ts` | Async job definitions | Inngest events | report/GII/PDF state transitions | AI libs, render libs, Supabase |
| `src/lib/evidence/prepareCaseEvidence.ts` | Deterministic image prep + manifest | case uploads | prepared images + manifest rows | `sharp`, storage |
| `src/lib/ai/audit.ts` | Forensic AI audit | answers + prepared images | structured audit JSON | OpenAI |
| `src/lib/ai/graftIntegrity.ts` | Graft integrity estimate | claimed grafts + donor/recipient images | estimated ranges/confidence | OpenAI |
| `src/lib/reports/renderPdfInternal.ts` | Internal PDF orchestration | caseId/version/mode | uploaded PDF path | print route + Playwright |
| `src/app/api/print/report/route.ts` | Elite print HTML endpoint | caseId/auditMode/token | renderable HTML | reports, manifests, GII |
| `src/lib/pdf/generateReportPdf.ts` | Browser print-to-PDF | print URL | PDF buffer | Playwright/Chromium |

---

## 5. Environment / Servers / Websites / Services

- **App server**: Next.js app on Vercel
- **Primary data platform**: Supabase
- **Workflow engine**: Inngest (`/api/inngest`)
- **AI**: OpenAI API
- **Renderer runtime**: Playwright + Chromium
- **Email notifications**: Resend
- **External site integration**: B12 CTA links (documented in `DEPLOYMENT.md`)

---

## 6. Key Routes and Responsibilities

### Public/Auth

- `/`, `/about`, `/services`, `/how-it-works`, `/faq`, `/privacy`, `/terms`, `/disclaimer`, `/follicle-intelligence`
- `/login`, `/login/auditor`, `/signup`
- `/auth/callback`

### Dashboards

- `/dashboard`
- `/dashboard/patient`
- `/dashboard/doctor`
- `/dashboard/clinic`
- `/dashboard/auditor`

### Cases

- `/cases/:caseId`
- `/cases/:caseId/patient/questions`
- `/cases/:caseId/patient/photos`
- `/cases/:caseId/doctor/form`
- `/cases/:caseId/doctor/photos`
- `/cases/:caseId/clinic/form`
- `/cases/:caseId/clinic/photos`
- `/cases/:caseId/audit`

### APIs

- Case: `/api/cases/create`, `/cases/create`, `/api/cases/delete`, `/api/submit`
- Answers: `/api/patient-answers`, `/api/doctor-answers`, `/api/clinic-answers`
- Uploads: `/api/uploads/patient-photos`, `/api/uploads/doctor-photos`, `/api/uploads/clinic-photos`, `/api/uploads/audit-photos`, `/api/uploads/list`, `/api/uploads/signed-url`, `/api/uploads/delete`
- Reports/print: `/api/reports/signed-url`, `/api/print/report`, `/api/print/legacy-report`
- Auditor: `/api/auditor/rerun`, `/api/auditor/graft-integrity/review`
- Internal PDF: `/api/internal/build-pdf`, `/api/internal/render-pdf`
- Jobs endpoint: `/api/inngest`

---

## 7. Background Jobs and Triggers

| Function ID | Trigger(s) | Purpose |
|---|---|---|
| `run-audit` | `case/submitted`, `case/audit-only-requested` | Full AI audit + report versioning + PDF phase |
| `run-graft-integrity-estimate` | `case/submitted`, `case/graft-integrity-only-requested` | GII range estimation pipeline |
| `run-pdf-rebuild` | `case/pdf-rebuild-requested` | Rebuild PDF for latest complete/pdf_ready report |
| `auditor-rerun` | `auditor/rerun` | Action dispatcher invoking other functions |

Producer routes:

- `/api/submit` -> emits `case/submitted`
- `/api/auditor/rerun` -> emits `auditor/rerun`

---

## 8. Data, Storage, and External APIs

### Tables actively referenced

- `profiles`
- `cases`
- `uploads`
- `reports`
- `audit_photos`
- `graft_integrity_estimates`
- `case_evidence_manifests`
- `audit_rerun_log`

### Storage

- Bucket: `case-files`
- Raw image uploads
- Prepared evidence images (`cases/{caseId}/prepared/...`)
- PDFs (`{caseId}/v{version}.pdf`)

### External APIs/services in code

- OpenAI chat completions (audit + GII)
- Inngest event/workflow API
- Supabase auth/db/storage APIs
- Playwright renderer
- Resend email API

---

## 9. Current Weak Points / Risk Areas

1. Duplicate case-create routes (`/cases/create` and `/api/cases/create`) with different auth handling.
2. `/api/reports/download` route name/behavior mismatch.
3. Upload helper endpoints (`/api/uploads/list`, `/api/uploads/signed-url`) are not case-auth scoped.
4. `middleware.ts` suggests protection intent but effectively permits pass-through.
5. Legacy and elite print routes coexist, increasing branching complexity.
6. Pipeline status compatibility logic is complex (`processing`, `pdf_pending`, `pdf_ready`, `complete`, `audit_failed`).
7. Submission event failure can leave partially advanced case state.
8. Internal secrets are multiplexed with broad fallback values.
9. Optional-feature table checks increase control-flow branching across dashboards and routes.

---

## 10. Recommended Cleanup / Simplification

### High Priority

- Add strict authz to `/api/uploads/list` and `/api/uploads/signed-url`.
- Consolidate to one canonical case-create API.
- Correct `/api/reports/download` naming or behavior.
- Separate internal render key from service-role fallback keying.
- Add robust retry/idempotency handling around submit-event dispatch.

### Medium Priority

- Decommission or isolate legacy print route.
- Formalize and simplify status state machine for `cases`/`reports`.
- Remove dead/unwired event triggers or wire explicit producers.
- Finish auditor role migration away from email override.

### Optional

- Add architecture tests for required environment variables.
- Add operational dashboards for `audit_rerun_log`, manifest quality, and PDF readiness failures.
- Reduce JSON-shape drift in report summary payloads with stricter schemas.

---

## Mermaid Diagram

```mermaid
flowchart TD
  A[Next.js UI Pages] --> B[API Routes]
  B --> C[(Supabase DB)]
  B --> D[(Supabase Storage: case-files)]
  B --> E[Inngest Events]

  E --> F[run-audit]
  E --> G[run-graft-integrity-estimate]
  E --> H[auditor-rerun]
  E --> I[run-pdf-rebuild]

  F --> J[prepareCaseEvidenceManifest]
  G --> J
  J --> C
  J --> D

  F --> K[OpenAI Audit]
  G --> L[OpenAI GII]
  F --> M[renderAndUploadPdfForCase]
  I --> M

  M --> N[/api/print/report]
  N --> O[Playwright PDF]
  O --> D
  M --> C

  P[Auditor UI] --> Q[/api/auditor/rerun]
  P --> R[/api/auditor/graft-integrity/review]
  Q --> E
  R --> C
```

---

## Route/File Index (quick navigation)

- App routes: `src/app/**/page.tsx`
- API routes: `src/app/api/**/route.ts`
- Inngest wiring: `src/app/api/inngest/route.ts`
- Inngest jobs: `src/lib/inngest/functions.ts`
- Submission entrypoint: `src/app/api/submit/route.ts`
- GII review: `src/app/api/auditor/graft-integrity/review/route.ts`
- Rerun API: `src/app/api/auditor/rerun/route.ts`
- PDF orchestration: `src/lib/reports/renderPdfInternal.ts`
- Print route (elite): `src/app/api/print/report/route.ts`
- Playwright renderer: `src/lib/pdf/generateReportPdf.ts`
- Evidence preparation: `src/lib/evidence/prepareCaseEvidence.ts`
- Role resolution: `src/lib/auth/isAuditor.ts`, `src/lib/case-access.ts`

