# HairAudit V2 — Phase 0B RLS & Access Inventory

**Date:** 2026-06-17  
**References:** [ecosystem audit](./hairaudit-ecosystem-convergence-audit.md), [Phase 0A plan](./hairaudit-v2-phase-0-security-hardening-plan.md)  
**Draft SQL:** [docs/sql/hairaudit-phase-0b-rls-draft.sql](./sql/hairaudit-phase-0b-rls-draft.sql)  
**Status:** Inventory + guardrails implemented; core RLS **not applied** (staging validation required)

---

## Executive summary

| Category | Count | Phase 0B action |
|----------|-------|-----------------|
| Baseline tables without CREATE DDL | 3 (`cases`, `reports`, `uploads`) | Document DDL in Phase 1; RLS draft only |
| Tables with RLS | 40+ | Extend auditor policies where gaps exist |
| Tables without RLS (sensitive) | 4 (`community_*` pair, `upload_audit_corrections`, baseline trio) | Community: API guards added; core: draft SQL |
| Service-role request routes | ~90 API routes | Acceptable when app-gated; see route map |
| Browser direct DB writes on core tables | 1 (`upload-panel.tsx`) | Block in Phase 2; documented risk |

---

## Table inventory

Legend: **Safe now** = low-risk policy or guard can ship; **Staged** = needs staging regression; **Phase 1** = schema/DDL prerequisite.

### Forensic audit core

| Table | CREATE in repo | RLS enabled | Ownership / access model | Known access paths | Safe to add RLS now? | Risk | Recommended action |
|-------|----------------|-------------|--------------------------|-------------------|----------------------|------|-------------------|
| **cases** | No (baseline) | No | `user_id`, `patient_id`, `doctor_id`, `clinic_id`; app `canAccessCase` | API routes, dashboards, Inngest, pages (`admin ?? auth`) | **Staged** | **HIGH** | Phase 1: baseline DDL dump; staging apply draft SELECT/UPDATE policies |
| **reports** | No (baseline) | No | FK `case_id`; versioned `summary` JSONB | submit, patient-answers, Inngest, PDF, download | **Staged** | **HIGH** | Draft SELECT-via-case only; writes stay service role |
| **uploads** | No (baseline) | No | FK `case_id`, `storage_path` → `case-files` | Upload APIs, signed-url, list, delete, Inngest | **Staged** | **HIGH** | Draft SELECT/INSERT/DELETE via case participant; remove `upload-panel` first |
| **audit_photos** | Yes (`20250225000002`) | Yes | Case participants; no auditor policy | `POST /api/uploads/audit-photos`, evidence prep | **Safe now** | LOW | Add auditor SELECT policy (draft SQL) |
| **case_evidence_manifests** | Yes (`20260308000002`) | Yes | Participants + auditor read; service role write | Inngest evidence prep | No change | LOW | Keep service-role writes |
| **graft_integrity_estimates** | Yes (`20260227000001`) | Yes | Participants + auditor; service role insert | GII Inngest, auditor review API | No change | LOW | — |
| **audit_score_overrides** | Yes (`20260309000004`) | Yes | Case stakeholders read; auditor write | Auditor override APIs | No change | LOW | — |
| **audit_section_feedback** | Yes (`20260309000008`) | Yes | Visibility-scoped read; auditor write | Auditor section feedback API | No change | LOW | — |
| **upload_audit_corrections** | Yes (`20260322000001`) | **No** | Service role only (auditor corrections) | Auditor upload correction flows | **Safe now** | MEDIUM | Draft auditor SELECT-only RLS |
| **audit_rerun_log** | Yes (`20260308000001`) | Partial | Service role writes | Auditor rerun API | Staged | MEDIUM | Phase 1 policy review |

### Clinic / doctor transparency

| Table | CREATE in repo | RLS enabled | Ownership model | Access paths | Safe now? | Risk | Action |
|-------|----------------|-------------|-----------------|--------------|-----------|------|--------|
| **profiles** | Yes (`20250210000001`) | Yes | Self: `auth.uid() = id` | `/api/profiles`, auth callback | No change | LOW | Phase 0A role policy sufficient |
| **clinic_profiles** | Yes (`20260309000002`) | Yes | Owner SELECT (`linked_user_id`); writes service role | Clinic portal, public `/clinics/[slug]` via admin | No change | LOW | — |
| **doctor_profiles** | Yes (`20260309000002`) | Yes | Owner SELECT; writes service role | Doctor onboarding, leaderboards | No change | LOW | — |
| **patient_profiles** | **N/A** | — | Patients = `auth.users` + `profiles.role = patient` | — | — | — | No dedicated table |
| **case_contribution_requests** | Yes (`20260309000002`) | Yes | Case members SELECT; token submit via service role | `/api/contribution-portal/submit`, contribute UI | No change | MEDIUM | Token path must stay service role |
| **clinic_award_history** / **doctor_award_history** | Yes | Yes | Owner SELECT | Awards UI | No change | LOW | — |

### Doctor portal v2 (parallel case model)

| Table | CREATE in repo | RLS enabled | Ownership model | Access paths | Safe now? | Risk | Action |
|-------|----------------|-------------|-----------------|--------------|-----------|------|--------|
| **doctor_cases** | Yes (`20260314000001`) | Yes | SELECT owner (`doctor_user_id`); writes service role | Doctor portal v2 (isolated) | No change | LOW | Document boundary vs forensic `cases` |
| **doctor_case_uploads** | Yes | Yes | SELECT via owning doctor_case | Doctor portal uploads | No change | LOW | — |

### Academy / training

| Table | CREATE in repo | RLS enabled | Ownership model | Access paths | Safe now? | Risk | Action |
|-------|----------------|-------------|-----------------|--------------|-----------|------|--------|
| **training_cases** | Yes (`20260401120001`) | Yes | Academy staff/trainee helpers | `/api/academy/*`, academy pages | No change | LOW | — |
| **training_case_uploads** | Yes | Yes | Academy helpers | Academy upload API | No change | LOW | — |

### Community

| Table | CREATE in repo | RLS enabled | Ownership model | Access paths | Safe now? | Risk | Action |
|-------|----------------|-------------|-----------------|--------------|-----------|------|--------|
| **community_cases** | Yes (`20260313000002`) | **No** | Public published rows; writes via service role API | `/api/community-cases` GET/POST | **Partial** | MEDIUM | API payload guards added (0B); RLS Option B in draft SQL |
| **community_case_ratings** | Yes | **No** | Inserts via service role API | `/api/community-cases/rate` | **Partial** | MEDIUM | Keep service role; add edge rate limit Phase 1 |

### Surgery upload / bulk admin

| Table | CREATE in repo | RLS enabled | Ownership model | Access paths | Safe now? | Risk | Action |
|-------|----------------|-------------|-----------------|--------------|-----------|------|--------|
| **surgery_upload_details** | Yes (`20260604000001`) | Yes | `surgery_upload_case_access()` | Surgery upload APIs | No change | LOW | — |
| **hair_audit_case_images** | Yes (`20260526120001`) | Yes | Auditor admin helper | Bulk upload admin | No change | LOW | — |

### Integration / shadow

| Table | CREATE in repo | RLS enabled | Ownership model | Access paths | Safe now? | Risk | Action |
|-------|----------------|-------------|-----------------|--------------|-----------|------|--------|
| **hairaudit_auditos_shadow_snapshots** | Yes (`20260615090000`) | Yes | Service role only | Inngest shadow logging | No change | LOW | — |

---

## Service role usage — request-facing route map

All routes below use `createSupabaseAdminClient()` unless noted. Categorization:

| Category | Meaning |
|----------|---------|
| **A — Acceptable** | Auth + case/role gate before admin query |
| **R — Risky** | Missing auth or public write surface |
| **P — Policy first** | Needs RLS before reducing service role |
| **I — Internal** | Server-to-server; must use dedicated API key |

### A — Acceptable (auth + access gate confirmed)

| Route area | Gate |
|------------|------|
| `/api/uploads/*` (patient, clinic, doctor, audit photos) | Session + `canAccessCase` / role checks |
| `/api/uploads/signed-url`, `/api/uploads/list` | `requireCaseAccess` + path gate |
| `/api/reports/signed-url`, `/api/reports/[id]/download` | `requireUser` + `loadAuthorizedReportPdfDownloadContext` |
| `/api/patient-answers`, `/api/doctor-answers`, `/api/clinic-answers` | Session + case access |
| `/api/submit` | Session + case owner/participant |
| `/api/audit/save-manual`, `/api/audit/finalize` | Auditor only |
| `/api/auditor/*` | Auditor profile / email policy |
| `/api/surgery-upload/*` | Session + `canAccessCase` / surgery actor |
| `/api/cases/delete` | Session + owner + draft-only |
| `/api/contribution-portal/submit` | Contribution token hash (not session) |
| `/api/admin/hair-audit/*` | Auditor admin |
| `/api/academy/*` (protected) | Academy membership / RLS |

### I — Internal (service role removed from auth in 0B)

| Route | Auth mechanism |
|-------|----------------|
| `/api/internal/render-pdf` | `INTERNAL_API_KEY` / `REPORT_RENDER_TOKEN` / `INTERNAL_BUILD_PDF_TOKEN` only (**no service role**) |
| `/api/internal/build-pdf` | Outbound dedicated key (0A) |
| `/api/print/report` | Render token HMAC |

### R — Risky / public (mitigated in 0B)

| Route | Issue | 0B mitigation |
|-------|-------|---------------|
| `/api/community-cases` POST | Unauthenticated write | Payload size guards (`communityApiGuard`) |
| `/api/community-cases/rate` POST | Unauthenticated rating spam | Validation centralized; edge rate limit Phase 1 |
| `/api/community-cases` GET | Public read (intentional) | Published filter only |

### P — Policy first (do not remove service role yet)

| Surface | Reason |
|---------|--------|
| Inngest functions (`src/lib/inngest/functions.ts`) | Pipeline orchestration; bypasses RLS by design |
| Auth callback profile upsert | Bootstrap profiles before RLS context |
| `/api/debug/*`, `/api/audit/seed-*` | Dev-only; gated in 0A |

---

## Signed URL & storage guardrails

| Surface | TTL | Gate | File |
|---------|-----|------|------|
| Upload preview | 60s | User + `requireCaseAccess` + `gateUploadSignedUrlStoragePath` | `src/app/api/uploads/signed-url/route.ts` |
| Upload list | 600s | Same + type prefix filter | `src/app/api/uploads/list/route.ts` |
| Report PDF | 60s | User + case access + path belongs to case | `src/app/api/reports/signed-url/route.ts` |
| Report download | — | Session + `loadAuthorizedReportPdfDownloadContext` | `src/app/api/reports/[reportId]/download/route.ts` |
| Report HTML | — | Render token **or** session + `canAccessCase` | `src/app/reports/[caseId]/html/page.tsx` |
| Academy | 120s | Academy member + RLS | `src/app/api/academy/signed-url/route.ts` |
| Bulk admin | 120s | Auditor + `cases/bulk/` prefix | `src/app/api/admin/hair-audit/bulk-upload/signed-url/route.ts` |

**Path namespaces allowed:** `cases/{uuid}/…`, `audit_photos/{uuid}/…` (see `src/lib/uploads/caseFilesPath.ts`).

**Known bypass:** `src/app/cases/[caseId]/upload-panel.tsx` — browser client INSERT to `uploads` + storage. Orphan; not in nav. **Do not enable uploads RLS INSERT until removed.**

---

## Token-based access (not Postgres RLS)

| Token | Storage | Validation | Route |
|-------|---------|------------|-------|
| Contribution portal | `case_contribution_requests.secure_token_hash` | HMAC with `CONTRIBUTION_TOKEN_SECRET` | `/api/contribution-portal/submit` |
| Report render | Query param `token` | HMAC with `REPORT_RENDER_TOKEN` / `INTERNAL_API_KEY` | `/api/print/report`, HTML page |
| Internal PDF | Header `x-internal-api-key` | Dedicated env keys only | `/api/internal/render-pdf` |

---

## Phase 0B code changes (this pass)

| Change | File |
|--------|------|
| Internal API auth without service role | `src/lib/security/internalApiAuth.ts`, `src/app/api/internal/render-pdf/route.ts` |
| Community payload guards | `src/lib/security/communityApiGuard.ts`, community API routes |
| RLS draft SQL | `docs/sql/hairaudit-phase-0b-rls-draft.sql` |

---

## Recommended phase timeline

| Phase | Work |
|-------|------|
| **0B (now)** | Inventory, guardrails, draft SQL, internal API hardening |
| **0B staging** | Apply RLS draft to staging; run full audit pipeline regression |
| **Phase 1** | Commit baseline DDL for `cases`/`reports`/`uploads`; generated types; enable RLS in production |
| **Phase 1** | Community edge rate limiting; middleware protected routes |
| **Phase 2** | Remove `upload-panel.tsx`; consolidate upload paths |

---

## Production deploy prerequisites (0B)

1. **`INTERNAL_API_KEY`** or **`REPORT_RENDER_TOKEN`** set — required for `/api/internal/render-pdf` (service role no longer accepted).
2. **`CONTRIBUTION_TOKEN_SECRET`** set (from 0A).
3. Staging smoke test: submit case → Inngest → PDF → download.
4. Do **not** apply `hairaudit-phase-0b-rls-draft.sql` to production until Phase 1 checklist complete.

---

*Inventory generated 2026-06-17. Align with live Supabase schema before any migration.*
