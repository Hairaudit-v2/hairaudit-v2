# HA-PRE-SURGERY-INTELLIGENCE-2A — Clinician-Assisted Image Analysis, Editable Graft Planning & Projected Outcome Images

**Date:** 2026-07-30  
**Status:** IMPLEMENTED (domain + persistence + professional workspace + stub projection provider)  
**Scope:** Extend Pre-Surgery Review with clinician-in-the-loop image review, annotations, observation correction, versioned graft plans, and illustrative pre-surgery projections  
**PHI:** Bounded audit metadata only; no protected image URLs or patient identifiers in logs  

---

## Product principle

AI proposes → clinician reviews → clinician corrects or confirms → system recalculates → clinician approves → projection is generated → patient sees an approved, bounded planning summary.

The clinician remains the final decision-maker. No autonomous diagnosis, surgical approval, or guaranteed-result language.

---

## PART A — Discovery (reuse)

| Existing foundation | Reuse decision |
|---------------------|----------------|
| HA-REPORT-4A `PreSurgeryPlanningReport` | Keep; do not replace patient report architecture |
| `patientReviewPathway` / photo keys | Map clinician roles ↔ canonical upload categories |
| FI unified image classifier metadata | Seed `originalAi*` fields; never overwrite |
| `upload_audit_corrections` pattern | Append-only image corrections with provenance |
| HA-PROJECTION-1D snapshot / checksum / service-role RLS | Mirror for graft plans + illustrative projections |
| HA-PROJECTION-1A–1G | **Do not conflate** — longitudinal projected-vs-observed remains separate |
| Norwood+crown graft heuristic in `preSurgeryPlanningReport` | Seed AI starting graft plan only |
| Signed URLs / case storage | Workspace preview only; never log signed URLs |

**Gap closed by 2A:** `/cases/[caseId]/professional/pre-surgery-review`, editable `PreSurgeryGraftPlan`, annotations, observation review, illustrative projection adapter.

---

## Module map

| Path | Role |
|------|------|
| `src/lib/preSurgeryIntelligence/*` | Domain types, validation, seed, comparison, projection adapter |
| `supabase/migrations/20260730120000_hairaudit_pre_surgery_intelligence.sql` | Additive tables + service-role RLS |
| `src/app/api/cases/[caseId]/pre-surgery-intelligence/**` | Clinician/auditor APIs |
| `src/app/cases/[caseId]/professional/pre-surgery-review` | Authorised workspace route |
| `src/components/professional/PreSurgeryIntelligenceWorkspace.tsx` | UI for Areas 1–8 |
| `tests/preSurgeryIntelligence2a.test.ts` | Domain regressions |

---

## Persistence

Tables (service-role only):

1. `hairaudit_pre_surgery_image_reviews` + `…_image_corrections`
2. `hairaudit_pre_surgery_annotations`
3. `hairaudit_pre_surgery_observations`
4. `hairaudit_pre_surgery_graft_plans` (versioned; supersession)
5. `hairaudit_pre_surgery_projections` (**not** `hairaudit_projection_snapshots`)
6. `hairaudit_pre_surgery_audit_events`

---

## Projection modes (patient-facing labels)

| Mode | Label |
|------|-------|
| `conservative` | Illustrative conservative projection |
| `planned` | Illustrative planned projection |
| `optimistic_within_approved_range` | Illustrative upper-range projection |

Derived from approved min / target / max only. Stub provider records a constrained artifact; ImagingOS / transform adapters implement `PreSurgeryProjectionProvider`.

---

## Safety gates

Projection generation requires:

- required pathway images present
- frontal/overhead source image approved for projection
- graft plan `status === approved`
- hairline or treatment area confirmed
- explicit clinician request

Forbidden patient labels: guaranteed, expected exact result, final result, guaranteed density, likely exact result.

Plan changes invalidate prior projections via graft plan id/version mismatch (`projectionInvalidatedByPlanChange`).

---

## Access

Auditors **or** case-assigned doctor/clinic. Patients cannot open the professional workspace.
