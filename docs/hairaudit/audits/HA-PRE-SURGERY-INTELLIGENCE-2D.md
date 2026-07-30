# HA-PRE-SURGERY-INTELLIGENCE-2D — Controlled ImagingOS Activation and Production Pilot

**Date:** 2026-07-30  
**Status:** DOMAIN GREEN (activation controls + preflight + shadow + validation + staleness + consent + ops + rollback suite; live ImagingOS traffic remains OFF)  
**Project:** HairAudit Supabase `vbzjkqhvzfunahmlxevb`  
**Predecessor / rollback point:** HA-PRE-SURGERY-INTELLIGENCE-2B (operational) · HA-PRE-SURGERY-INTELLIGENCE-2C (adapter)  
**Out of scope:** HA-PROJECTION-1A–1G (unchanged)

---

## Production posture (current)

```
HA_PRE_SURGERY_PROJECTION_PROVIDER=stub
HA_PRE_SURGERY_IMAGINGOS_ENABLED=false
```

A configured ImagingOS endpoint must **not** automatically mean every eligible professional can generate projections. Real ImagingOS credentials are introduced only as part of a controlled 2D activation, never as an ordinary configuration change.

---

## Acceptance boundary

| Criterion | Result |
|-----------|--------|
| Global ImagingOS enablement independent of provider env | **PASS** (`HA_PRE_SURGERY_IMAGINGOS_ENABLED`) |
| Tenant/clinic, clinician, case, mode allowlists | **PASS** |
| Max requests / case + daily generation ceiling | **PASS** |
| Provider kill switch + independent patient-sharing kill switch | **PASS** |
| Preflight rejects without contacting ImagingOS | **PASS** |
| Shadow mode → clinician_review, no patient sharing, no auto report pin | **PASS** |
| Provider-output validation → `failed` not `clinician_review` | **PASS** |
| Staleness after plan/evidence/policy/share revocation | **PASS** |
| Ops dashboard aggregation | **PASS** (pure domain; API optional) |
| Patient consent statements + approval date / plan version presentation | **PASS** |
| Rollback to 2B boundary rehearsed (env vs DB documented separately) | **PASS** (unit-verified) |
| No predicted/guaranteed surgical-result language | **PASS** |
| Live ImagingOS allowlisted traffic + full live cycle evidence | **DEFERRED** — keep `provider=stub` until pilot |
| Cross-tenant isolation with real sessions / live desktop+mobile | **Inherits 2B/2C**; live ImagingOS E2E gated |

**2D is DOMAIN GREEN with stub.** Full production GREEN for live ImagingOS requires an allowlisted pilot with evidenced request → callback → review → approve/reject, plus kill-switch and rollback drills on the target environment.

---

## PART A — Activation controls

| Control | Env / mechanism |
|---------|-----------------|
| Global ImagingOS enablement | `HA_PRE_SURGERY_IMAGINGOS_ENABLED=true` |
| Clinic allowlist | `HA_PRE_SURGERY_PROJECTION_CLINIC_ALLOWLIST` (CSV) |
| Clinician allowlist | `HA_PRE_SURGERY_PROJECTION_CLINICIAN_ALLOWLIST` |
| Case allowlist | `HA_PRE_SURGERY_PROJECTION_CASE_ALLOWLIST` |
| Case-level enablement | `caseLevelEnabled` on request context / DB column |
| Mode allowlist | `HA_PRE_SURGERY_PROJECTION_MODE_ALLOWLIST` |
| Max requests per case | `HA_PRE_SURGERY_PROJECTION_MAX_REQUESTS_PER_CASE` |
| Daily generation ceiling | `HA_PRE_SURGERY_PROJECTION_DAILY_CEILING` |
| Provider kill switch | `HA_PRE_SURGERY_PROVIDER_KILL_SWITCH=true` |
| Patient-sharing kill switch | `HA_PRE_SURGERY_PATIENT_SHARING_KILL_SWITCH=true` |
| Shadow mode | `HA_PRE_SURGERY_PROJECTION_SHADOW_MODE=true` |
| Release stage | `HA_PRE_SURGERY_PROJECTION_RELEASE_STAGE` |

Release stages: `internal_review_only` → `selected_clinicians` → `selected_clinics` → `selected_consented_patients` → `wider_controlled`.

When ImagingOS is enabled and stage is unset → defaults to `internal_review_only`. When ImagingOS is off → `wider_controlled` (preserves 2C stub sharing behaviour).

Implementation: `projection/activationControls.ts`

---

## PART B — Preflight

Before each real request, `runProjectionPreflight` verifies:

1. Case is `pre_surgery`
2. Professional remains assigned and authorised
3. Source images still exist
4. Required image corrections complete
5. Approved graft-plan version remains current
6. Immutable snapshot checksum matches
7. Projection mode enabled
8. Provider healthy
9. Case has not exceeded generation limits
10. Patient consent / clinic policy for generation satisfied
11. Activation allowlists

Failed preflight → audit `projection_preflight_rejected` / `projection_activation_denied` with `contactedProvider: false`.

---

## PART C — Shadow mode

Safest first activation:

- Send genuine eligible cases to ImagingOS (when enabled)
- Store outputs as `clinician_review`
- Prevent patient sharing globally
- Prevent automatic report inclusion
- Require senior clinician review
- Compare with source plan + safety checklist
- Record structured rejection reasons

Quality-review dimensions: hairline accuracy, zone boundaries, density realism, donor limitation representation, facial/scalp distortion, artefacts, deferred-zone handling, cross-mode consistency, patient-safe visual interpretation.

Cohort categories: internal demo · synthetic/consented staff · retrospective completed · consented new pre-surgery.

---

## PART D — Provider-output validation

Before `clinician_review`, validate MIME, size, dimensions, non-executable payload, case/attempt correspondence, provider request ID, safety metadata, no unexpected embedded patient data, storage checksum.

Failures → status `failed` (never `clinician_review`).

---

## PART E — Staleness

Auto-mark stale when: approved graft plan changes · source role/orientation changes · relevant annotation changes · approved observations change · policy version changes materially · provider/model retired · case no longer eligible · patient sharing revoked.

Stale projections remain auditable; `patientSharingEnabled=false`; excluded from new report selection. Historically pinned reports remain readable via explicit `pinnedProjectionId`.

---

## PART F — Ops dashboard

`buildProjectionOpsDashboard` surfaces: provider health, queued/generating, failed/timeouts, awaiting review, approval/rejection rates, common rejection reasons, median generation time, stale approved cases, patient-shared count, reports pinned, provider/model versions, kill-switch/shadow flags.

---

## PART G — Patient consent + presentation

Consent statements (all required before sharing in ImagingOS / consented-patient stages):

- The projection is illustrative
- Based on the current plan and supplied images
- Does not predict exact graft survival or growth
- Does not guarantee density or final appearance
- Surgical decisions remain subject to in-person clinical assessment
- The plan may change on the day of surgery

Patient presentation always includes approval date + graft-plan version.

---

## PART H — Rollback to 2B

Environment rollback (no data loss):

1. `HA_PRE_SURGERY_PROJECTION_PROVIDER=stub` (or `disabled`)
2. `HA_PRE_SURGERY_IMAGINGOS_ENABLED=false`
3. Optional `HA_PRE_SURGERY_PROVIDER_KILL_SWITCH=true`
4. `HA_PRE_SURGERY_PATIENT_SHARING_KILL_SWITCH=true` to revoke new sharing independently

Database rollback:

- Do **not** drop 2C/2D columns or consent rows
- Preserve all attempts and approvals
- Revoke sharing in application/batch (`revokeAllPatientSharing`) where required

Runtime:

- Pinned reports remain readable
- New report inclusion blocked while provider disabled / kill switches active
- Clinician workspace remains functional on stub/disabled

Verified by `verifyRollbackTo2BBoundary` + `ROLLBACK_2B_CHECKLIST`.

---

## PART I — Migration

Repo: `supabase/migrations/20260730160000_hairaudit_pre_surgery_intelligence_2d.sql`

- Columns: `stale_at`, `stale_reasons`, `shadow_mode`, `quality_cohort_category`, `patient_consent_id`, `case_level_enabled`
- Table: `hairaudit_pre_surgery_projection_consents` (service_role only)
- Audit events: preflight/activation/output-validation/consent/stale/shadow-review

---

## PART J — Tests

```
npx tsx --test tests/preSurgeryIntelligence2a.test.ts \
  tests/preSurgeryIntelligence2b.test.ts \
  tests/preSurgeryIntelligence2c.test.ts \
  tests/preSurgeryIntelligence2d.test.ts \
  tests/preSurgeryIntelligence2cMigration.test.ts \
  tests/preSurgeryIntelligence2dMigration.test.ts
```

---

## Controlled patient release (when going live)

1. Internal review only (shadow)
2. Selected clinicians
3. Selected clinics
4. Selected consented patients
5. Wider controlled availability

At every stage, generation and patient sharing remain independently reversible.

---

## Verdict

**DOMAIN GREEN** for controlled ImagingOS activation machinery on top of 2C.  
**Production remains on stub.** Introduce ImagingOS credentials only inside an allowlisted 2D pilot with shadow mode first, evidenced live cycles, kill-switch drills, and a rehearsed rollback to the 2B operational boundary.
