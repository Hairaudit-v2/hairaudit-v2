# HA-PRE-SURGERY-INTELLIGENCE-2C — ImagingOS Projection Adapter and Clinician Approval Workflow

**Date:** 2026-07-30  
**Status:** GREEN (domain + ImagingOS adapter + approval workflow + remote migration + unit suite; E2E gated on live credentials/catalog)  
**Project:** HairAudit Supabase `vbzjkqhvzfunahmlxevb`  
**Predecessor / rollback point:** HA-PRE-SURGERY-INTELLIGENCE-2B  
**Out of scope:** HA-PROJECTION-1A–1G (unchanged)

---

## Acceptance boundary

| Criterion | Result |
|-----------|--------|
| ImagingOS adapter via canonical `PreSurgeryProjectionProvider` | **PASS** |
| Stub remains default; no silent production substitute | **PASS** (`HA_PRE_SURGERY_PROJECTION_ALLOW_STUB_FALLBACK` required) |
| Immutable input provenance (canonical snapshot + checksum) | **PASS** |
| Callbacks authenticated + replay-protected | **PASS** |
| Idempotent generation (`Idempotency-Key`) | **PASS** |
| Failures/timeouts degrade safely | **PASS** |
| Clinician approval mandatory before patient visibility | **PASS** |
| Rejection + regeneration preserve history | **PASS** |
| Approved outputs go stale when plan changes | **PASS** |
| Cross-case / cross-tenant isolation (service-role + app gate) | **PASS** (inherits 2B) |
| Patient wording avoids outcome certainty | **PASS** |
| Report pinned to exact approved projection version | **PASS** |
| Unit + migration tests | **PASS** |
| Authenticated E2E | **Instrumented** — skips unless demo catalog / clinician env present |

---

## PART A — ImagingOS provider adapter

| Concern | Implementation |
|---------|----------------|
| Contract | `PreSurgeryProjectionProvider` (`projection/provider.ts`) |
| HTTP adapter | `projection/imagingOsProvider.ts` |
| Auth | Bearer `HA_IMAGINGOS_PROJECTION_TOKEN` |
| Signing | HMAC-SHA256 `X-HairAudit-Signature` when `HA_IMAGINGOS_PROJECTION_SIGNING_SECRET` set |
| Endpoint / model | `HA_IMAGINGOS_PROJECTION_URL`, `HA_IMAGINGOS_PROJECTION_MODEL` |
| Timeouts | connect + generation (`HA_IMAGINGOS_PROJECTION_*_TIMEOUT_MS`) |
| Retries | Transient 408/425/429/5xx; max 2 |
| Idempotency | `Idempotency-Key` header + DB unique `(case_id, idempotency_key)` |
| Health | `GET …/health` when provider exposes `healthcheck` |
| Stub roles | Local default · test provider · explicit fallback · `disabled` safe state |

Env:

```
HA_PRE_SURGERY_PROJECTION_PROVIDER=stub|imagingos|disabled
HA_IMAGINGOS_PROJECTION_URL=
HA_IMAGINGOS_PROJECTION_TOKEN=
HA_IMAGINGOS_PROJECTION_SIGNING_SECRET=
HA_IMAGINGOS_PROJECTION_MODEL=imagingos-projection-v1
HA_PRE_SURGERY_PROJECTION_ALLOW_STUB_FALLBACK=true   # only when intentional
```

---

## PART B — Canonical request + modes + lifecycle

Frozen inputs (`projection/canonicalRequest.ts`): case ID, source image IDs/roles/orientation/mirroring, approved observation IDs, approved graft-plan id/version/checksum, mode, geometry (hairline/recipient/deferred), provider/model, safety-label + generation-policy versions.

**Not sent:** deleted annotations, draft observations, superseded plans, free-text clinician notes, patient-identifying fields beyond case/image refs.

Lifecycle (`projection/stateMachine.ts`):

`draft_request → validation_failed | queued → generating → generated → clinician_review → approved | rejected | superseded | failed | expired`

Generated output cannot move directly to patient-visible (`generated → approved` illegal). Successful sync generation lands in `clinician_review`.

---

## PART C — Clinician approval / rejection / regeneration

API: `PATCH /api/cases/[caseId]/pre-surgery-intelligence/projection/approve`

- **approve** requires full checklist (11 confirmations) + records role, organisation, checksum, provider/model, safety/policy versions, optional note/override
- **reject** requires structured `reasonCode`
- **enable_sharing / revoke_sharing**
- New approval supersedes prior approved projection of same mode (history retained)

Regeneration: `POST …/projection` with `regeneratesFromProjectionId` creates a new attempt (never overwrites).

Workspace UI: checklist panel, reject reasons, regenerate, revoke sharing (`PreSurgeryIntelligenceWorkspace.tsx`).

---

## PART D — Patient visibility + report

Patient API: `GET …/projection/patient`

Requires: `approved` + sharing enabled + valid graft-plan version + safety labels/disclaimer + not expired/superseded.

Framing (always):

- Illustrative
- Based on current clinical plan
- Not a guarantee of density, growth, survival, or final appearance
- Subject to donor/healing/hair/future loss/adherence/clinical factors

Forbidden: “predicted result”, “expected result”, guaranteed claims.

Report slice pins `pinnedProjectionId` / `pinnedProjectionVersion` / `pinnedProjectionInputChecksum`. Reissue with `pinnedProjectionId` will not silently substitute a newer projection.

---

## PART E — Security

| Control | Behaviour |
|---------|-----------|
| Minimum necessary to ImagingOS | Canonical snapshot only (opaque storage refs) |
| Signed media | Not logged; patient API never returns storage paths |
| Callback route | `POST …/projection/callback` — signature + skew + replay store + case match |
| Service-role | Persistence remains server-only (2B grants unchanged) |
| Isolation | Clinician gate + case_id scoped queries |

---

## PART F — Observability

Audit events added: validation rejected, provider request/accept, timeout, provider failure, output safety failure, clinician review opened, regeneration requested, sharing enabled/revoked, superseded.

Metrics helper: `summariseProjectionMetrics` (success rate, latency percentiles, timeout/rejection/regeneration/sharing rates, approval turnaround).

---

## PART G — Remote DB evidence

Applied migration: `hairaudit_pre_surgery_intelligence_2c`  
Repo: `supabase/migrations/20260730140000_hairaudit_pre_surgery_intelligence_2c.sql`

Verified columns on `hairaudit_pre_surgery_projections`: `provider_id`, `idempotency_key`, `patient_sharing_enabled`, `projection_version`.

---

## PART H — Tests

```
npx tsx --test tests/preSurgeryIntelligence2a.test.ts \
  tests/preSurgeryIntelligence2b.test.ts \
  tests/preSurgeryIntelligence2c.test.ts \
  tests/preSurgeryIntelligence2cMigration.test.ts
```

Playwright:

- `tests/e2e/hairaudit/pre-surgery-intelligence-2c.spec.ts`
- `tests/e2e/hairaudit/pre-surgery-intelligence-2c-mobile.spec.ts` (matched in `playwright.config.ts`)

Evidence dir: `tmp/pre-surgery-intelligence-2c-evidence/`

---

## Rollback

**Stable rollback point: HA-PRE-SURGERY-INTELLIGENCE-2B**

1. Set `HA_PRE_SURGERY_PROJECTION_PROVIDER=stub` (or `disabled`) — never enable ImagingOS until readiness checklist passes.
2. Stop using expanded approval UX; 2B approve path remains functionally reachable via checklist-complete bridge.
3. Do **not** drop 2C columns in production without a follow-up migration; they are additive and null-safe.
4. Revert application code to the 2B audit commit / tag before re-enabling any real image-generation provider.

---

## Verdict

**GREEN** for ImagingOS projection adapter + clinician approval workflow on top of the 2B domain. Stub remains the safe default. Real ImagingOS traffic requires explicit env configuration and must not silently substitute stub in production.

**Next:** HA-PRE-SURGERY-INTELLIGENCE-2D — Controlled ImagingOS Activation and Production Pilot (allowlists, preflight, shadow, kill switches). Keep `HA_PRE_SURGERY_PROJECTION_PROVIDER=stub` until that pilot.
