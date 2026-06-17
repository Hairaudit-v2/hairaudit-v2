# HairAudit V2 — Phase 3A: FI Image-Intelligence Job Enqueue

**Date:** 2026-06-17  
**Scope:** Queue orchestration for FI image-intelligence jobs from `upload.created` events (no AI execution)  
**Prerequisites:** [Phase 2G](./hairaudit-v2-phase-2g-event-sink-fi-bridge.md)  
**Integration reference:** [FUTURE-INTEGRATION-ARCHITECTURE.md](../FUTURE-INTEGRATION-ARCHITECTURE.md)

---

## Executive Summary

Phase 3A enqueues durable FI image-intelligence jobs when eligible forensic uploads complete. Upload routes, UI, RLS, schema, and storage paths are unchanged. No image classification or AI provider calls run in this phase.

| Deliverable | Status |
|-------------|--------|
| `fiImageIntelligenceQueue.ts` — injectable enqueue adapter | ✅ |
| `fiImageIntelligenceEnqueue.ts` — evaluator + orchestration | ✅ |
| `uploadEventDispatcher` wired for `upload.created` | ✅ |
| Idempotency key contract | ✅ |
| Phase 3A tests (`test:upload-phase3a`) | ✅ |
| Readiness checker Phase 3A updates | ✅ |

---

## Feature Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED` | off | Enables enqueue evaluation and Inngest job submission |
| `HAIRAUDIT_UPLOAD_EVENTS_ENABLED` | off | Unrelated — HTTP integration sink (Phase 2G) |
| `INTEGRATION_EVENTS_ENABLED` | off | Unrelated — HTTP integration sink (Phase 2G) |

**FI enqueue is independent of upload HTTP event delivery.** Enabling `HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED=true` does not require integration sink flags.

### Durable queue dependency

When the FI flag is on, jobs are sent via Inngest:

| Variable | Purpose |
|----------|---------|
| `INNGEST_EVENT_KEY` | Required for durable enqueue; without it jobs are skipped (non-blocking) |

---

## Enqueue Behaviour

Module flow:

1. Upload route calls `notifyHairAuditUploadCreated()` after confirmed DB insert.
2. Dispatcher builds `hairaudit.upload.created` and calls `enqueueFiImageIntelligenceFromUploadEvent()` (fire-and-forget).
3. `planFiImageIntelligenceEnqueue()` runs `evaluateFiImageIntelligenceEnqueue()` from Phase 2G.
4. When eligible, `getFiImageIntelligenceQueue()` submits a job via Inngest.

### Eligibility (`evaluateFiImageIntelligenceEnqueue`)

| Event / surface | Enqueue |
|-----------------|---------|
| `upload.created` + `forensic_audit` | ✅ when FI flag enabled |
| `upload.created` + `surgery_evidence` | ✅ when FI flag enabled |
| `upload.deleted` | ❌ suppression only (Phase 3B+) |
| `training` | ❌ explicit: isolated from forensic pipeline |
| `community` | ❌ explicit: excluded from forensic pipeline |
| `bulk_admin` | ❌ explicit: pending per-case assignment validation |
| `doctor_portal` | ❌ explicit: isolated v2 surface |
| Unknown surface | ❌ explicit reason |

### Non-blocking guarantees

- Enqueue runs asynchronously after upload event dispatch.
- Queue adapter never throws to upload routes.
- Inngest failures are logged and swallowed.
- Missing `INNGEST_EVENT_KEY` skips enqueue with `skippedReason: inngest-event-key-not-configured`.

---

## Idempotency Key

Format:

```
hairaudit:image-intelligence:{case_id}:{upload_id}:v1
```

| Segment | Meaning |
|---------|---------|
| `hairaudit:image-intelligence` | Namespace prefix |
| `{case_id}` | Source case UUID |
| `{upload_id}` | Source upload UUID |
| `v1` | Payload contract version — bump only when job shape changes |

The key is passed as Inngest event `id` for deduplication within Inngest's idempotency window.

Helper: `buildFiImageIntelligenceIdempotencyKey(caseId, uploadId)`.

---

## Queue Adapter

Module: `src/lib/hairaudit/fiImageIntelligenceQueue.ts`

| Mode | When | Behaviour |
|------|------|-----------|
| Injected (tests) | `setFiImageIntelligenceQueue()` | Uses test double |
| Inngest | FI flag on + default | `inngest.send()` with event name `hairaudit/fi.image-intelligence.enqueue` |
| No-op | FI flag off | Returns `skippedReason: fi-image-intelligence-queue-disabled` |

### Job payload

```typescript
{
  idempotency_key: string;
  input: FiImageIntelligenceInput;  // Phase 2G bridge mapping
  enqueued_at: string;              // ISO timestamp
}
```

---

## Future Worker Contract (Phase 3B)

The Inngest function handler is **not registered in Phase 3A**. Events accumulate until Phase 3B adds:

| Item | Phase 3B plan |
|------|---------------|
| Inngest function id | `fi-image-intelligence-v1` |
| Trigger event | `hairaudit/fi.image-intelligence.enqueue` |
| Input | `FiImageIntelligenceJobPayload` |
| Responsibilities | Fetch image from `storage_bucket`/`storage_path`, run FI OS classification, persist results |
| Idempotency | Reject or no-op duplicate jobs matching same `idempotency_key` |
| Deletion sync | Consume `upload.deleted` for suppression/tombstone (Phase 3B+) |

Worker must **not** assume upload HTTP integration sink delivery — it reads job payload only.

---

## Rollback Plan

Disable immediately (no code deploy required):

```env
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED=false
```

Effects:

- No new FI image-intelligence jobs enqueued.
- Upload routes unchanged.
- In-flight Inngest events remain until TTL; worker not registered yet so they are no-ops.

To stop Inngest delivery while debugging:

- Remove or rotate `INNGEST_EVENT_KEY` in the deployment environment (enqueue skips gracefully).

---

## What Is Still Not Implemented

| Work | Phase |
|------|-------|
| Inngest worker / FI OS image classification | 3B |
| Deletion suppression sync to FI | 3B+ |
| Classification result persistence | 3B+ |
| `audit_photos` dual-write consistency | 3A / 3B |
| Manifest generation from event stream | 3.x |
| RLS on `uploads` | After path inventory frozen |

---

## Verification Commands

```bash
npm run typecheck
npm run test:upload-phase3a
npm run test:upload-phase2g
npm run test:upload-phase2f
npm run test:upload-auth
npm run check:hairaudit-events
```

---

## References

| File | Purpose |
|------|---------|
| `src/lib/hairaudit/fiImageIntelligenceQueue.ts` | Queue adapter + idempotency key |
| `src/lib/hairaudit/fiImageIntelligenceEnqueue.ts` | Orchestration |
| `src/lib/hairaudit/fiImageIntelligenceBridge.ts` | Eligibility evaluation (Phase 2G) |
| `src/lib/hairaudit/uploadEventDispatcher.ts` | Upload lifecycle hook |
| `scripts/check-hairaudit-event-readiness.mjs` | Staging readiness |
| `tests/uploadPhase3a.test.ts` | Phase 3A test suite |
