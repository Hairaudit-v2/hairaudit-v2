# HA-PROJECTION-1E — Longitudinal Observed Outcome Capture

**Date:** 2026-07-27  
**Status:** GREEN  
**Scope:** Canonical observed follow-up outcome snapshots attached to frozen HA-PROJECTION-1D projection identities  
**PHI:** None in this document, committed fixtures, or audit event bodies  

---

## Summary

HA-PROJECTION-1E is the longitudinal equivalent of HA-PROJECTION-1A:

| Milestone | Question answered |
|-----------|-------------------|
| **1A** | What can HairAudit observe from surgery-day evidence? |
| **1E** | What can HairAudit observe at this follow-up stage? |

1E does **not** compare projected vs observed, score accuracy, invent predictions, generate future images, or create cohort intelligence. Those belong to **1F+**.

---

## Stage model

Canonical stages only (no `month_18` — taxonomy does not support it cleanly):

| Stage | Category family | Timing window (approx. months since procedure) |
|-------|-----------------|-----------------------------------------------|
| `month_3` | `postop_month3_*` | 2 – 4.5 |
| `month_6` | `postop_month6_*` | 4.5 – 7.5 |
| `month_9` | `postop_month9_*` | 7.5 – 10.5 |
| `month_12` | `postop_month12_*` | 10.5 – 18 |

Provenance sources (combined, fail-closed on conflict):

1. Image capture date vs procedure date  
2. Milestone category key  
3. Intake `months_since` band  
4. Numeric months since procedure  
5. Declared stage (trusted workflow override)

**Rule:** category names are hints only. If category implies month 6 but capture timing indicates month 3 → `stageConfidence = low`, `usableForExactStage = false`. No silent misclassification.

---

## Evidence normalization

Canonical roles (`LongitudinalEvidenceRole`):

- `followup_front` · `followup_left` · `followup_right` · `followup_top` · `followup_crown`
- `followup_donor_rear` · `followup_donor_closeup` · `followup_recipient_closeup`

Accepted aliases (storage unchanged):

| Alias family | Example |
|--------------|---------|
| Patient milestone | `patient_photo:postop_month6_front` |
| Patient current | `patient_photo:patient_current_front` |
| Patient close-up | `patient_photo:current_recipient_closeup` |
| Doctor/clinic | `doctor_photo:img_followup_front`, `clinic_photo:img_followup_donor` |

Resolvers:

- `resolveLongitudinalEvidenceRole(upload, caseContext)`
- `resolveLongitudinalOutcomeStage(upload, caseContext)`
- `assessLongitudinalEvidence(...)` — treatment-aware completeness

**Minimum:** `followup_front`  
**Strongly recommended:** `followup_top`, `followup_recipient_closeup`, `followup_donor_rear`  
**Crown:** required in recommended set only when treated areas include crown/vertex.

Ideal capture protocol maps to existing HairAudit milestone guidance (front, top, left, right, recipient close-up, donor rear, donor close-up, crown if treated). No competing photo taxonomy.

---

## Projection lineage

Every observation attaches explicitly to:

```text
projectionSnapshotId  (frozen HA-PROJECTION-1D id)
```

Not to “latest projection”, report id alone, or implicit current.

```text
Projection P123 (may later be superseded by P124)
  ├── Month 3 observation O1
  ├── Month 6 observation O2
  └── Month 12 observation O3
```

If P123 is superseded, historical observations remain attached to P123. Lineage is never rewritten.

Contract helpers (1D stub extended):

- `attachLongitudinalObservationReference`
- `assertNoRetrospectiveContamination`

---

## Observed outcome model

Type: `LongitudinalOutcomeObservation`

Domains (descriptive only; feature keys aligned for future 1F comparison without claiming equivalence):

| Observation key | Aligns toward projection domain |
|-----------------|----------------------------------|
| `frontal_appearance` | `frontal_framing` |
| `density_appearance` | `density_distribution` |
| `transition_appearance` | `transition_characteristics` |
| `native_hair_status` | `native_hair_dependency` |

Also: directional, crown (when relevant), donor appearance / depletion / scarring, healing, overall observations.

Density stays qualitative unless a measured source exists (none invented in 1E).

---

## Immutability / supersession / idempotency

Table: `hairaudit_projection_observations`

| Behaviour | Rule |
|-----------|------|
| Create | New immutable row |
| Identical replay | Idempotent on `(projection_snapshot_id, stage, observation_checksum)` |
| Correction | New row + supersession; prior not mutated |
| Current | One `active` observation per `(projection_snapshot_id, stage)` |
| Delete | Not used for corrections; history retained |

Checksum: SHA-256 of canonical JSON (`observedAt` excluded from hashed domain).  
Versions:

| Constant | Value |
|----------|-------|
| `OBSERVATION_SCHEMA_VERSION` | `ha-projection-observation-v1` |
| `OBSERVATION_LINEAGE_VERSION` | `ha-projection-lineage-v1` |

---

## Ownership / RLS

| Check | Behaviour |
|-------|-----------|
| Projection exists | Required |
| Projection case matches | Fail closed |
| Projection patient matches | Fail closed |
| Case ownership via `validateCaseOwnership` | Fail closed |
| Client-supplied patient as authority | Rejected |

Migration RLS: **service_role only**; `REVOKE` from `anon` / `authenticated`. No direct client row exposure. Application gateway writes via domain service.

Foreign keys use `ON DELETE RESTRICT` for observation ↔ projection (preserve audit history).

---

## Observation domains & stage-aware wording

Examples:

- **Month 3:** “Early visible growth is present through the frontal region…” — not “density below expected.”
- **Month 6:** developing / incomplete maturation language — not failure.
- **Month 3 donor:** “Visible donor variation remains present…” — not “permanent overharvesting confirmed.”

First release prefers **stage-local** observations. Inter-stage comparison deferred to 1F.

---

## Safety controls

Module: `longitudinalObservationSafety.ts`

**Blocked** (non-exhaustive): successful/failed transplant, better/worse than expected/projected, on/off track, survival/growth percentages, final result, excellent/poor outcome, guaranteed, permanent damage, projection variance/error, forecast accuracy.

**Allowed:** cannot yet be determined, visible, appears, observed, not clearly visible, image-limited.

Observation confidence is separate from 1B projection confidence (image quality, stage provenance, view completeness, treated-area coverage, donor evidence, capture protocol).

---

## Audit events

| Event | When |
|-------|------|
| `observation_snapshot_created` | New insert |
| `observation_snapshot_reused` | Idempotent hit |
| `observation_snapshot_superseded` | Prior marked superseded |
| `observation_ownership_rejected` | Cross-patient/case |
| `observation_invalid_stage` | Unsupported / mismatched stage |
| `observation_invalid_evidence` | Builder/shape failure |
| `observation_read_denied` | Read ownership failure |

Logged: identifiers, versions, checksums, stage. **Not** logged: PHI bodies, image URLs, raw AI text dumps.

---

## Tests

| File | Coverage |
|------|----------|
| `tests/longitudinalEvidence.test.ts` | Stage resolution + evidence aliases (1–8) |
| `tests/projectionObservationService.test.ts` | Ownership, lineage, immutability, migration/RLS (9–17) |
| `tests/longitudinalOutcomeObservation.test.ts` | Domains + confidence (18–22, 29–32) |
| `tests/longitudinalObservationSafety.test.ts` | Safety allow/deny (23–28) |

Regression: 1A–1D suites GREEN; photo satisfaction GREEN.

---

## Verification

| Check | Result |
|-------|--------|
| `pnpm typecheck` | PASS |
| ESLint on 1E files | PASS |
| 1E focused tests | PASS (36) |
| 1A–1D + photo satisfaction | PASS |
| Migration SQL asserts (additive, RLS, service_role, indexes, RESTRICT) | PASS |

Repo-wide `pnpm lint` retains pre-existing unrelated failures outside this milestone.

---

## No-PHI attestation

No patient names, emails, real case IDs from production, image URLs, or clinical notes are committed. Tests use synthetic UUIDs and fixture reconstructions only.

---

## Known limitations

- Clinic/doctor `img_followup_*` keys are not month-banded — require timing / months_since for exact stage.
- No left/right patient milestone keys in taxonomy — roles exist for future/clinic mapping.
- No inter-stage comparison in 1E.
- No patient-facing longitudinal report UI / PDF in 1E.
- No Supabase adapter beyond migration + in-memory repository (mirror of 1D domain-first pattern); production write path can follow `projectionSnapshotPersist.server.ts` pattern later.

---

## Deferred to 1F

- Projected vs observed comparison / deltas  
- Accuracy grading, on/off track, better/worse than expected  
- Cohort modelling  
- Generated future images  
- Surgeon benchmarking  
- New ImagingOS / CV measurements  

---

## Key files

| Path | Role |
|------|------|
| `supabase/migrations/20260727140000_hairaudit_projection_observations.sql` | Additive schema + RLS |
| `src/lib/projection/longitudinalEvidence.ts` | Role + stage provenance |
| `src/lib/projection/longitudinalOutcomeObservation.ts` | Deterministic observation builder |
| `src/lib/projection/longitudinalObservationConfidence.ts` | Observation confidence |
| `src/lib/projection/longitudinalObservationSafety.ts` | Observation-only safety |
| `src/lib/projection/projectionObservationService.ts` | Create / idempotency / supersession |
| `src/lib/projection/projectionObservationTypes.ts` | Snapshot domain types |
| `src/lib/projection/versions.ts` | `ha-projection-observation-v1` |
