# HairAudit V2 — Phase 3F: FI OS Classifier Receiving Endpoint

**Date:** 2026-06-17  
**Scope:** Internal FI OS HTTP endpoint that receives HairAudit image-classification requests  
**Prerequisites:** [Phase 3E](./hairaudit-v2-phase-3e-fi-os-classifier-adapter.md)

---

## Executive Summary

Phase 3F implements the **receiving side** of the HairAudit ↔ FI OS image-classification contract introduced in Phase 3E. HairAudit's `fiOsImageClassifierClient` POSTs to this endpoint when `HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=fi_os`. This endpoint validates inbound requests, optionally runs FI OS classification, and returns a normalized JSON response.

| Deliverable | Status |
|-------------|--------|
| `POST /api/internal/hairaudit/image-classify` | ✅ |
| `hairauditClassifierAuth.ts` — dedicated bearer token auth | ✅ |
| `fiOsHairAuditImageClassifyService.ts` — validation + classification | ✅ |
| `classifyClinicalHairImageFromModelUrl.ts` — real classifier hook (placeholder) | ✅ |
| Phase 3F tests (`test:upload-phase3f`) | ✅ |

**Non-goals (unchanged):** No public access, no UI changes, no HairAudit client changes, no broad schema migrations.

---

## Codebase Findings (Task 1)

Searches performed across the FI OS / HairAudit workspace:

| Search term | Finding |
|-------------|---------|
| `classifyClinicalHairImageFromModelUrl` | Referenced in Phase 3E docs as the future FI OS classifier entry point. **No prior implementation** — added as a Phase 3F hook in `src/lib/hairaudit/classifyClinicalHairImageFromModelUrl.ts` (returns unavailable until wired). |
| Image classification | HairAudit-side: `fiImageClassifierAdapter.ts`, `fiOsImageClassifierClient.ts`, `src/lib/photos/classification.ts` (metadata inference, not ML). |
| Photo protocol | Documented in `docs/hairaudit-ecosystem-convergence-audit.md` as a future FI photo-protocol engine; HairAudit has parallel schemas in `auditPhotoSchemas.ts`, `patientPhotoReadinessPolicy.ts`. |
| `fi_patient_images` | **Not present** in this repository — expected in a dedicated FI OS imaging schema (future). |
| `ImagingOS` | **Not present** as a code module in this repository. |
| Hair image classification | Worker pipeline: `fiImageIntelligenceWorker.ts` → `classifyHairAuditImage()` → `classifyWithFiOsImageClassifier()` (HairAudit caller). |
| `canonical_photo_category` | Defined in `uploadContract.ts`; mapped in `fiOsImageClassifierClient.mapFiCategoryToCanonical()`. |
| `quality_status` / `protocol_status` | Result contract in `fiImageIntelligenceResult.ts`; stub/default `"not_evaluated"` until FI photo-protocol analytics are wired. |

**Conclusion:** The HairAudit **caller** (Phase 3E) is complete. The FI OS **receiver** did not exist; Phase 3F adds it. Real ML / photo-protocol classification remains deferred behind `classifyClinicalHairImageFromModelUrl`.

---

## Endpoint

| Property | Value |
|----------|-------|
| **URL** | `POST /api/internal/hairaudit/image-classify` |
| **Auth** | `Authorization: Bearer <HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN>` |
| **Visibility** | Internal only — not linked from UI or public docs |
| **Module** | `src/app/api/internal/hairaudit/image-classify/route.ts` |

HairAudit staging should set:

```env
FI_OS_IMAGE_CLASSIFIER_URL=https://<fi-os-host>/api/internal/hairaudit/image-classify
FI_OS_IMAGE_CLASSIFIER_TOKEN=<same-value-as-HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN>
```

---

## Environment Variables (FI OS deployment)

| Variable | Required | Purpose |
|----------|----------|---------|
| `HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN` | **yes** | Bearer token shared with HairAudit (`FI_OS_IMAGE_CLASSIFIER_TOKEN`). Min 16 chars. Must **not** equal `SUPABASE_SERVICE_ROLE_KEY`. |
| `HAIRAUDIT_IMAGE_CLASSIFIER_MODE` | no | `stub` enables deterministic stub responses. Omit or any other value = live mode (503 until real classifier wired). |

**Security:** No fallback to `INTERNAL_API_KEY`, `REPORT_RENDER_TOKEN`, or `SUPABASE_SERVICE_ROLE_KEY`.

---

## Staging Setup

### FI OS (receiver)

```env
HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN=<generate-32+-char-random-token>
HAIRAUDIT_IMAGE_CLASSIFIER_MODE=stub
```

### HairAudit (caller — unchanged from Phase 3E)

```env
HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=fi_os
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED=true
FI_OS_IMAGE_CLASSIFIER_URL=https://fi-staging.example.com/api/internal/hairaudit/image-classify
FI_OS_IMAGE_CLASSIFIER_TOKEN=<same-token-as-above>
```

Verify end-to-end:

```bash
npm run typecheck
npm run test:upload-phase3f
npm run test:upload-phase3e
```

---

## Request Contract (HairAudit → FI OS)

```json
{
  "source_system": "hairaudit",
  "idempotency_key": "hairaudit:image-intelligence:{case_id}:{upload_id}:v1",
  "source_case_id": "uuid",
  "source_upload_id": "uuid",
  "canonical_photo_category": "patient_current_front",
  "legacy_upload_type": "patient_photo:front",
  "storage_bucket": "case-files",
  "storage_path": "cases/{case_id}/patient/front/1.jpg",
  "image_content_type": "image/jpeg",
  "image_size_bytes": 1024
}
```

| Field | Required | Validation |
|-------|----------|------------|
| `source_system` | yes | Must be `"hairaudit"` |
| `idempotency_key` | yes | Non-empty string |
| `source_case_id` | yes | UUID |
| `source_upload_id` | yes | UUID |
| `canonical_photo_category` | yes | Non-empty string |
| `legacy_upload_type` | no | Non-empty string when present |
| `storage_bucket` / `storage_path` | no | Both required together when either set |
| `image_content_type` | no | Must be in `SUPPORTED_IMAGE_CONTENT_TYPES` when set |
| `image_size_bytes` | no | Non-negative integer when set |

---

## Response Contract (FI OS → HairAudit)

Success (`200`):

```json
{
  "category": "patient_current_front",
  "canonical_photo_category": "patient_current_front",
  "confidence": 0.62,
  "quality_status": "not_evaluated",
  "protocol_status": "not_evaluated",
  "classifier_version": "fi-os-stub-v1",
  "notes": "Stub classification only"
}
```

HairAudit maps this via `parseFiOsClassifierResponseBody()` in `fiOsImageClassifierClient.ts`.

**Never returned:** signed URLs, storage paths, tokens, or service-role material.

---

## Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `401` | Missing / invalid bearer token | `{ "error": "Unauthorized" }` |
| `400` | Invalid JSON, wrong `source_system`, or payload validation failure | `{ "error": "<message>" }` |
| `503` | Live mode and real classifier unavailable | `{ "error": "Classification provider not ready", "code": "provider_not_ready" }` |
| `405` | Non-POST methods | `{ "error": "Method not allowed" }` |

Generic error messages only — no stack traces or internal paths in responses.

---

## Security Model

1. **Dedicated token** — `HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN` only; no shared internal API key pool.
2. **No service-role fallback** — token validation explicitly rejects reuse of `SUPABASE_SERVICE_ROLE_KEY`.
3. **Timing-safe compare** — bearer token verified with `crypto.timingSafeEqual`.
4. **Token length floor** — minimum 16 characters.
5. **Source system gate** — only `source_system: "hairaudit"` accepted.
6. **Response sanitization** — success payload is a fixed field set with no storage references.
7. **Production stub warning** — logs when `HAIRAUDIT_IMAGE_CLASSIFIER_MODE=stub` in production.

Module: `src/lib/security/hairauditClassifierAuth.ts`

---

## Stub vs Real Classifier Mode

| Mode | Env | Behaviour |
|------|-----|-----------|
| **Stub** | `HAIRAUDIT_IMAGE_CLASSIFIER_MODE=stub` | Returns deterministic stub: category unchanged, confidence 0.5–0.7, `quality_status` / `protocol_status` = `not_evaluated`, `classifier_version` = `fi-os-stub-v1`. |
| **Live** (default) | unset or not `stub` | Calls `classifyClinicalHairImageFromModelUrl()` when `isClinicalHairImageClassifierAvailable()` is true; otherwise **503** `provider_not_ready`. |

Real classifier hook: `src/lib/hairaudit/classifyClinicalHairImageFromModelUrl.ts` — currently returns unavailable (Phase 3F placeholder).

---

## Rollback Plan

1. **HairAudit side:** Set `HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=dry_run` or `manual_stub` — stops outbound FI OS calls immediately.
2. **FI OS side:** Unset `HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN` or remove route deployment — HairAudit receives config/HTTP errors safely (Phase 3E behaviour).
3. **Stub rollback testing:** Re-enable `HAIRAUDIT_IMAGE_CLASSIFIER_MODE=stub` on FI OS for contract verification without ML.
4. **No migration rollback required** — Phase 3F is additive (no schema changes).

---

## Verification

```bash
npm run typecheck
npm run test:upload-phase3f
npm run test:security-phase0
npm run test:security-phase0b
```

---

## Recommended Phase 3G

1. **Wire real classifier** — implement `classifyClinicalHairImageFromModelUrl` against FI ImagingOS / photo-protocol pipeline.
2. **Image byte access** — secure cross-project storage read or signed-URL handoff (never return signed URLs in API response).
3. **Quality / protocol engines** — populate `quality_status` and `protocol_status` from FI analytics.
4. **Observability** — structured logs for latency, classifier version, idempotency key hash (no raw storage paths).
5. **Production readiness check** — extend FI OS deployment checklist for classifier token + mode validation.

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/internal/hairaudit/image-classify/route.ts` | New internal POST endpoint |
| `src/lib/security/hairauditClassifierAuth.ts` | Dedicated bearer auth |
| `src/lib/hairaudit/fiOsHairAuditImageClassifyService.ts` | Request validation + classification orchestration |
| `src/lib/hairaudit/classifyClinicalHairImageFromModelUrl.ts` | Real classifier hook (placeholder) |
| `tests/hairauditImageClassifyEndpoint.test.ts` | Phase 3F test suite |
| `package.json` | `test:upload-phase3f` script |
| `docs/hairaudit-phase-3f-fi-classifier-endpoint.md` | This document |
