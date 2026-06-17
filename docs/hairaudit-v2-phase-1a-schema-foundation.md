# HairAudit V2 — Phase 1A Schema Foundation

**Date:** 2026-06-17  
**Scope:** Schema inventory, status catalog, partial TypeScript types, type-generation workflow  
**Not in scope:** RLS deployment, upload refactor, FI OS migration, production DDL changes  

**References:** [ecosystem audit](./hairaudit-ecosystem-convergence-audit.md), [Phase 0A](./hairaudit-v2-phase-0-security-hardening-plan.md), [Phase 0B RLS inventory](./hairaudit-v2-phase-0b-rls-access-inventory.md), [RLS draft SQL](./sql/hairaudit-phase-0b-rls-draft.sql)

---

## Executive summary

HairAudit Postgres spans six domains on one Supabase instance. **64 migrations** extend schema, but **`cases`, `reports`, and `uploads` lack CREATE TABLE DDL in the repo** — they predate tracked migrations. Phase 1A documents the inferred baseline, centralizes confirmed status values, adds partial row types, and defines a safe type-generation path without committing secrets.

| Deliverable | Location |
|-------------|----------|
| Status inventory | `src/lib/hairaudit/statusCatalog.ts` |
| Partial row types | `src/lib/hairaudit/tableTypes.ts` |
| Table / drift registry | `src/lib/hairaudit/schemaRegistry.ts` |
| Drift tests | `tests/schemaFoundationPhase1a.test.ts` |
| Type generation script | `npm run gen:supabase-types` → `src/lib/supabase/database.types.ts` |

**Generated types:** Not committed in Phase 1A — generation requires Supabase CLI auth against a live project (see below).

---

## Ownership model (forensic core)

Access is enforced in application code (`canAccessCase`, route guards) and documented for future RLS in Phase 0B draft SQL.

| Entity | Primary table | Ownership keys | Notes |
|--------|---------------|----------------|-------|
| Case shell | `cases` | `user_id`, `patient_id`, `doctor_id`, `clinic_id` | No FK to `clinic_profiles` / `doctor_profiles` |
| Report | `reports` | `case_id` → `cases` | Versioned rows; monolithic `summary` JSONB |
| Upload metadata | `uploads` | `case_id`, `user_id` | `storage_path` → `case-files` bucket |
| Evidence photos | `audit_photos` | `case_id` | Canonical `audit_photos/{caseId}/…` paths |
| Evidence manifest | `case_evidence_manifests` | `case_id` | Prepared derivatives metadata |
| App role | `profiles` | `id` = `auth.users.id` | RLS: self read/update |
| Clinic transparency | `clinic_profiles` | `linked_user_id` → auth | Public slug pages via admin reads |
| Doctor transparency | `doctor_profiles` | `linked_user_id`, `clinic_profile_id` | Leaderboards, clinic linkage |
| Doctor portal v2 | `doctor_cases` | `doctor_user_id` | **Parallel** case model, not forensic `cases` |
| Academy | `training_cases` | `training_doctor_id` | Isolated from `profiles.role` |
| Community | `community_cases` | None (public published rows) | No `status` column |

**Auditor access:** App-layer + service role; draft RLS helper `hairaudit_user_can_access_case()` includes auditors.

**Patient entity:** No `patients` table — `auth.users` + `profiles.role = 'patient'` + `cases.patient_id`.

---

## Core tables — DDL presence

Legend: **CREATE** = full `CREATE TABLE` in repo migrations; **ALTER-only** = table assumed from production baseline; **FK-only** = referenced by other migrations without CREATE.

### Priority tables

| Table | CREATE in repo | RLS (current) | Primary migration(s) |
|-------|----------------|---------------|----------------------|
| **cases** | **No** (baseline) | No | ALTER from `20250210000001` onward |
| **reports** | **No** (baseline) | No | `20250210000004`, `20250225000001`, `20260309000005`, … |
| **uploads** | **No** (baseline) | No | Referenced by `audit_photos`, upload APIs |
| **audit_photos** | Yes | Yes | `20250225000002` |
| **case_evidence_manifests** | Yes | Yes | `20260308000002` |
| **upload_audit_corrections** | Yes | **No** | `20260322000001` |
| **doctor_cases** | Yes | Yes | `20260314000001` |
| **community_cases** | Yes | **No** | `20260313000002` |
| **training_cases** | Yes | Yes | `20260401120001`, `20260520120001` |
| **profiles** | Yes | Yes | `20250210000001` |
| **doctor_profiles** | Yes | Yes | `20260309000002` |
| **clinic_profiles** | Yes | Yes | `20260309000002` |

### Inferred baseline columns (not in repo CREATE)

**`cases`** — confirmed from inserts, selects, and ALTER migrations:

| Column group | Examples | Source |
|--------------|----------|--------|
| Identity | `id`, `user_id`, `title`, `status`, `submitted_at`, `created_at` | `createCase.ts`, dashboards |
| Participants | `patient_id`, `doctor_id`, `clinic_id` | `20250210000001` |
| Classification | `audit_type`, `audit_mode`, `visibility_scope`, `submission_channel` | `20260313000001`, `20260319000001`, `20260313000004` |
| Auditor lifecycle | `assigned_auditor_id`, `archived_at`, `deleted_at`, … | `20260313000001` |
| Evidence display | `evidence_score_doctor/patient`, `confidence_label_*`, `evidence_details` | `20250225000002` |
| Pipeline ops | `rerun_count`, `processing_log`, `is_test` | `20260315000002`, `20260227000003` |
| Bulk intake | `batch_id`, `case_label`, `patient_reference`, `intake_status` | `20260526120001` |
| Integration | `external_case_id` | `20260316000001` |

**`reports`** — confirmed from Inngest inserts and ALTER migrations:

| Column group | Examples | Source |
|--------------|----------|--------|
| Core | `id`, `case_id`, `version`, `pdf_path`, `summary`, `created_at` | Inngest, answer APIs |
| Pipeline | `status`, `error` | `20250210000004`, Inngest |
| Patient v2 | `patient_audit_version`, `patient_audit_v2` | `20250225000001` |
| Auditor review | `auditor_review_eligibility`, `auditor_review_status`, `auditor_review_reason` | `20260309000005` |
| Awards | `provisional_status`, `counts_for_awards`, `validation_method`, … | `20260309000006` |
| Kinds | `report_kind` (NULL = forensic) | `20260604100000` |
| Integration | `external_document_id`, `report_ready_email_sent_at` | `20260316000001`, `20260318000001` |

**`uploads`** — confirmed from upload APIs:

| Column | Notes |
|--------|-------|
| `id` | Optional client-provided in legacy `upload-panel.tsx` |
| `case_id`, `user_id` | Required on server upload routes |
| `type` | e.g. `patient_photo:*`, `surgery_photo:*`, `doctor_photo:*` |
| `storage_path` | Path in `case-files` bucket |
| `metadata` | JSONB: category, mime, size, display name |
| `created_at` | Returned on insert |

---

## Status fields and enums

Central module: `src/lib/hairaudit/statusCatalog.ts`. Summary:

### `cases.status` (TEXT, no DB CHECK)

| Category | Values |
|----------|--------|
| Pre-submit | `draft` |
| Submit / pipeline | `submitted`, `processing`, `evidence_preparing`, `evidence_ready`, `audit_running`, `audit_complete`, `pdf_pending`, `pdf_ready`, `complete` |
| Failure | `audit_failed`, `failed` |
| Contribution overlay | `clinic_request_pending`, `clinic_request_sent`, `clinic_viewed_request`, `doctor_contribution_received`, `benchmark_recalculated`, `benchmark_eligible`, `request_closed`, `request_expired` |
| Other app | `in_review` |

`cases.intake_status` (separate column): `draft`, `incomplete`, `ready_for_audit`.

### `reports.status`

Default `complete` (migration). Inngest writes pipeline phases (`evidence_preparing` … `pdf_ready`) with fallback to `processing` / `complete` / `failed`.

### `reports.auditor_review_*`

| Field | Values |
|-------|--------|
| `auditor_review_eligibility` | `not_eligible`, `eligible_low_score`, `eligible_high_score`, `eligible_manual_unlock` |
| `auditor_review_status` | `not_requested`, `available`, `in_review`, `completed`, `skipped` |
| `auditor_review_reason` | `low_score_extreme`, `high_score_extreme`, `manual_admin_unlock` |

### `reports.provisional_status`

`none`, `pending_validation`, `validated_by_auditor`, `validated_by_evidence`, `validated_by_consistency`, `rejected`.

### Upload-related

| Table / field | Values |
|---------------|--------|
| `case_evidence_manifests.status` | `processing`, `ready`, `failed` |
| `upload_audit_corrections.action` | `reassign`, `rename`, `exclude`, `restore` |
| `doctor_case_uploads.upload_state` | `uploaded`, `processing`, `ready`, `failed` |

### Parallel case models

| Table | Status mechanism |
|-------|------------------|
| `doctor_cases.status` | Postgres ENUM `doctor_case_status`: `draft`, `submitted`, `in_review`, `needs_input`, `completed`, `archived` |
| `training_cases.status` | CHECK: `draft`, `in_review`, `reviewed`, `archived`, `voided` |
| `community_cases` | No status — `is_published` boolean |
| `surgery_upload_details.status` | `draft`, `submitted` |
| `surgery_upload_details.evidence_review_status` | `not_reviewed`, `in_review`, `needs_more_evidence`, `evidence_accepted`, `ready_for_audit` |

### Contribution requests

`case_contribution_requests.status`: `clinic_request_pending` … `benchmark_eligible` (see migration CHECK). Terminal case overlays: `request_closed`, `request_expired`.

---

## Foreign key assumptions

| From | To | ON DELETE | Notes |
|------|-----|-----------|-------|
| `reports.case_id` | `cases.id` | (baseline) | Assumed FK in production |
| `uploads.case_id` | `cases.id` | (baseline) | Assumed FK |
| `audit_photos.case_id` | `cases.id` | CASCADE | In migration |
| `case_evidence_manifests.case_id` | `cases.id` | CASCADE | In migration |
| `upload_audit_corrections.upload_id` | `uploads.id` | CASCADE | **No FK on `case_id`** |
| `doctor_cases.doctor_user_id` | `auth.users` | CASCADE | Doctor portal v2 |
| `profiles.id` | `auth.users` | CASCADE | In migration |
| `clinic_profiles.linked_user_id` | `auth.users` | SET NULL | In migration |
| `cases.clinic_id` / `doctor_id` | `auth.users` | — | **Not** `clinic_profiles` / `doctor_profiles` |

---

## Migration risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| Baseline DDL missing for `cases`/`reports`/`uploads` | **HIGH** | Dump staging schema; commit baseline migration in Phase 1B |
| `cases.status` unconstrained TEXT | MEDIUM | Status catalog + tests; optional CHECK in Phase 1B after inventory freeze |
| Dual case models (`cases` vs `doctor_cases`) | MEDIUM | Document boundaries; no merge in Phase 1A |
| `upload-panel.tsx` direct browser INSERT | MEDIUM | Remove in Phase 2 before `uploads` RLS INSERT policy |
| Service role bypasses RLS | Expected | Inngest + gated APIs continue using admin client |
| Contribution token path (no `auth.uid()`) | MEDIUM | Keep service role for token hash lookup |

---

## Required staging verification (before RLS)

1. **Schema dump:** `cases`, `reports`, `uploads` CREATE TABLE + indexes match inferred columns above.
2. **Type generation:** `npm run gen:supabase-types` against staging; commit `database.types.ts`.
3. **Patient path:** create case → upload → submit → PDF download.
4. **Signed URLs:** upload list/preview TTL and path gates.
5. **Inngest:** full `case/submitted` pipeline statuses on case + report rows.
6. **Contribution:** token portal submit does not break with RLS on `cases` (service role).
7. **Surgery upload:** `surgery_upload_details.status` independent of `cases.status` (regression tests exist).
8. **Community:** public GET still works; POST guarded (Phase 0B).

---

## Generated types

**Status:** Not generated in Phase 1A (requires live Supabase credentials).

**Blocker:** `supabase gen types` needs either:

- Linked project: `npx supabase login` + `npx supabase link` (project ref stored locally, not in repo), then `npm run gen:supabase-types`
- Or env: `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`

**Target output:** `src/lib/supabase/database.types.ts`

**CI:** Script exits with a clear message if credentials are missing — safe to run in CI without secrets.

**Interim types:** `src/lib/hairaudit/tableTypes.ts` (`CaseRow`, `ReportRow`, `UploadRow`, `AuditPhotoRow`, …).

---

## Blockers before applying RLS (Phase 0B draft)

1. Commit or verify baseline CREATE DDL for `cases`, `reports`, `uploads`.
2. Generate and commit Supabase `Database` types from staging.
3. Staging regression checklist (above) green.
4. Remove or disable `upload-panel.tsx` before `uploads` INSERT RLS policy.
5. Confirm `INTERNAL_API_KEY` / `REPORT_RENDER_TOKEN` / `CONTRIBUTION_TOKEN_SECRET` in all envs.
6. Apply draft SQL in staging only; compare `hairaudit_user_can_access_case` with `canAccessCase` app logic.

---

## Recommended Phase 1B

1. **Baseline migration:** `supabase db dump --schema-only` for core trio → new migration `YYYYMMDDHHMMSS_core_tables_baseline.sql` (or documented external baseline).
2. **Commit generated types** from staging after baseline applied.
3. **Optional DB CHECK** on `cases.status` using frozen `CASE_STATUSES` (exclude unknown legacy values after backfill audit).
4. **RLS staging apply:** `cases`/`reports`/`uploads` SELECT policies from draft SQL; `upload_audit_corrections` auditor SELECT.
5. **Community RLS** product decision + edge rate limits.
6. **Replace partial `tableTypes`** with generated row types incrementally (high-traffic routes first).

---

## Phase 1A verification commands

```bash
npm run typecheck
npm run test:security-phase0
npm run test:security-phase0b
npm run test:schema-phase1a
```

`npm run gen:supabase-types` — expected to fail without Supabase CLI link (documents blocker).

---

## Related code map

| Concern | File |
|---------|------|
| Case create insert shape | `src/lib/cases/createCase.ts` |
| Submit / post-submit status logic | `src/lib/patient/caseSubmitStatus.ts` |
| Pipeline status writes | `src/lib/inngest/functions.ts` |
| Auditor review enums | `src/lib/auditor/eligibility.ts` |
| Surgery evidence review statuses | `src/lib/surgeryUpload/evidenceReview.ts` |
| Training case statuses | `src/lib/academy/trainingCaseCorrections/constants.ts` |
| RLS draft | `docs/sql/hairaudit-phase-0b-rls-draft.sql` |
