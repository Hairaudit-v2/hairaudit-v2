# HairAudit V2 — Phase 2G: Event Sink Adapter & FI Image-Intelligence Bridge

**Date:** 2026-06-17  
**Scope:** Staging-safe HTTP event sink, FI-compatible image-intelligence bridge contract (no AI execution)  
**Prerequisites:** [Phase 2E](./hairaudit-v2-phase-2e-upload-events-manifest-parity.md), [Phase 2F](./hairaudit-v2-phase-2f-upload-deleted-events-readiness.md)  
**Integration reference:** [FUTURE-INTEGRATION-ARCHITECTURE.md](../FUTURE-INTEGRATION-ARCHITECTURE.md)

---

## Executive Summary

Phase 2G adds **integration infrastructure only**: a staging-safe HTTP event sink adapter and a pure FI image-intelligence bridge contract. Upload routes, UI, RLS, and schema are unchanged. No FI OS image classification runs in this phase.

| Deliverable | Status |
|-------------|--------|
| `integrationEventSink.ts` — HTTP sink adapter | ✅ |
| `fiImageIntelligenceBridge.ts` — FI input mapping + enqueue plan | ✅ |
| `getEventSink()` wired to HTTP adapter when configured | ✅ |
| Readiness checker Phase 2G checks | ✅ |
| Phase 2G tests (`test:upload-phase2g`) | ✅ |

---

## Feature Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `HAIRAUDIT_UPLOAD_EVENTS_ENABLED` | off | Upload dispatcher forwards lifecycle events to `emitHairAuditEvent` |
| `INTEGRATION_EVENTS_ENABLED` | off | Generic integration sink delivery switch |
| `HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED` | off | Future FI bridge enqueue switch (returns plan/boolean only in 2G) |
| `HAIRAUDIT_UPLOAD_EVENTS_DEBUG` | off | Safe debug logging when `NODE_ENV !== production` |

Optional sink configuration:

| Variable | Purpose |
|----------|---------|
| `INTEGRATION_EVENTS_SINK_URL` | HTTPS webhook/queue ingress URL (required when delivery enabled) |
| `INTEGRATION_EVENTS_HEADERS` | JSON object of request headers, e.g. `{"Authorization":"Bearer …"}` |
| `INTEGRATION_EVENTS_TIMEOUT_MS` | HTTP timeout (1500–3000 ms, default 2000) |

**Upload event HTTP delivery requires both** `HAIRAUDIT_UPLOAD_EVENTS_ENABLED=true` **and** `INTEGRATION_EVENTS_ENABLED=true` (upload gate at dispatcher; sink gate at `emitHairAuditEvent`).

---

## Event Sink Behaviour

Module: `src/lib/hairaudit/integrationEventSink.ts`

### Default: no-op

When flags are off or sink URL is missing/invalid, `deliverIntegrationEvent` and `getEventSink()` remain no-ops. Upload and delete routes are never blocked.

### When enabled

1. `uploadEventDispatcher` builds and flattens the upload event (Phase 2E/2F).
2. `emitHairAuditEvent` checks `INTEGRATION_EVENTS_ENABLED`.
3. `getEventSink()` returns `HttpIntegrationEventSink` when config validates.
4. Sink POSTs JSON: `{ event_name, payload }` to `INTEGRATION_EVENTS_SINK_URL`.
5. Timeout enforced (default 2000 ms).
6. Safe summary logged only — no signed URLs, tokens, or secrets in logs.

### Config rejection (never throws to routes)

| Condition | Result |
|-----------|--------|
| `INTEGRATION_EVENTS_SINK_URL` missing when delivery enabled | Skip delivery, log skip reason |
| `SUPABASE_SERVICE_ROLE_KEY` reused in URL/headers | Skip delivery (readiness FAIL) |
| Non-HTTPS URL in production | Skip delivery (readiness FAIL) |
| Invalid `INTEGRATION_EVENTS_HEADERS` JSON | Skip delivery (readiness FAIL) |
| HTTP timeout or non-2xx response | Log summary, swallow error |

---

## Staging Setup

### 1. Verify locally (no outbound calls)

```bash
npm run test:upload-phase2g
npm run test:upload-phase2e
npm run test:upload-phase2f
npm run check:hairaudit-events
```

Expect PASS with all delivery flags off.

### 2. Enable staging HTTP forwarding

```env
HAIRAUDIT_UPLOAD_EVENTS_ENABLED=true
INTEGRATION_EVENTS_ENABLED=true
INTEGRATION_EVENTS_SINK_URL=https://your-staging-sink.example/events
INTEGRATION_EVENTS_HEADERS={"Authorization":"Bearer your-staging-token"}
```

Re-run readiness before deploy:

```bash
npm run check:hairaudit-events
```

### 3. FI bridge contract (no execution)

```env
# Optional — enables should_enqueue_image_intelligence=true in bridge evaluation only
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED=true
```

Readiness will **WARN** that AI/queue execution is not implemented.

---

## FI Image-Intelligence Bridge Contract

Module: `src/lib/hairaudit/fiImageIntelligenceBridge.ts`

Pure mapping from `HairAuditUploadEvent` → `FiImageIntelligenceInput`:

| Field | Source |
|-------|--------|
| `source_system` | `"hairaudit"` |
| `source_event_name` | `hairaudit.upload.created` / `.deleted` |
| `source_case_id` | `case_id` |
| `source_upload_id` | `upload_id` |
| `actor_type` | upload event |
| `upload_surface` | upload event |
| `storage_bucket` | upload event |
| `storage_path` | upload event |
| `canonical_photo_category` | upload event |
| `legacy_upload_type` | upload event |
| `metadata_version` | upload event |
| `occurred_at` | upload event |
| `deleted_at` | deletion events only |

### Enqueue rules (`evaluateFiImageIntelligenceEnqueue`)

| Event / surface | `should_enqueue_image_intelligence` |
|-----------------|-------------------------------------|
| `upload.created` + `forensic_audit` / `surgery_evidence` | `true` only when `HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED=true` |
| `upload.deleted` | always `false` (suppression/tombstone prep later) |
| `training`, `community`, `bulk_admin`, `doctor_portal` | always `false` with explicit reason |
| Unknown surface | `false` with reason |

**No network call. No queue write. No AI execution in Phase 2G.**

---

## What Is Still Not Implemented

| Work | Phase |
|------|-------|
| FI OS image classification execution | 3A+ |
| Queue persistence / Inngest job for FI bridge | 3A+ |
| Deletion suppression sync to FI | 3A+ |
| `audit_photos` dual-write consistency | 2G / 3A |
| Manifest generation from event stream | 3.x |
| Storage path alignment / backfill (2D) | 2G / 3A |
| RLS on `uploads` | After path inventory frozen |

---

## Rollback Plan

Disable flags immediately (no code deploy required):

```env
HAIRAUDIT_UPLOAD_EVENTS_ENABLED=false
INTEGRATION_EVENTS_ENABLED=false
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED=false
```

Upload/delete routes continue unchanged; sink returns to no-op.

---

## Verification Commands

```bash
npm run typecheck
npm run test:upload-phase2g
npm run test:upload-phase2e
npm run test:upload-phase2f
npm run check:hairaudit-events
npm run test:upload-auth
npm run test:security-phase0
npm run test:security-phase0b
```

---

## References

| File | Purpose |
|------|---------|
| `src/lib/hairaudit/integrationEventSink.ts` | HTTP sink adapter |
| `src/lib/hairaudit/fiImageIntelligenceBridge.ts` | FI bridge contract |
| `src/lib/integrations/sink.ts` | Sink factory (`getEventSink`) |
| `src/lib/integrations/emit.ts` | `emitHairAuditEvent` |
| `src/lib/hairaudit/uploadEventDispatcher.ts` | Upload lifecycle dispatch |
| `scripts/check-hairaudit-event-readiness.mjs` | Staging readiness |
| `tests/uploadPhase2g.test.ts` | Phase 2G test suite |
