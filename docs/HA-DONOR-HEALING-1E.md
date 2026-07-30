# HA-DONOR-HEALING-1E — Future Donor-Capacity Planning

**Date:** 2026-07-30  
**Status:** IMPLEMENTED  
**Scope:** Clinician-gated future donor-capacity planning from clinical measurements, with patient-facing qualitative planning bands only (no graft numbers). Patient self-reported graft/punch is supporting context only and never sufficient alone.

---

## Objective

Support discussion of future donor use when **clinical measurements** exist — without deriving remaining graft capacity from photographs.

Does **not** automatically claim:

- follicle death
- permanent depletion
- exact density loss
- confirmed overharvesting
- future safe graft capacity / remaining graft counts from photos

---

## Locked decisions (1A + 2C)

| Decision | Choice |
|----------|--------|
| Patient output | Qualitative bands only after clinician confirm/correct — **no graft numbers** |
| Patient self-report | Supporting context only; never satisfies the measurement gate alone |
| Primary sources | Doctor/clinic audit + clinical history; auditor may correct before confirm |
| Photos | Never derive capacity; photo `donorReserveRisk` stays appearance-only |
| Storage | `reports.summary.donor_capacity_plan` |

---

## Planning states (patient-safe)

| State | Patient label |
|-------|---------------|
| `insufficient_clinical_measurements` | There are not enough clinical measurements to plan future donor use yet |
| `discussion_with_clinic_recommended` | Future donor planning should be discussed with the treating clinic using clinical measurements |
| `limited_future_options_suggested` | Available measurements suggest future options may be limited — confirm with clinic |
| `further_measurement_recommended` | Additional clinical measurements (e.g. density mapping) are recommended before planning |
| `not_assessable` | Future donor capacity cannot be assessed from the materials available |

---

## Measurement gate

Qualifying sources: `doctor_audit` | `clinic_audit` | `clinical_history` | `auditor_entry`  
Non-qualifying alone: `patient_self_report` (+ any photo signal)

Need **≥2 qualifying** among: density cm² / trichoscopy density, grafts removed, punch size, estimated capacity (ordinal or numeric).

Photos + patient self-report alone → `insufficient_clinical_measurements`.

---

## Module map

| Path | Role |
|------|------|
| `src/lib/patient/donorCapacityPlan.ts` | Measurements, gate, states, provenance, patient-safe slice |
| `src/app/api/auditor/donor-capacity-plan/route.ts` | Prepare / Confirm / Correct / Upsert |
| `src/components/auditor/DonorCapacityPlanReviewPanel.tsx` | Auditor UI |
| `src/components/patient/DonorCapacityPlanSection.tsx` | Patient qualitative block |
| `src/lib/reports/postSurgeryAuditReport.ts` | Report integration |
| `tests/donorHealing1e.test.ts` | Contract + safety proofs |

---

## Out of scope (later)

- **1F** Donor content cluster and conversion optimisation
- **1G** Clinic-facing longitudinal donor monitoring inside FiOS
- Photo-derived remaining-graft calculators
- Publishing numeric remaining capacity to patients

---

## Verification

```bash
pnpm exec tsx --test tests/donorHealing1e.test.ts
pnpm exec tsx --test tests/donorHealing1d.test.ts
pnpm typecheck
```
