# HairAudit V2 — Phase 3B: FI Image-Intelligence Worker Scaffold

**Date:** 2026-06-17  
**Scope:** Inngest worker lifecycle for FI image-intelligence jobs (no AI execution)  
**Prerequisites:** [Phase 3A](./hairaudit-v2-phase-3a-fi-image-intelligence-enqueue.md)  
**Integration reference:** [FUTURE-INTEGRATION-ARCHITECTURE.md](../FUTURE-INTEGRATION-ARCHITECTURE.md)

---

## Executive Summary

Phase 3B registers an Inngest worker that consumes jobs enqueued in Phase 3A. The worker validates payloads, checks idempotency, validates storage metadata (path-only), and returns dry-run classification placeholders. No image bytes are fetched, no AI providers are called, and no result persistence table exists yet.

| Deliverable | Status |
|-------------|--------|
| `fiImageIntelligenceWorker.ts` — lifecycle + dry-run | ✅ |
| `fiImageIntelligenceResult.ts` — result contract | ✅ |
| `fiImageIntelligenceIdempotency.ts` — processed-key scaffold | ✅ |
| Inngest function `fi-image-intelligence-v1` | ✅ |
| Phase 3B tests (`test:upload-phase3b`) | ✅ |
| Readiness checker Phase 3B updates | ✅ |

---

## Feature Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED` | off | Enables worker dry-run processing |
| `HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED` | off | Phase 3A enqueue (independent) |
| `INNGEST_EVENT_KEY` | unset | Required for durable enqueue (Phase 3A) |

**Worker and enqueue flags are independent.** Enabling enqueue without the worker flag leaves jobs in Inngest until the worker is enabled; with the worker flag off, the registered handler returns `skipped`.

---

## Worker Registration

| Item | Value |
|------|-------|
| Inngest function id | `fi-image-intelligence-v1` |
| Trigger event | `hairaudit/fi.image-intelligence.enqueue` |
| Module | `src/lib/inngest/functions/fiImageIntelligenceWorker.ts` |
| Route registration | `src/app/api/inngest/route.ts` |

---

## Worker Lifecycle

1. Receive `FiImageIntelligenceJobPayload` from Inngest event data.
2. Check `HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED` — if off, return `skipped`.
3. Validate payload shape and idempotency key (`buildFiImageIntelligenceIdempotencyKey`).
4. Check processed-key decision (`decideFiImageIntelligenceProcessedKey`) — skip duplicates.
5. Run payload safety check (`uploadEventPayloadIsSafe`).
6. Validate storage metadata only (`gateUploadCaseStoragePath`) — no Supabase object fetch.
7. Return dry-run placeholder via `buildDryRunFiImageIntelligenceResult`.

### Outcome statuses

| Status | Meaning |
|--------|---------|
| `skipped` | Worker disabled or duplicate idempotency key |
| `dry_run` | Valid job — placeholder result returned |
| `failed` | Invalid payload or storage metadata |

---

## Result Contract

Module: `src/lib/hairaudit/fiImageIntelligenceResult.ts`

| Field | Phase 3B value |
|-------|----------------|
| `classification_status` | `"dry_run"` |
| `canonical_photo_category` | From job input |
| `confidence` | `null` |
| `quality_status` | `"not_evaluated"` |
| `protocol_status` | `"not_evaluated"` |
| `model_provider` | `null` |
| `model_version` | `null` |
| `processed_at` | ISO timestamp |
| `dry_run` | `true` |

---

## Idempotency Scaffold

Module: `src/lib/hairaudit/fiImageIntelligenceIdempotency.ts`

Phase 3B uses an in-memory `Set<string>` (injectable in tests). No database table exists yet.

### Future persistence table (Phase 3C+)

Proposed: `fi_image_intelligence_processed_jobs`

| Column | Type | Notes |
|--------|------|-------|
| `idempotency_key` | text PK | `hairaudit:image-intelligence:{case_id}:{upload_id}:v1` |
| `source_case_id` | uuid | Denormalized for queries |
| `source_upload_id` | uuid | Denormalized for queries |
| `classification_status` | text | From result contract |
| `processed_at` | timestamptz | Worker completion time |
| `result_json` | jsonb | Full `FiImageIntelligenceResult` |

Worker should `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING` before processing.

---

## Rollback Plan

Disable worker immediately (no code deploy required):

```env
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED=false
```

Effects:

- Registered Inngest handler returns `skipped` for all jobs.
- Phase 3A enqueue continues if its flag is on (jobs accumulate harmlessly).
- No AI execution, no storage fetches, no DB writes.

To stop new jobs entirely, also set `HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED=false`.

---

## What Is Still Not Implemented

| Work | Phase |
|------|-------|
| FI OS image classification (OpenAI/Claude/Gemini) | 3C |
| Result persistence to DB | 3C |
| Image byte fetch from Supabase storage | 3C |
| Deletion suppression sync (`upload.deleted`) | 3C+ |
| `audit_photos` dual-write consistency | 3.x |

---

## Verification Commands

```bash
npm run typecheck
npm run test:upload-phase3b
npm run test:upload-phase3a
npm run check:hairaudit-events
```

---

## Recommended Phase 3C

1. Add `fi_image_intelligence_processed_jobs` migration with RLS deferred per path inventory.
2. Persist dry-run/real results after successful classification.
3. Fetch image bytes from `storage_bucket`/`storage_path` with existing bucket helpers.
4. Integrate FI OS classification module (single provider behind feature flag).
5. Wire `upload.deleted` suppression/tombstone sync.
6. Extend readiness checker for worker + AI provider env vars.

---

## References

| File | Purpose |
|------|---------|
| `src/lib/hairaudit/fiImageIntelligenceWorker.ts` | Worker lifecycle |
| `src/lib/hairaudit/fiImageIntelligenceResult.ts` | Result contract |
| `src/lib/hairaudit/fiImageIntelligenceIdempotency.ts` | Processed-key scaffold |
| `src/lib/inngest/functions/fiImageIntelligenceWorker.ts` | Inngest registration |
| `src/lib/hairaudit/fiImageIntelligenceQueue.ts` | Enqueue adapter (Phase 3A) |
| `tests/uploadPhase3b.test.ts` | Phase 3B test suite |
