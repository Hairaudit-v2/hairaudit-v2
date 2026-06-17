# HairAudit V2 — Phase 3C: FI Image-Intelligence Persistence

**Date:** 2026-06-17  
**Scope:** Persist worker jobs and dry-run results to `fi_image_intelligence_processed_jobs`  
**Prerequisites:** [Phase 3B](./hairaudit-v2-phase-3b-fi-image-intelligence-worker-scaffold.md)  
**Integration reference:** [FUTURE-INTEGRATION-ARCHITECTURE.md](../FUTURE-INTEGRATION-ARCHITECTURE.md)

---

## Executive Summary

Phase 3C adds durable idempotency and dry-run result persistence for the FI image-intelligence worker introduced in Phase 3B. The worker still does not fetch image bytes or call AI providers.

| Deliverable | Status |
|-------------|--------|
| `fi_image_intelligence_processed_jobs` migration | ✅ |
| `fiImageIntelligencePersistence.ts` — DB + memory adapter | ✅ |
| Worker persistence integration | ✅ |
| Phase 3C tests (`test:upload-phase3c`) | ✅ |
| Readiness checker persistence warnings | ✅ |

---

## Database Table

**Migration:** `supabase/migrations/20260617120000_fi_image_intelligence_processed_jobs.sql`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `idempotency_key` | text UNIQUE NOT NULL | `hairaudit:image-intelligence:{case_id}:{upload_id}:v1` |
| `case_id` | uuid NOT NULL | Denormalized for queries |
| `upload_id` | uuid NOT NULL | Denormalized for queries |
| `event_name` | text NOT NULL | e.g. `hairaudit.upload.created` |
| `source_system` | text | Default `hairaudit` |
| `status` | text NOT NULL | `processing`, `completed`, `failed` |
| `result` | jsonb | Full `FiImageIntelligenceResult` on success |
| `error_message` | text | Validation failure reason |
| `processed_at` | timestamptz | Completion/failure time |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()` |

**Indexes:** `case_id`, `upload_id`, `status`

**RLS:** Enabled with `service_role` policy only — background worker writes via `SUPABASE_SERVICE_ROLE_KEY`. No patient/public access.

---

## Persistence Module

Module: `src/lib/hairaudit/fiImageIntelligencePersistence.ts`

| Function | Purpose |
|----------|---------|
| `findProcessedJobByIdempotencyKey()` | Lookup existing job row |
| `markJobProcessing()` | `INSERT` processing row; conflict → existing row |
| `markJobCompleted()` | Update row with dry-run/classification `result` |
| `markJobFailed()` | Update row with `error_message` |
| `createMemoryFiImageIntelligencePersistence()` | In-memory fallback for tests / DB unavailable |
| `createSupabaseFiImageIntelligencePersistence()` | Service-role Supabase adapter |
| `resolveFiImageIntelligencePersistence()` | Supabase when configured, else memory |

---

## Worker Lifecycle (Phase 3C)

1. Receive job payload from Inngest (unchanged from Phase 3B).
2. Check worker flag — skip if disabled.
3. Validate payload shape and idempotency key.
4. **Check DB idempotency** — skip if row exists.
5. **Insert `processing` row** — skip on conflict (concurrent duplicate).
6. Run payload safety + storage metadata validation (path-only, no byte fetch).
7. On validation failure: **persist `failed`** with `error_message`.
8. On success: build dry-run result, **persist `completed`** with `result` jsonb.
9. Return worker outcome — never throws upload-blocking errors.

When `SUPABASE_SERVICE_ROLE_KEY` is unset, the worker falls back to in-memory persistence (non-durable across process restarts).

---

## Feature Flags

Unchanged from Phase 3B:

| Flag | Purpose |
|------|---------|
| `HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED` | Enables worker processing |
| `HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED` | Phase 3A enqueue |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for durable DB persistence |

---

## Rollback Plan

```env
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED=false
```

Effects:

- Handler returns `skipped`; no new rows written.
- Existing `fi_image_intelligence_processed_jobs` rows remain (additive table).
- No AI execution, no storage fetches, no upload path changes.

---

## What Is Still Not Implemented

| Work | Phase |
|------|-------|
| FI OS image classification (OpenAI/Claude/Gemini) | 3D |
| Image byte fetch from Supabase storage | 3D |
| Deletion suppression sync (`upload.deleted`) | 3D+ |
| `audit_photos` dual-write consistency | 3.x |

---

## Verification Commands

```bash
npm run typecheck
npm run test:upload-phase3c
npm run test:upload-phase3b
npm run test:upload-phase3a
npm run check:hairaudit-events
```

---

## Recommended Phase 3D

1. Fetch image bytes from `storage_bucket`/`storage_path` with existing bucket helpers.
2. Integrate FI OS classification module (single provider behind feature flag).
3. Replace dry-run `result` with real `classified` status and model metadata.
4. Wire `upload.deleted` suppression/tombstone sync.
5. Extend readiness checker for AI provider env vars.
6. Add observability dashboards for `fi_image_intelligence_processed_jobs` status counts.

---

## References

| File | Purpose |
|------|---------|
| `src/lib/hairaudit/fiImageIntelligencePersistence.ts` | Persistence adapter |
| `src/lib/hairaudit/fiImageIntelligenceWorker.ts` | Worker lifecycle |
| `src/lib/hairaudit/fiImageIntelligenceResult.ts` | Result contract |
| `supabase/migrations/20260617120000_fi_image_intelligence_processed_jobs.sql` | Schema |
| `tests/uploadPhase3c.test.ts` | Phase 3C test suite |
