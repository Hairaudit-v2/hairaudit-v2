# HairAudit V2 — Phase 2E: Upload Events & Evidence Manifest Parity

**Date:** 2026-06-17  
**Scope:** Internal upload event contract, no-op dispatcher, route hooks, manifest parity helpers  
**Prerequisites:** [Phase 2A](./hairaudit-v2-phase-2a-upload-architecture-map.md), [Phase 2D](./hairaudit-v2-phase-2d-storage-path-alignment-plan.md)  
**Integration reference:** [FUTURE-INTEGRATION-ARCHITECTURE.md](../FUTURE-INTEGRATION-ARCHITECTURE.md)

---

## Executive Summary

Phase 2E adds a **pure, testable upload event layer** and **manifest parity helpers** without changing user-visible upload behaviour. No FI OS network calls, no RLS, no storage backfill, no frontend consolidation.

| Deliverable | Status |
|-------------|--------|
| `uploadEvents.ts` — event contract + builder | ✅ |
| `uploadEventDispatcher.ts` — non-blocking dispatcher | ✅ |
| Route hooks after confirmed DB insert | ✅ |
| `evidenceManifestParity.ts` — legacy vs contract comparison | ✅ |
| Phase 2E tests (`test:upload-phase2e`) | ✅ |

---

## Event Contract

### Event names

| Name | Phase 2E status | When |
|------|-----------------|------|
| `hairaudit.upload.created` | **Emitted** | After successful upload row / training upload row insert |
| `hairaudit.upload.deleted` | **Emitted** | After confirmed storage remove + `uploads` row delete |

### Payload (`hairaudit.upload.created`)

| Field | Type | Notes |
|-------|------|-------|
| `event_name` | `"hairaudit.upload.created"` | Fixed |
| `event_version` | `"1.0"` | Event schema version |
| `case_id` | UUID string | Owning case / training case |
| `upload_id` | UUID string | `uploads.id` or `training_case_uploads.id` |
| `actor_type` | `UploadActorType` | From `uploadContract` |
| `upload_surface` | `UploadSurface` | forensic_audit, surgery_evidence, training, bulk_admin, … |
| `source_case_table` | `SourceCaseTable` | cases, training_cases, … |
| `storage_bucket` | string | Resolved bucket name (e.g. `case-files`) |
| `storage_path` | string | Confirmed storage path after path gate |
| `canonical_photo_category` | string | Canonical category or `"other"` for surgery slots |
| `legacy_upload_type` | string? | e.g. `patient_photo:front`, `surgery_photo:preop_donor` |
| `metadata_version` | `"2.0"` | Upload metadata contract version |
| `occurred_at` | ISO 8601 | From DB `created_at` when available |

**Excluded by design:** signed URLs, public URLs, tokens, API secrets.

### Builder

```typescript
import { buildHairAuditUploadCreatedEvent } from "@/lib/hairaudit/uploadEvents";

const event = buildHairAuditUploadCreatedEvent({
  upload_id, case_id, actor_type, upload_surface, source_case_table,
  storage_bucket, storage_path, legacy_upload_type, canonical_photo_category,
  occurred_at,
});
```

Legacy type → canonical category mapping uses `parseLegacyUploadType` and metadata `category`, falling back to `"other"` for surgery slots and extended keys.

---

## Dispatcher Behaviour

Module: `src/lib/hairaudit/uploadEventDispatcher.ts`

| Flag | Default | Behaviour |
|------|---------|-----------|
| `HAIRAUDIT_UPLOAD_EVENTS_ENABLED` | off | When `true`, forwards flattened payload to `emitHairAuditEvent` (integration bridge) |
| `HAIRAUDIT_UPLOAD_EVENTS_DEBUG` | off | When `true` **and** `NODE_ENV !== production`, logs payload to `console.debug` |
| `INTEGRATION_EVENTS_ENABLED` | off | Required for integration sink delivery (unchanged from Phase 0 integration prep) |

Rules:

- **Never throws** — upload routes call `notifyHairAuditUploadCreated()` in try/catch-safe wrapper
- **Never blocks** — fire-and-forget `void dispatch…`
- **No direct FI OS HTTP** — uses existing no-op integration sink until Phase 2F+
- **Payload safety check** — skips dispatch if signed URL / token patterns detected

---

## Routes Emitting `hairaudit.upload.created`

| Route | Surface | Actor | Source table | Emit trigger |
|-------|---------|-------|--------------|--------------|
| `POST /api/uploads/patient-photos` | forensic_audit | patient | cases | After `uploads` insert |
| `POST /api/uploads/audit-photos` | forensic_audit | submitterType | cases | After `uploads` insert (+ best-effort `audit_photos`) |
| `POST /api/uploads/clinic-photos` | forensic_audit | clinic | cases | After `uploads` insert |
| `POST /api/surgery-upload/photos` | surgery_evidence | patient/doctor/clinic | cases | After `uploads` insert |
| `POST /api/academy/uploads` | training | doctor | training_cases | After `training_case_uploads` insert |
| `POST /api/admin/hair-audit/bulk-upload/images` | bulk_admin | system | cases | After `syncSingleBulkImageToUploads` creates/updates `uploads` row |

**Not in scope (Phase 2E):** community cases, doctor portal v2, staging-only bulk rows without case assignment. Delete events added in [Phase 2F](./hairaudit-v2-phase-2f-upload-deleted-events-readiness.md).

---

## Evidence Manifest Parity

### Existing manifest pipeline

| Component | Role |
|-----------|------|
| `prepareCaseEvidence.ts` | Writes `case_evidence_manifests`, prepared derivatives |
| `buildEvidenceManifestFromLegacy.ts` | AuditOS read model from legacy manifest + `uploads` |
| `case_evidence_manifests` | Prepared images, missing categories, quality score |

### Phase 2E helpers (`evidenceManifestParity.ts`)

| Helper | Purpose |
|--------|---------|
| `normalizeLegacyUploadForManifest()` | Map `uploads` row → comparable shape (category, actor, path) |
| `normalizeAuditPhotoForManifest()` | Map `audit_photos` row → comparable shape |
| `compareUploadContractToManifestInput()` | Field-level diff: event vs normalized legacy row |
| `identifyManifestCoverageGaps()` | Detect dual-write gaps, path orphans, event/legacy mismatches |

### Findings (informational)

1. **Dual-write gap:** `patient-photos` and `clinic-photos` write `uploads` only; `audit-photos` dual-writes `audit_photos`. Manifest builder infers role from `uploads.type` prefix — parity helper flags missing `audit_photos` for forensic paths that expect canonical evidence.
2. **Category mapping:** Surgery slots (`preop_donor`, etc.) are not canonical `CanonicalPhotoCategory` values; events use `"other"` with `legacy_upload_type` preserving the slot.
3. **Bulk staging:** Events emit only after sync to `uploads`; `hair_audit_case_images` alone does not emit.
4. **Academy isolation:** Events use `training` surface and `training_cases` table — not included in forensic `case_evidence_manifests` pipeline.
5. **AuditOS shadow:** `buildEvidenceManifestFromLegacy` remains authoritative for read model; parity helpers are comparison-only until Phase 2F wiring.

---

## What Remains Before FI OS Event Wiring

| Work | Phase |
|------|-------|
| Enable `HAIRAUDIT_UPLOAD_EVENTS_ENABLED` + real integration sink in staging | 2F ✅ readiness checker |
| Add `hairaudit.upload.deleted` on delete route after DB confirm | 2F ✅ |
| Bridge upload events to FI image intelligence schema | 2F+ |
| Reconcile `audit_photos` dual-write across all forensic routes | 2F |
| Manifest generation consuming event stream (vs polling `uploads`) | 3.x |
| Storage path alignment / backfill (see 2D plan) | 2F |
| RLS on `uploads` | After path inventory frozen |

---

## Recommended Phase 2F

See [Phase 2F doc](./hairaudit-v2-phase-2f-upload-deleted-events-readiness.md) for deleted events and staging readiness.

1. **Delete events** — `hairaudit.upload.deleted` from `/api/uploads/delete` after confirmed row removal. ✅
2. **Staging readiness** — `npm run check:hairaudit-events` for flag/secret validation. ✅
3. **FI event bridge** — HTTP/queue sink when both upload + integration flags enabled in staging.
4. **Dual-write consistency** — optional `audit_photos` insert from patient/clinic routes or document intentional single-write.
5. **Surgery path alignment** — execute Option A/C from [2D path plan](./hairaudit-v2-phase-2d-storage-path-alignment-plan.md).
6. **Parity CI check** — optional job comparing event payloads vs `buildEvidenceManifestFromLegacy` for sample cases.

---

## References

| File | Purpose |
|------|---------|
| `src/lib/hairaudit/uploadEvents.ts` | Event types + builder |
| `src/lib/hairaudit/uploadEventDispatcher.ts` | Non-blocking dispatch |
| `src/lib/hairaudit/evidenceManifestParity.ts` | Manifest comparison |
| `src/lib/hairaudit/uploadContract.ts` | Actor/surface/category constants |
| `src/lib/integrations/emit.ts` | Integration bridge (no-op default) |
| `tests/uploadPhase2e.test.ts` | Phase 2E test suite |
