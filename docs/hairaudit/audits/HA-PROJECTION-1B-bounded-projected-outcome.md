# HA-PROJECTION-1B — Bounded Patient-Safe Projected Outcome

**Date:** 2026-07-27  
**Status:** GREEN  
**Scope:** Deterministic patient-safe projection DTO from canonical 1A reconstruction  
**PHI:** None in this document or committed fixtures  

---

## Summary

HA-PROJECTION-1B adds `buildSurgeryDayProjectedOutcome(...)`, which consumes only `SurgeryDayProcedureReconstruction` from 1A and emits bounded, explainable projected cosmetic characteristics. Observation, projection, confidence, and limitations remain structurally separate. No PDF, report UI, migration, LLM, or new CV stack.

---

## Input contract from 1A

```text
Raw evidence
  ↓
HA-PROJECTION-1A  buildSurgeryDayProcedureReconstruction(...)
  ↓
HA-PROJECTION-1B  buildSurgeryDayProjectedOutcome(reconstruction)
  ↓
patient-safe SurgeryDayProjectedOutcome
```

1B does **not** independently derive claims from:

- raw upload category strings  
- raw forensic AI payloads  
- raw report summary objects  
- storage paths  
- direct Supabase rows  
- alternate procedure metadata precedence  

If 1A cannot establish a feature, 1B treats it as unavailable and omits the related domain.

### Assessment type mapping

| 1A | 1B |
|----|----|
| `surgery_day_reconstruction` | `surgery_day_projection` |
| `surgery_day_reconstruction_with_baseline` | `surgery_day_projection_with_baseline` |

`PatientReviewPathway` remains `pre_surgery | post_surgery` only.

---

## Domains implemented

| Domain | Eligibility (summary) |
|--------|------------------------|
| `frontal_framing` | Hairline / frontal / temple observations or treated frontal zones |
| `density_distribution` | Qualitative density or recipient placement evidence |
| `transition_characteristics` | Symmetry/transition, hairline irregularity, or direction evidence |
| `native_hair_dependency` | **Requires** valid baseline + native/treatment-relationship features |
| `untreated_or_lower_treatment_areas` | Clear treated-area reconstruction excluding crown/temples or taper evidence |

Unsupported domains are omitted (not filled with generic prose).

---

## Projection eligibility rules

- Every characteristic must link `sourceObservationKeys` to 1A observed feature keys (or graft provenance keys).  
- Every characteristic must include separate `observation`, `projection`, `confidence`, and `limitations[]`.  
- Surgery-day-only mode must not claim amount of hairline lowering or exact recession correction.  
- Baseline mode may make comparative context statements (e.g. previously recessed area appears treated) without claiming future success.  
- Donor evidence may contribute limitations / immediate-post-op wording only — no mature donor prediction.  
- Graft counts are context only; never converted into expected cosmetic success.  
- Patient-reported counts use provenance entries and are never labeled clinic-confirmed.  
- GII `imageDerivedEstimate` remains separate from reported counts (not used as success density).

---

## Confidence rules

`projectionConfidence` is **independent** from `reconstructionConfidence`.

Factors include: baseline availability/strength, recipient/donor/design presence, multiple surgery-day views, procedure metadata completeness, graft provenance reliability, supported domain count, conflicting metadata, weak `any_day0` recipient evidence, image limitations.

| Band | Principle |
|------|-----------|
| HIGH | Strong reconstruction + valid baseline + multiple surgery-day views + reliable procedure context + few conflicts + ≥3 domains |
| MODERATE | Good surgery-day evidence with incomplete baseline/support |
| LOW | Recipient-only / uncertain provenance / conflicts / weak evidence |

Projection confidence is **not** a probability of clinical success.

---

## Allowed language

Qualified phrases such as:

- may / appears designed to / could support  
- if growth progresses normally / if maturation progresses normally  
- would be expected to appear / would be expected in  
- cannot yet be determined / cannot yet be assessed  

Standard assumptions always include uncomplicated healing, normal shedding/maturation **if growth occurs**, no graft-survival statement, independent native-hair change, and that final appearance cannot be established from surgery-day images alone.

---

## Forbidden language

Deterministic post-generation validation in `surgeryDayProjectionSafety.ts` blocks (non-exhaustive):

- guaranteed / guarantee / will definitely / will grow  
- expected survival rate / graft survival percentage / success rate / probability of success  
- final density will be / final result will be  
- perfect / excellent outcome / poor outcome / successful|failed transplant  
- natural result guaranteed / NN% growth|survival|success  
- exact future grafts/cm² and related fake precision  

Hard certainty is never waived by surrounding qualification. Unsafe characteristics fail closed (omitted); wholly unsafe outcomes return `ok: false`.

**EliteReportHtml “Predictive Outlook”** graft-survival expectation language was audited and is **not** reused as a canonical source.

---

## No-fake-precision controls

Explicitly prohibited as derived 1B values:

- grafts/cm², recipient surface area, exact site/extraction counts  
- hairline/temporal angle, symmetry percentage  
- graft survival / growth percentage, future hair calibre  
- final density / final donor depletion  

Verified clinical values already present in 1A may be used as **context** only.

---

## Patient-safe DTO

```ts
SurgeryDayProjectedOutcome {
  assessmentType
  reconstructionConfidence
  projectionConfidence
  summary
  projectedCharacteristics[]  // observation | projection | confidence | limitations
  whatCannotYetBeDetermined[]
  assumptions[]
  limitations[]
}
```

Allowlist-built; no chain-of-thought, raw model reasoning, prompts, forensic payloads, or auditor-only notes.

---

## Delivered modules

| File | Role |
|------|------|
| `src/lib/projection/types.ts` | Projection assessment types + DTO |
| `src/lib/projection/surgeryDayProjectedOutcome.ts` | `buildSurgeryDayProjectedOutcome` |
| `src/lib/projection/surgeryDayProjectionRules.ts` | Domain eligibility + deterministic text |
| `src/lib/projection/surgeryDayProjectionConfidence.ts` | Independent projection confidence |
| `src/lib/projection/surgeryDayProjectionSafety.ts` | Forbidden/allowed language + fail-closed validation |
| `src/lib/projection/index.ts` | Public exports |
| `tests/surgeryDayProjectedOutcome.test.ts` | Contract, domains, confidence, boundaries, regression |
| `tests/surgeryDayProjectionSafety.test.ts` | Language safety |

No migration. Output is **derived** (not persisted). Persistence/lineage deferred to 1D.

---

## What cannot yet be determined

Standard section (for eventual 1C prominence):

- Actual graft survival  
- Final transplanted hair calibre  
- Final cosmetic density  
- Final hairline softness after maturation  
- Final donor appearance after healing  
- Mature scarring  
- Ultimate native-hair progression  
- Long-term cosmetic outcome  
- Actual month-6 or month-12 result  

---

## Tests

```text
pnpm exec tsx --test \
  tests/surgeryDayEvidence.test.ts \
  tests/surgeryDayProcedureReconstruction.test.ts \
  tests/surgeryDayProjectedOutcome.test.ts \
  tests/surgeryDayProjectionSafety.test.ts
→ 69 pass (1A + 1B)

pnpm exec tsx --test tests/patientPhotoSatisfaction.test.ts
→ 18 pass

pnpm exec tsx --test tests/patientReviewPathway.test.ts
→ pass

pnpm typecheck → pass
pnpm lint -- src/lib/projection tests/surgeryDayProjectedOutcome.test.ts tests/surgeryDayProjectionSafety.test.ts → pass
```

Covered: input contract; domain generation; native-hair gating; safety fail-closed; confidence independence; patient vs clinic graft provenance; GII separation; no baseline change claims; no mature donor claims; pathway/photo regression.

---

## Known limitations

- Deterministic wording only — no LLM paraphrase layer.  
- Domain eligibility depends on 1A feature presence; sparse 1A reconstructions yield few domains.  
- 1A may populate `clinicReportedCount` from patient `actualGraftCount`; 1B therefore keys graft wording off provenance entries.  
- No patient-facing presentation in 1B.

---

## Deferred items

| Item | Target |
|------|--------|
| Projection PDF / patient report UI | 1C |
| Persistence / assessment lineage | 1D |
| Longitudinal month-3/6/9/12 comparison | later |
| Generated future-result images | ImagingOS / later |
| Anatomical measurement / site detection | ImagingOS |
| Cohort-calibrated outcome modelling | FiOS later |

---

## No-PHI attestation

This milestone commits only TypeScript modules, unit tests with synthetic category strings / numeric fixtures, and this audit document. No patient images, case IDs from production, or PHI were exported or embedded.

---

## HA-PROJECTION-0 note

`docs/hairaudit/audits/HA-PROJECTION-0-foundation-audit.md` was already tracked on `main` prior to this milestone (present in commit history). No separate docs-only rollback commit was created here to avoid rewriting history.
