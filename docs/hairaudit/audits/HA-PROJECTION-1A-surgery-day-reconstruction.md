# HA-PROJECTION-1A — Surgery-Day Procedure Reconstruction Evidence

**Date:** 2026-07-27  
**Status:** GREEN  
**Scope:** Canonical derived reconstruction layer (no future-result claims, no Projection PDF)  
**PHI:** None in this document or committed fixtures  

---

## Summary

HA-PROJECTION-1A adds a deterministic builder that converts existing HairAudit surgery-day evidence into a structured, patient-safe **procedure reconstruction**. It answers what evidence exists, which areas appear treated, which procedural characteristics are observable, and reconstruction confidence — without predicting growth, survival, or final cosmetic outcome.

`PatientReviewPathway` remains `pre_surgery | post_surgery` only. Assessment classification is separate via `HairAuditAssessmentType` (1A implements the two surgery-day reconstruction values).

---

## Delivered modules

| File | Role |
|------|------|
| `src/lib/projection/types.ts` | Assessment types, roles, reconstruction object, ObservedFeature |
| `src/lib/projection/surgeryDayEvidence.ts` | Alias → role mapping, baseline provenance, sufficiency |
| `src/lib/projection/surgeryDayProcedureContext.ts` | Provenance-aware procedure metadata |
| `src/lib/projection/surgeryDayZones.ts` | Canonical RecipientZone normalization |
| `src/lib/projection/surgeryDayObservedFeatures.ts` | Forensic AI → ObservedFeature |
| `src/lib/projection/surgeryDayReconstructionSafety.ts` | No-future-result language guard |
| `src/lib/projection/surgeryDayProcedureReconstruction.ts` | `buildSurgeryDayProcedureReconstruction` |
| `src/lib/projection/index.ts` | Public exports |
| `tests/surgeryDayEvidence.test.ts` | Mapping + mode tests |
| `tests/surgeryDayProcedureReconstruction.test.ts` | Metadata, observations, safety, regression |

No migration. Output is **derived** (not persisted). Storage categories are not rewritten or moved.

---

## Accepted evidence aliases

Prefixes: `patient_photo:`, `doctor_photo:`, `clinic_photo:`, `surgery_photo:` (bare keys also accepted in tests).

| Role | Example aliases |
|------|-----------------|
| `surgery_day_recipient` | `day0_recipient`, `img_immediate_postop_recipient`, `postop_recipient`, `intraop` |
| `surgery_day_donor` | `day0_donor`, `day0_donor_*`, `img_immediate_postop_donor`, `postop_donor`, `extraction_progress` |
| `surgery_day_design` | `img_marking_design`, `hairline_design` |
| `surgery_day_site_creation` | `intraop_recipient_sites`, `img_site_creation` |
| `surgery_day_implantation` | `intraop_implantation`, `img_implantation_stage`, `implantation_progress` |
| `surgery_day_graft_evidence` | `graft_tray_*`, `graft_count_board`, `graft_quality`, `img_graft_*` |
| `preop_front` … `preop_donor` | Patient `preop_*`, clinic/doctor `img_preop_*`, surgery `preop_recipient` / `preop_donor` |
| Fallback only | `any_day0` → may satisfy recipient **only** when no explicit recipient role exists |

Full map: `listAcceptedCategoryAliases()` in `surgeryDayEvidence.ts`.

---

## Provenance rules / baseline eligibility

A baseline role is counted only when `baselineEligible === true`.

| Signal | Result |
|--------|--------|
| Clinic/doctor/surgery `*preop*` workflow slots | Eligible |
| Capture timestamp **before** `procedureDate` | Eligible |
| Metadata `phase` preoperative / explicit baseline provenance | Eligible |
| `pathway === pre_surgery` + patient `preop_*` | Eligible |
| `pathway === post_surgery` + patient `preop_*` without other proof | **Not eligible** (legacy “current” reuse) |
| `patient_current_*`, milestones, early postop | Never baseline |

Uncertain provenance → `baselineEligible = false` (never silent promotion).

---

## Reconstruction modes

| Mode | Assessment type | Gate |
|------|-----------------|------|
| `surgery_day_only` | `surgery_day_reconstruction` | Acceptable surgery-day recipient |
| `baseline_plus_surgery_day` | `surgery_day_reconstruction_with_baseline` | Recipient + ≥1 genuine baseline view |

Baseline completeness is tracked separately (`baselineRoleCount`). Intra-op images are high-value optional — absence does not fail reconstruction.

**Required:** `surgery_day_recipient`  
**Strongly recommended:** `surgery_day_donor`, `surgery_day_design`

---

## Metadata precedence

Actual graft count preference:

1. Clinic / surgery record (`actual_graft_count`, `actual_grafts`, …)  
2. Auditor-confirmed clinical history  
3. Patient reported  
4. AI estimate (GII) — kept in `graftEvidence.imageDerivedEstimate` only; never averaged into reported actual  

Conflicts are retained as limitations with provenance, e.g.  
`Clinic record reports 3,180 grafts; Patient intake reports 3,000.`

---

## Normalized zone vocabulary

```text
hairline | temples | frontal | forelock | mid_scalp | crown | other
```

Maps from `areas_treated`, `zones_planned`, clinical `recipient_zones` / `frontal_hairline`, and related AI wording. No Zone 1–4.

---

## Observed feature sources

| Source | Used in 1A |
|--------|------------|
| `forensic_ai` | Section evidence / key findings (sanitized) |
| `procedure_metadata` | Treated areas, counts |
| `rule` | Safe fallbacks, baseline comparison framing |
| `mixed` | Baseline treatment relationship |
| `auditor` | Reserved |
| `imagingos` | Reserved for future slot-in — **not produced in 1A** |

HA-INTELLIGENCE `rule_based_placeholder` / “Await ImagingOS” engines are **not** activated.

---

## Forbidden future-result language

Blocked (examples): will grow, expected/likely/predicted result, excellent/poor outcome, survival rate, growth percentage, should achieve, will look, projected/prediction (as claims).

Allowed exceptions include: “Final density cannot yet be determined”, “Final graft growth cannot be assessed…”, other “cannot yet be assessed/measured” phrasing.

Guard: `surgeryDayReconstructionSafety.ts` — applied when building reconstruction text.

Also prohibited as invented precision: exact grafts/cm², pixel site counts, exact hairline angle, predicted survival/density/cosmetic grade.

---

## Test results

```text
pnpm exec tsx --test tests/surgeryDayEvidence.test.ts tests/surgeryDayProcedureReconstruction.test.ts
→ pass (all 1A suites)

pnpm exec tsx --test tests/patientPhotoSatisfaction.test.ts tests/patientReviewPathway.test.ts
→ pass (regression GREEN)

pnpm exec tsc --noEmit → pass
pnpm exec eslint src/lib/projection/**/*.ts tests/surgeryDay*.test.ts → pass
```

---

## Known limitations

- Reconstruction is derived on demand; not stored on `reports` yet (sufficient for 1A; persistence deferred until lineage requires it).
- Patient `preop_*` on post-surgery pathway without capture/provenance is excluded from baseline — some genuine baselines may be under-counted until provenance is recorded.
- Forensic prose may be dropped if it fails the safety sanitizer; safe qualitative fallbacks are used.
- No patient-facing Projection PDF / report mode in 1A.
- No ImagingOS geometry, site detection, or outcome projection.

---

## No-PHI attestation

This milestone commits only TypeScript modules, unit tests with synthetic category strings / numeric fixtures, and this audit document. No patient images, case IDs from production, or PHI were exported or embedded.

---

## Deferred to 1B

- Bounded projected cosmetic outcome language  
- Patient Projection report / PDF mode  
- Future-month comparison against Day-0 reconstruction  
- ImagingOS feature injection (`source: "imagingos"`)  
- Persistence / assessment lineage graph  
- Remaining `HairAuditAssessmentType` values (`pre_surgery_planning`, `early_postop_assessment`, `post_surgery_outcome`) as first-class builders
