# HairAudit V2 — Phase 3E: FI OS Classifier Adapter

**Date:** 2026-06-17  
**Scope:** Contract-only `fi_os` classifier provider for FI image intelligence worker  
**Prerequisites:** [Phase 3D](./hairaudit-v2-phase-3d-image-fetch-classifier-adapter.md)

---

## Executive Summary

Phase 3E wires `HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=fi_os` to a safe internal HTTP adapter. HairAudit **does not** call OpenAI, Claude, or Gemini directly. When the FI endpoint is not configured, classification fails safely with a clear **provider not configured** result.

| Deliverable | Status |
|-------------|--------|
| `fiOsImageClassifierClient.ts` — config validation + HTTP adapter | ✅ |
| `fiImageClassifierAdapter.ts` — `fi_os` provider wiring | ✅ |
| Readiness checker Phase 3E env checks | ✅ |
| Phase 3E tests (`test:upload-phase3e`) | ✅ |

---

## Feature Flags & Env Vars

| Variable | Required when `provider=fi_os` | Purpose |
|----------|-------------------------------|---------|
| `HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER` | — | Set to `fi_os` to enable adapter |
| `FI_OS_IMAGE_CLASSIFIER_URL` | yes | Internal FI classification endpoint (HTTPS in production) |
| `FI_OS_IMAGE_CLASSIFIER_TOKEN` | yes | Bearer token for FI endpoint (must not reuse service role key) |
| `FI_OS_IMAGE_CLASSIFIER_TIMEOUT_MS` | no | Request timeout (default 5000ms; clamped 3000–8000ms) |

Unchanged from Phase 3D:

| Variable | Default | Purpose |
|----------|---------|---------|
| `HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED` | off | Worker processing |
| `HAIRAUDIT_FI_IMAGE_FETCH_ENABLED` | off | Optional Supabase byte fetch before classify |

---

## FI OS Client Module

Module: `src/lib/hairaudit/fiOsImageClassifierClient.ts`

| Function | Purpose |
|----------|---------|
| `validateFiOsClassifierConfig()` | Validates URL, token, HTTPS (prod), no service-role reuse |
| `classifyWithFiOsImageClassifier()` | POST to FI endpoint; safe response validation |
| `parseFiOsClassifierResponseBody()` | Maps FI JSON into HairAudit result fields |
| `mapFiCategoryToCanonical()` | Maps FI HLI categories to HairAudit canonical categories |

**Request body (HairAudit → FI):**

- `source_system: "hairaudit"`
- `idempotency_key`, `source_case_id`, `source_upload_id`
- `canonical_photo_category`, optional `legacy_upload_type`
- Optional storage/image metadata when fetch succeeded (internal refs only)

**Response mapping (FI → HairAudit):**

| HairAudit field | FI response sources |
|-----------------|---------------------|
| `classification_status` | `"classified"` on success |
| `canonical_photo_category` | `category` / `canonical_photo_category` (mapped) |
| `confidence` | `confidence` / `category_confidence` / `categoryConfidence` |
| `quality_status` | `quality_status` (default `not_evaluated`) |
| `protocol_status` | `protocol_status` (default `not_evaluated`) |
| `model_provider` | `"fi_os"` |
| `model_version` | `classifier_version` / `model_version` |
| `classification_notes` | `notes` / `classification_notes` |

**Failure modes (safe, no throw):**

- Missing URL/token → `provider not configured`
- Invalid URL / non-HTTPS in production / service-role token reuse → config error reason
- Timeout / non-2xx / invalid JSON / invalid payload → descriptive `ok: false` reason

---

## Classifier Adapter Changes

Module: `src/lib/hairaudit/fiImageClassifierAdapter.ts`

| Provider | Phase 3E behaviour |
|----------|-------------------|
| `dry_run` | Unchanged — default placeholder |
| `manual_stub` | Unchanged — metadata-only inference |
| `fi_os` | Calls `classifyWithFiOsImageClassifier()` when configured |
| `openai` | Still not implemented (Phase 3F+) |

---

## Readiness Checker

`npm run check:hairaudit-events` now validates:

- `FI_OS_IMAGE_CLASSIFIER_URL` + `FI_OS_IMAGE_CLASSIFIER_TOKEN` when `provider=fi_os`
- HTTPS URL in production
- No `SUPABASE_SERVICE_ROLE_KEY` reuse in FI classifier token or URL
- Phase 3E note: fi_os uses internal FI HTTP adapter only

---

## Safe Staging Defaults

```env
HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=dry_run
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED=false
HAIRAUDIT_FI_IMAGE_FETCH_ENABLED=false
# FI_OS_IMAGE_CLASSIFIER_URL=
# FI_OS_IMAGE_CLASSIFIER_TOKEN=
```

To exercise the adapter in staging:

```env
HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=fi_os
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED=true
FI_OS_IMAGE_CLASSIFIER_URL=https://fi-staging.example.com/api/hli/classify-image
FI_OS_IMAGE_CLASSIFIER_TOKEN=<dedicated-classifier-token>
```

---

## Verification

```bash
npm run typecheck
npm run test:upload-phase3e
npm run test:upload-phase3d
npm run check:hairaudit-events
```

---

## Recommended Phase 3F

1. **FI OS endpoint** — implement the receiving route in Follicle Intelligence (`classifyClinicalHairImageFromModelUrl` + signed image URL contract).
2. **OpenAI provider** — optional direct provider behind the same adapter interface (still no patient UI).
3. **Quality / protocol engines** — populate `quality_status` and `protocol_status` from FI photo-protocol analytics when available.
4. **Observability** — structured worker logs for fi_os latency, status codes, and classifier version (no storage paths or tokens in logs).

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/hairaudit/fiOsImageClassifierClient.ts` | New FI OS HTTP adapter |
| `src/lib/hairaudit/fiImageClassifierAdapter.ts` | Wire `fi_os` provider |
| `src/lib/hairaudit/fiImageIntelligenceWorker.ts` | Injectable `fiOsFetchImpl` for tests |
| `scripts/check-hairaudit-event-readiness.mjs` | Phase 3E env checks |
| `tests/uploadPhase3e.test.ts` | Phase 3E test suite |
| `tests/uploadPhase3d.test.ts` | Updated fi_os / readiness expectations |
| `tests/uploadPhase3c.test.ts` | Updated readiness expectations |
| `package.json` | `test:upload-phase3e` script |
| `docs/hairaudit-v2-phase-3e-fi-os-classifier-adapter.md` | This document |
