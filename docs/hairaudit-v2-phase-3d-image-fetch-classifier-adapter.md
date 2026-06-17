# HairAudit V2 — Phase 3D: Image Fetch + Classifier Adapter Scaffold

**Date:** 2026-06-17  
**Scope:** Safe Supabase storage fetch and classifier adapter scaffold for FI image intelligence  
**Prerequisites:** [Phase 3C](./hairaudit-v2-phase-3c-image-intelligence-persistence.md)

---

## Executive Summary

Phase 3D prepares real classification by adding optional image byte fetch from Supabase storage and a provider-switchable classifier adapter. **No real AI providers are called** — default behaviour remains dry-run.

| Deliverable | Status |
|-------------|--------|
| `fiImageIntelligenceImageFetch.ts` — validated storage fetch | ✅ |
| `fiImageClassifierAdapter.ts` — provider scaffold | ✅ |
| Worker fetch + classifier integration | ✅ |
| Extended result contract (fetch + classification metadata) | ✅ |
| Readiness checker Phase 3D warnings | ✅ |
| Phase 3D tests (`test:upload-phase3d`) | ✅ |

---

## Feature Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED` | off | Worker processing (unchanged from 3B) |
| `HAIRAUDIT_FI_IMAGE_FETCH_ENABLED` | off | Download image bytes from Supabase storage |
| `HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER` | `dry_run` | Classifier provider selection |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Required for durable persistence and storage fetch |

### Classifier Providers

| Provider | Phase 3D behaviour |
|----------|-------------------|
| `dry_run` | Default — placeholder result, no AI |
| `manual_stub` | Deterministic category/confidence from canonical + legacy metadata |
| `fi_os` | Readiness checks env; worker fails with "not implemented" |
| `openai` | Readiness checks env; worker fails with "not implemented" |

---

## Image Fetch Module

Module: `src/lib/hairaudit/fiImageIntelligenceImageFetch.ts`

| Function | Purpose |
|----------|---------|
| `isFiImageIntelligenceImageFetchEnabled()` | Reads `HAIRAUDIT_FI_IMAGE_FETCH_ENABLED` |
| `fetchFiImageIntelligenceImage()` | Validates bucket/path, optionally downloads bytes |

**Validation (before download):**

1. Worker must be enabled (fetch never runs standalone).
2. `storage_bucket` must match configured case-files bucket (`uploadStorage` helpers).
3. `storage_path` must belong to `source_case_id` (`gateUploadCaseStoragePath`).

**Post-download checks:**

- Max size: `MAX_IMAGE_UPLOAD_BYTES` (default 50 MB).
- Allowed types: JPEG, PNG, WebP (magic-byte detection).
- Timeout: 30 seconds (configurable in tests).
- Safe error messages — no secrets in failure reasons.

---

## Classifier Adapter

Module: `src/lib/hairaudit/fiImageClassifierAdapter.ts`

| Function | Purpose |
|----------|---------|
| `resolveFiImageClassifierProvider()` | Reads `HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER` |
| `classifyHairAuditImage()` | Returns `FiImageIntelligenceResult` via selected provider |
| `manualStubConfidenceForCategory()` | Deterministic confidence hash (no AI) |

**`manual_stub` behaviour:**

- Resolves category via `resolveCanonicalCategoryForUploadEvent()` (canonical + legacy).
- Sets `classification_status: "classified"`, `model_provider: "manual_stub"`.
- Includes fetch metadata when fetch succeeded.

---

## Extended Result Contract

New fields on `FiImageIntelligenceResult`:

| Field | Type | Notes |
|-------|------|-------|
| `image_fetch_status` | `skipped` \| `ok` \| `failed` | Whether bytes were fetched |
| `image_content_type` | string \| null | Detected MIME when fetch ok |
| `image_size_bytes` | number \| null | Byte length when fetch ok |
| `classification_source` | string | e.g. `dry_run`, `manual_stub` |
| `classification_notes` | string | Human-readable method notes |

Worker outcome status now includes `classified` when `manual_stub` succeeds.

---

## Worker Lifecycle (Phase 3D)

1. Receive job payload (unchanged).
2. Check worker flag — skip if disabled.
3. Validate payload + idempotency + persist `processing` row (unchanged).
4. Validate storage metadata (path-only).
5. **If fetch enabled:** download and validate image bytes; fail job on fetch error.
6. **Classify** may via adapter** (default `dry_run`).
7. Persist `completed` with extended result jsonb.

---

## Readiness Checker

New checks in `scripts/check-hairaudit-event-readiness.mjs`:

- **WARN** if `HAIRAUDIT_FI_IMAGE_FETCH_ENABLED=true` but worker is off.
- Shows active `HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER`.
- **FAIL** if provider is `fi_os`/`openai` but required API key env is missing.
- **PASS** note that real AI classification is still not implemented.

---

## Rollback Plan

```env
HAIRAUDIT_FI_IMAGE_FETCH_ENABLED=false
HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=dry_run
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED=false
```

Effects:

- No storage downloads; path-only validation resumes.
- Dry-run results persisted (when worker on).
- Existing `fi_image_intelligence_processed_jobs` rows unchanged.

---

## What Is Still Not Implemented

| Work | Phase |
|------|-------|
| FI OS / OpenAI real classification | 3E |
| Deletion suppression sync (`upload.deleted`) | 3D+ |
| `audit_photos` dual-write consistency | 3.x |

---

## Verification Commands

```bash
npm run typecheck
npm run test:upload-phase3d
npm run test:upload-phase3c
npm run test:upload-phase3b
npm run check:hairaudit-events
```

---

## Recommended Phase 3E

1. Implement `fi_os` provider behind feature flag with real API integration.
2. Add observability for fetch latency and classification outcomes.
3. Wire `upload.deleted` suppression/tombstone sync.
4. Add integration tests against staging Supabase bucket.
5. Replace dry-run default with opt-in `fi_os` in staging only.

---

## References

| File | Purpose |
|------|---------|
| `src/lib/hairaudit/fiImageIntelligenceImageFetch.ts` | Storage fetch helper |
| `src/lib/hairaudit/fiImageClassifierAdapter.ts` | Classifier provider scaffold |
| `src/lib/hairaudit/fiImageIntelligenceWorker.ts` | Worker lifecycle |
| `src/lib/hairaudit/fiImageIntelligenceResult.ts` | Result contract |
| `tests/uploadPhase3d.test.ts` | Phase 3D test suite |
