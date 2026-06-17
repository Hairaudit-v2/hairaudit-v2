# HairAudit V2 — Phase 2F: Upload Deleted Events & Staging Readiness

**Date:** 2026-06-17  
**Scope:** `hairaudit.upload.deleted` event contract, delete-route hook, staging readiness checker  
**Prerequisites:** [Phase 2E](./hairaudit-v2-phase-2e-upload-events-manifest-parity.md)  
**Integration reference:** [FUTURE-INTEGRATION-ARCHITECTURE.md](../FUTURE-INTEGRATION-ARCHITECTURE.md)

---

## Executive Summary

Phase 2F completes the upload lifecycle event pair (`created` / `deleted`) and adds a **local-only readiness checker** for FI-compatible event forwarding. External delivery remains **disabled by default**. FI OS intelligence migration is **not** in scope.

| Deliverable | Status |
|-------------|--------|
| `buildHairAuditUploadDeletedEvent()` | ✅ |
| `notifyHairAuditUploadDeleted()` dispatcher | ✅ |
| Delete route hook after confirmed removal | ✅ |
| `scripts/check-hairaudit-event-readiness.mjs` | ✅ |
| Phase 2F tests (`test:upload-phase2f`) | ✅ |

---

## Upload Event Lifecycle

```
Upload insert succeeds
  └─► hairaudit.upload.created  (Phase 2E)

Storage remove + uploads row delete succeed
  └─► hairaudit.upload.deleted  (Phase 2F)
```

Both events share the upload contract fields (case, upload id, storage location, category mapping) and flow through the same non-blocking dispatcher.

### `hairaudit.upload.deleted` payload (v1.0)

| Field | Type | Notes |
|-------|------|-------|
| `event_name` | `"hairaudit.upload.deleted"` | Fixed |
| `event_version` | `"1.0"` | Event schema version |
| `case_id` | UUID string | Owning case |
| `upload_id` | UUID string | Removed `uploads.id` |
| `actor_type` | `UploadActorType`? | Inferred from `uploads.type` when known |
| `upload_surface` | `UploadSurface`? | Inferred from legacy type when known |
| `source_case_table` | `SourceCaseTable` | Default `cases` for delete route |
| `storage_bucket` | string | Resolved bucket (e.g. `case-files`) |
| `storage_path` | string | Normalized path after path gate |
| `canonical_photo_category` | string | From legacy type / metadata |
| `legacy_upload_type` | string? | e.g. `patient_photo:front` |
| `metadata_version` | `"2.0"` | Upload metadata contract version |
| `deleted_at` | ISO 8601 | Deletion timestamp |
| `occurred_at` | ISO 8601 | Original upload `created_at` when available |

**Excluded by design:** signed URLs, public URLs, tokens, API secrets, raw user PII beyond the non-sensitive contract.

---

## Dispatcher Behaviour

Same rules as Phase 2E (`uploadEventDispatcher.ts`):

| Flag | Default | Behaviour |
|------|---------|-----------|
| `HAIRAUDIT_UPLOAD_EVENTS_ENABLED` | off | When `true`, forwards to `emitHairAuditEvent` |
| `HAIRAUDIT_UPLOAD_EVENTS_DEBUG` | off | Safe debug logging when `NODE_ENV !== production` |
| `INTEGRATION_EVENTS_ENABLED` | off | Required for integration sink delivery |

- **Never throws** — delete route calls `notifyHairAuditUploadDeleted()` in a try/catch-safe wrapper
- **Never blocks** — fire-and-forget dispatch
- **No direct FI OS HTTP** — uses existing integration bridge (no-op default)
- **Payload safety check** — skips dispatch if signed URL / token patterns detected

---

## Delete Route Emission

Module: `src/app/api/uploads/delete/route.ts`

Emits **only after**:

1. Auth and case access pass
2. Upload row and storage path resolved
3. Storage object removed
4. `uploads` row deleted

Does **not** emit on failed auth, path gate failure, storage errors, or DB delete errors. Response shape unchanged (`{ ok: true }`).

Best-effort `audit_photos` cleanup runs before emit; emit failure never affects the HTTP response.

---

## Staging Readiness Checker

```bash
npm run check:hairaudit-events
```

Script: `scripts/check-hairaudit-event-readiness.mjs`

Validates (no network calls):

- `HAIRAUDIT_UPLOAD_EVENTS_ENABLED`
- `INTEGRATION_EVENTS_ENABLED`
- `HAIRAUDIT_UPLOAD_EVENTS_DEBUG` (warns if enabled in production)
- Optional sink vars: `INTEGRATION_EVENTS_SINK_URL`, `INTEGRATION_EVENTS_HEADERS`
- Secret hygiene: integration config must not reuse `SUPABASE_SERVICE_ROLE_KEY`

Output lines: `[PASS]`, `[WARN]`, or `[FAIL]`.

---

## Safe Staging Rollout

### Verify locally (no external FI dependency)

1. Run tests: `npm run test:upload-phase2e`, `npm run test:upload-phase2f`
2. Run readiness: `npm run check:hairaudit-events` (expect PASS with flags off)
3. Enable debug only in dev:
   ```env
   HAIRAUDIT_UPLOAD_EVENTS_DEBUG=true
   ```
4. Upload and delete a test photo; confirm debug log shows event payloads (no outbound calls)

### Enable staging forwarding (deliberate)

Both gates required:

```env
HAIRAUDIT_UPLOAD_EVENTS_ENABLED=true
INTEGRATION_EVENTS_ENABLED=true
```

Configure sink when adapter exists:

```env
INTEGRATION_EVENTS_SINK_URL=https://…
INTEGRATION_EVENTS_HEADERS=Authorization: Bearer …
```

Re-run `npm run check:hairaudit-events` before deploy.

### Rollback

Disable flags (immediate, no code deploy):

```env
HAIRAUDIT_UPLOAD_EVENTS_ENABLED=false
INTEGRATION_EVENTS_ENABLED=false
```

Upload and delete routes continue to work; events become no-ops again.

---

## FI OS Intelligence

**Not enabled.** Phase 2F does not migrate FI OS AI/classification or wire AuditOS events (`HAIRAUDIT_FI_EVENTS_ENABLED` remains separate and off). Upload events use the HairAudit integration bridge only.

---

## Recommended Next Phase

| Work | Phase |
|------|-------|
| Real HTTP/queue sink adapter for staging | 2G |
| Bridge upload events to FI image intelligence schema | 2G+ |
| `audit_photos` dual-write consistency across forensic routes | 2G |
| Manifest generation from event stream | 3.x |
| Storage path alignment / backfill (see 2D) | 2G |
| RLS on `uploads` | After path inventory frozen |

---

## References

| File | Purpose |
|------|---------|
| `src/lib/hairaudit/uploadEvents.ts` | Event types + builders |
| `src/lib/hairaudit/uploadEventDispatcher.ts` | Non-blocking dispatch |
| `src/app/api/uploads/delete/route.ts` | Delete hook |
| `scripts/check-hairaudit-event-readiness.mjs` | Staging readiness |
| `src/lib/integrations/emit.ts` | Integration bridge |
| `tests/uploadPhase2f.test.ts` | Phase 2F test suite |
