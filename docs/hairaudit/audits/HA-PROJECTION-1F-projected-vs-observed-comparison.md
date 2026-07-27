# HA-PROJECTION-1F — Projected vs Observed Outcome Comparison

**Date:** 2026-07-27  
**Status:** GREEN  
**Scope:** Canonical comparison between frozen HA-PROJECTION-1D Day-0 projection snapshots and linked HA-PROJECTION-1E follow-up observation snapshots  
**PHI:** None in this document, committed fixtures, or audit event bodies  

---

## Summary

HA-PROJECTION-1F is the first explainable comparison layer:

| Milestone | Question answered |
|-----------|-------------------|
| **1A** | What can HairAudit observe from surgery-day evidence? |
| **1B** | What projected characteristics follow from that reconstruction? |
| **1E** | What can HairAudit observe at this follow-up stage? |
| **1F** | How do frozen projected characteristics compare with frozen observed follow-up characteristics? |

1F does **not** create success/failure scores, surgeon rankings, graft survival percentages, patient outcome grades, better/worse-than-expected language, cohort benchmarking, generated future images, new ImagingOS measurements, model training, or generic projection accuracy %.

---

## Comparison vocabulary

```text
ProjectionComparisonStatus =
  consistent
  | partially_consistent
  | divergent
  | not_yet_assessable
  | insufficient_evidence
```

| Status | Meaning |
|--------|---------|
| `consistent` | Observed follow-up characteristics broadly align with the frozen projection |
| `partially_consistent` | Some relevant features align; others remain incomplete, mixed, or materially different |
| `divergent` | Clear observable evidence that projected and observed characteristics differ materially |
| `not_yet_assessable` | Follow-up stage is too early for that domain to be fairly assessed |
| `insufficient_evidence` | Stage may be appropriate, but submitted evidence is inadequate |

Forbidden evaluative labels: success, failure, achieved, missed, good, bad, excellent, poor.

---

## Inputs (immutable only)

1F compares:

1. Frozen 1D `projectionSnapshot` / `reconstructionSnapshot` payloads  
2. Frozen 1E `observationPayload` already linked via `projectionSnapshotId`

It does **not** re-read raw uploads, regenerate 1A/1B, or use the latest mutable report.

If projection P123 was frozen in July and later 1B logic changes, 1F still compares against P123’s frozen payload.

---

## Lineage

Every comparison references:

```text
projectionSnapshotId
observationSnapshotId
```

Fail closed when:

```text
observation.projectionSnapshotId !== projection.id
```

Case/patient ownership must also match. Lineage is never inferred by case alone.

Timeline:

```text
Projection P123
 ├─ O3  → C3
 ├─ O6  → C6
 ├─ O9  → C9
 └─ O12 → C12
```

Corrected observation O2 superseding O1 yields new comparison C2; C1 remains historically valid.

---

## Domain mapping

Only domains present in the frozen 1B projection are compared.

| 1B domain | 1E observation features |
|-----------|-------------------------|
| `frontal_framing` | `recipient.frontalAppearance` |
| `density_distribution` | `recipient.densityAppearance` |
| `transition_characteristics` | `recipient.transitionAppearance` |
| `native_hair_dependency` | `nativeHair.visibleNativeHairStatus` + `treatedVsUntreatedRelationship` |
| `untreated_or_lower_treatment_areas` | `recipient.crownAppearance` + density/overall relevant observations |

No new projection domains are invented in 1F. Omitted 1B domains produce no comparison row.

---

## Stage assessability

Explicit matrix (`STAGE_DOMAIN_ASSESSABILITY`):

| Domain | Month 3 | Month 6 | Month 9 | Month 12 |
|--------|---------|---------|---------|----------|
| `frontal_framing` | limited | partial | assessable | assessable |
| `density_distribution` | not_yet_assessable | partial | assessable | assessable |
| `transition_characteristics` | not_yet_assessable | partial | assessable | assessable |
| `native_hair_dependency` | partial | assessable | assessable | assessable |
| `untreated_or_lower_treatment_areas` | assessable | assessable | assessable | assessable |

Rules:

- `not_yet_assessable` → status forced to `not_yet_assessable` (do not conflate with poor evidence)
- `limited` → comparison allowed but cannot emit mature `divergent` (capped at `partially_consistent`); confidence capped low
- Month 3 density remains unfair for mature-result judgement
- Month 12 density with only donor image → `insufficient_evidence`

---

## Domain-specific comparison logic

Status derives from structured semantic signals (not string equality, embeddings, lexical overlap, or sentiment):

| Domain | Example consistent | Example divergent |
|--------|--------------------|-------------------|
| Frontal framing | Dominant frontal coverage established | Frontal less dominant than untreated native |
| Density | Anterior stronger than posterior | Posterior denser than frontal (mature + adequate evidence) |
| Transition | Graduated / soft / irregular blended | Abrupt / uniformly linear |
| Native hair | Native mid-scalp continues contributing | Native mid-scalp no longer contributing |
| Untreated areas | Crown lower density when crown untreated | Not treated as procedural failure |

Treatment-aware:

- Untreated crown with lower observed density → `consistent` with projected scope  
- Unprojected temples are not invented as a comparison domain  
- Domains omitted from frozen 1B are skipped  

---

## Overall status derivation

Weighting:

1. No domains beyond `not_yet_assessable` → `not_yet_assessable`  
2. All remaining are `insufficient_evidence` → `insufficient_evidence`  
3. All comparable domains `consistent` → `consistent`  
4. Mix of consistent + partially_consistent → `partially_consistent`  
5. Divergent present:  
   - ≥2 material (non-low confidence) divergent **or** majority divergent → `divergent`  
   - otherwise → `partially_consistent`  

No overall numeric score. No accuracy percentage.

---

## Comparison confidence

Independent from 1A reconstruction, 1B projection, and 1E observation confidence.

Factors: stage maturity, projection/observation confidence, evidence completeness, direct domain match, limitation count, status.

| Level | Typical conditions |
|-------|--------------------|
| high | Month 9/12, assessable domain, strong inputs, complete evidence, direct match |
| moderate | Assessable/partial stage with adequate but incomplete evidence |
| low | Month 3, limited assessability, weak observation evidence, insufficient/not-yet |

Never expressed as a percentage.

---

## Persistence

Table: `hairaudit_projection_comparisons`

| Behaviour | Rule |
|-----------|------|
| Create | New immutable row |
| Identical replay | Idempotent on `(projection_snapshot_id, observation_snapshot_id, comparison_checksum)` |
| Correction / rule revision | New row + supersession; prior not mutated |
| Delete | Not used for corrections; history retained |

Checksum: SHA-256 of canonical JSON covering projection identity/checksum, observation identity/checksum, comparison version, and payload (`generatedAt` excluded).

Versions:

| Constant | Value |
|----------|-------|
| `COMPARISON_SCHEMA_VERSION` | `ha-projection-comparison-v1` |
| Projection schema (persisted) | frozen 1D `snapshotSchemaVersion` |
| Observation schema (persisted) | frozen 1E `observationSchemaVersion` |

---

## Ownership / RLS

| Check | Behaviour |
|-------|-----------|
| Projection exists | Required |
| Observation exists | Required |
| Observation ↔ projection lineage | Fail closed |
| Case / patient match | Fail closed |
| Case ownership via `validateCaseOwnership` | Fail closed |
| Client-supplied patient as authority | Rejected |

Migration RLS: **service_role only**; `REVOKE` from `anon` / `authenticated`. Foreign keys use `ON DELETE RESTRICT` for comparison ↔ projection/observation.

---

## Audit events

| Event | When |
|-------|------|
| `comparison_created` | New insert |
| `comparison_reused` | Idempotent hit |
| `comparison_superseded` | Prior marked superseded |
| `comparison_lineage_rejected` | Observation not attached to projection |
| `comparison_ownership_rejected` | Cross-patient/case |
| `comparison_invalid_stage` | Unsupported stage |
| `comparison_unsafe_rejected` | Safety vocabulary failure |
| `comparison_read_denied` | Read ownership failure |

Logged: identifiers, versions, checksums, stage, overall status. **Not** logged: PHI bodies, image URLs, raw AI text dumps.

---

## Safety controls

Module: `projectionComparisonSafety.ts`

**Blocked** (non-exhaustive): successful/failed transplant, better/worse than expected/projected, exceeded/outperformed, on/off track, survival/growth/accuracy percentages, guaranteed, excellent/poor outcome, projection achieved.

**Allowed:** consistent, partially consistent, divergent, not yet assessable, insufficient evidence, broadly aligns, differs from, cannot yet be determined, visible/appears/observed.

Patient-safe summary examples avoid success verdicts:

- Month 6: some domains partially assessable; density/transition may remain incomplete  
- Month 12: broadly consistent framing/density language when evidence supports it  

---

## Patient / FiOS compatibility

Canonical output is structured for a future patient report:

```text
Projected → Observed → Comparison status + rationale
```

No new PDF architecture in 1F.

FiOS may later aggregate de-identified domain/status/stage fields. Aggregation, surgeon/clinic benchmarking, and cohort analytics are **not** implemented here.

---

## Tests

| File | Coverage |
|------|----------|
| `tests/projectionComparison.test.ts` | Stage, domains, treatment scope, native hair, confidence, lineage gate |
| `tests/projectionComparisonSafety.test.ts` | Safety allow/deny (20–26) |
| `tests/projectionComparisonService.test.ts` | Ownership, lineage, immutability, migration/RLS (1–4, 31–34) |

Regression: 1A–1E suites remain GREEN; photo satisfaction / pathway remain separately verifiable.

---

## Verification

| Check | Result |
|-------|--------|
| `pnpm typecheck` | PASS |
| ESLint on 1F files | PASS |
| 1F focused tests | PASS |
| 1A–1E focused regression | PASS |
| Migration SQL asserts (additive, RLS, service_role, indexes, RESTRICT) | PASS |

Repo-wide `pnpm lint` / `pnpm test` may retain pre-existing unrelated failures outside this milestone.

---

## No-PHI attestation

No patient names, emails, real case IDs from production, image URLs, or clinical notes are committed. Tests use synthetic UUIDs and fixture reconstructions only.

---

## Known limitations

- Comparison uses structured semantic signals over frozen prose; it is not a CV measurement layer  
- Month 3 frontal remains limited (no mature divergent judgement)  
- No patient-facing comparison report UI / PDF in 1F  
- No Supabase adapter beyond migration + in-memory repository (mirrors 1D/1E domain-first pattern)  
- No inter-observation (month 6 vs month 12) delta engine — each stage compares independently to Day-0 projection  

---

## Deferred

- Cohort modelling / FiOS aggregation  
- Surgeon / clinic benchmarking  
- Projection accuracy %  
- Graft survival inference  
- Better/worse-than-expected scoring  
- Generated future-result images  
- New ImagingOS anatomical measurements  
- Machine-learning calibration  

---

## Key files

| Path | Role |
|------|------|
| `supabase/migrations/20260727160000_hairaudit_projection_comparisons.sql` | Additive schema + RLS |
| `src/lib/projection/projectionComparison.ts` | Deterministic comparison engine |
| `src/lib/projection/projectionComparisonRules.ts` | Stage matrix + domain semantics |
| `src/lib/projection/projectionComparisonConfidence.ts` | Comparison confidence |
| `src/lib/projection/projectionComparisonSafety.ts` | Comparison-only safety |
| `src/lib/projection/projectionComparisonService.ts` | Create / idempotency / supersession |
| `src/lib/projection/projectionComparisonTypes.ts` | Snapshot domain types |
| `src/lib/projection/versions.ts` | `ha-projection-comparison-v1` |
