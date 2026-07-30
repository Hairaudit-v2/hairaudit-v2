# HA-PRE-SURGERY-INTELLIGENCE-2B — Production Readiness and Clinician Journey Validation

**Date:** 2026-07-30  
**Status:** GREEN (domain + remote migration + RLS + unit suite; E2E gated on live credentials/catalog)  
**Project:** HairAudit Supabase `vbzjkqhvzfunahmlxevb`  
**Predecessor:** HA-PRE-SURGERY-INTELLIGENCE-2A  
**Next (separate):** HA-PRE-SURGERY-INTELLIGENCE-2C — ImagingOS Projection Adapter and Clinician Approval Workflow  
**Then:** HA-PRE-SURGERY-INTELLIGENCE-2D — Controlled ImagingOS Activation and Production Pilot 

---

## Acceptance boundary

| Criterion | Result |
|-----------|--------|
| Remote migration and RLS verified | **PASS** |
| No cross-case / client-role table access (`anon`/`authenticated` grants = 0) | **PASS** |
| Access limited to auditor / assigned doctor / assigned clinic | **PASS** (policy + API gate) |
| Patients denied professional planning records | **PASS** |
| Version conflicts handled (409 + explicit rebase) | **PASS** |
| Historical plans/annotations immutable / reviewable | **PASS** |
| Report provenance tied to frozen graft-plan version | **PASS** |
| Projection failures degrade safely; stub is default | **PASS** |
| Patient-facing wording has no certainty / guaranteed claims | **PASS** |
| Unit tests | **PASS** (22/22 across 2A+2B) |
| E2E desktop + mobile | **Instrumented** — skips unless demo catalog / clinician env credentials present |
| Production build / typecheck | Run in CI / local verification |

---

## PART A — Remote migration evidence

Applied to `vbzjkqhvzfunahmlxevb`:

1. `hairaudit_pre_surgery_intelligence` (2A create + RLS + service_role grants + revoke anon/authenticated)
2. `hairaudit_pre_surgery_intelligence_2b_grants` (idempotent revoke)

### Tables (RLS enabled)

| Table | RLS |
|-------|-----|
| `hairaudit_pre_surgery_image_reviews` | true |
| `hairaudit_pre_surgery_image_corrections` | true |
| `hairaudit_pre_surgery_annotations` | true |
| `hairaudit_pre_surgery_observations` | true |
| `hairaudit_pre_surgery_graft_plans` | true |
| `hairaudit_pre_surgery_projections` | true |
| `hairaudit_pre_surgery_audit_events` | true |

### Grants

- `service_role`: ALL  
- `anon` / `authenticated`: **0 grants** (verified via `information_schema.role_table_grants`)

App-layer auth (`requirePreSurgeryClinicianAccess` + `decidePreSurgeryClinicianAccess`) is the authorisation boundary; DB is service-role only.

Repo migrations:

- `supabase/migrations/20260730120000_hairaudit_pre_surgery_intelligence.sql`
- `supabase/migrations/20260730123000_hairaudit_pre_surgery_intelligence_2b_grants.sql`

---

## PART B — Access matrix

| Actor | Decision |
|-------|----------|
| Auditor | allow (`auditor`) |
| Assigned doctor (`cases.doctor_id`) | allow (`assigned_doctor`) |
| Assigned clinic (`cases.clinic_id`) | allow (`assigned_clinic`) |
| Patient owner | deny (`patient_owner`) |
| Unrelated professional | deny (`unrelated_professional`) |

Pure policy: `src/lib/preSurgeryIntelligence/accessPolicy.ts`  
Server gate: `src/lib/preSurgeryIntelligence/access.server.ts`

E2E (`tests/e2e/hairaudit/pre-surgery-intelligence-2b.spec.ts` + mobile twin):

- Patient → workspace absent + API 403 + screenshot `tmp/pre-surgery-intelligence-2b-evidence/patient-denied-*.png`
- Auditor / doctor / clinic / unrelated → env-gated credentials

---

## PART C — Clinician journey (domain proven)

Unit coverage proves:

1. Image role correction preserves original AI values  
2. Annotation add → soft-delete → restore  
3. Observation confirm/correct  
4. Graft plan seed → revise → approve  
5. Plan comparison + audit event types  
6. Three illustrative modes (conservative / planned / optimistic-within-approved-range)  
7. Optimistic concurrency conflict + force rebase  
8. Reload semantics via versioned immutable rows (unique `(case_id, version)`)

Workspace UI: `/cases/[caseId]/professional/pre-surgery-review`  
Conflict UX: 409 → error + optional “Force rebase from head”

---

## PART D — Concurrency & immutability

- Edits require `basePlanId` + `expectedBaseVersion` matching current non-superseded head  
- Stale base → **HTTP 409** `version_conflict` (no silent overwrite)  
- Explicit `forceRebaseFromHead: true` required to rebase  
- Unique constraint `hairaudit_pre_surgery_graft_plans_case_version_uq` races → 409  
- Historical plan payloads must not mutate in place (`assertGraftPlanPayloadImmutable`)  
- Soft-deleted annotations remain loadable with `includeDeletedAnnotations: true`

---

## PART E — Report integration

`buildClinicianReportSlice` → `generatePreSurgeryPlanningReport({ clinicianReportSlice })`

**Included when approved:**

- Confirmed/corrected patient-safe observation domains  
- Approved graft plan zone/totals/donor band  
- Provenance: `approvedGraftPlanId`, `version`, `checksum`, observation count, approved projection ids, `frozenAt`  
- Patient-safe projection **labels** only when projection `status === approved`

**Excluded:**

- Draft clinician notes  
- Deleted annotations  
- Image correction history  
- Projection storage paths / validation internals  
- Generated-but-unapproved projections  

Patient-safe scorecard graft band prefers approved plan min–max when provenance is present.

---

## PART F — Projection readiness (pre-2C)

| Concern | Behaviour |
|---------|-----------|
| Default provider | `stub-v1` (`getDefaultPreSurgeryProjectionProvider`) |
| Healthcheck | `checkProjectionProviderHealth` |
| Timeout | `DEFAULT_PROJECTION_TIMEOUT_MS` (12s); instrumented calls |
| Failure | `degradable: true` + audit event metadata (no patient exposure) |
| Patient visibility | Requires explicit `PATCH .../projection/approve` → `status: approved` |

ImagingOS adapter deferred to **2C**.

---

## PART G — E2E evidence location

```
tmp/pre-surgery-intelligence-2b-evidence/
  patient-denied-desktop.png
  patient-denied-mobile.png
  auditor-workspace-desktop.png
  auditor-workspace-mobile.png
  auditor-workspace-bundle.json
  doctor-access-status.json
  clinic-access-status.json
```

Playwright:

- Desktop: `tests/e2e/hairaudit/pre-surgery-intelligence-2b.spec.ts`
- Mobile: `tests/e2e/hairaudit/pre-surgery-intelligence-2b-mobile.spec.ts` (matched in `playwright.config.ts`)

---

## Unit test evidence

```
npx tsx --test tests/preSurgeryIntelligence2a.test.ts tests/preSurgeryIntelligence2b.test.ts
→ 22 pass / 0 fail
```

---

## Explicitly out of scope (2C)

- Real image transformation / ImagingOS provider  
- Expanded clinician approval UX beyond approve/reject gate  
- Automatic patient report regeneration wiring from every plan approve (slice is ready; orchestration may hook Inngest/report rebuild separately)

---

## Verdict

**GREEN** for production readiness of the clinician-assisted planning domain: remote schema + RLS, access matrix, concurrency, report provenance, stub projection safety, and unit/E2E instrumentation. Proceed to **HA-PRE-SURGERY-INTELLIGENCE-2C** only after this boundary remains green in CI with live credentials.
