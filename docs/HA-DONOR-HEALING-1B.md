# HA-DONOR-HEALING-1B — Donor Review Orientation and Funnel Completion

**Date:** 2026-07-30  
**Status:** IMPLEMENTED  
**Scope:** Complete the donor-healing journey started in 1A with report-side orientation, clinician confirmation, evidence rules, provenance, and funnel closure events.

---

## Objective

Finish the path:

`Donor landing → intake → evidence → submission → structured review → report viewed`

without longitudinal comparison, image alignment, or donor heatmaps (those remain **1C**).

---

## Delivered

| Capability | Behaviour |
|------------|-----------|
| Deterministic orientation mapping | Six approved states only |
| Evidence sufficiency | Procedure date / months-since + donor rear/left/right views; single-photo certainty rejected |
| Stage-aware language | Narratives keyed by `under_3_months` / `3_months_or_more` / `unknown` |
| Direct-care escalation | Red-flag symptoms → `direct_clinical_assessment_recommended` + warning copy |
| Immutable provenance | `automated_preparation` → `clinician_confirmation` / `clinician_correction` with append-only history |
| Clinician controls | Auditor panel: Prepare / Confirm / Correct |
| Funnel events | `donor_case_submitted` at successful `/api/submit`; `donor_report_viewed` at authenticated patient report view |
| Duplicate prevention | `sessionStorage` keyed once per case + event |
| Funnel dimension | Always `entry_context=donor_healing` via `donorHealingAnalyticsMeta` |

---

## Patient-facing orientation labels (only)

- Appearance broadly compatible with the reported healing stage
- Too early to assess long-term donor uniformity
- Temporary donor shedding may be contributing
- Persistent donor irregularity deserves structured review
- Direct clinical assessment is recommended
- The available photographs are insufficient to assess this reliably

## Never rendered (patient outputs)

- “normal donor confirmed”
- “overharvested confirmed” / “overharvesting confirmed”
- infection diagnosis / confirmation
- safe remaining graft estimates / capacity
- certainty based on one photograph

---

## Storage

`reports.summary.donor_healing_orientation` — full record including evidence + provenance (auditor ids internal).

`post_surgery_audit_report.donorHealingOrientation` — patient-safe slice only (no actor ids).

---

## Module map

| Path | Role |
|------|------|
| `src/lib/patient/donorHealingOrientationReport.ts` | Mapping, evidence, stage language, provenance |
| `src/lib/analytics/donorFunnelEvents.ts` | Deduped funnel emission |
| `src/app/api/auditor/donor-healing-orientation/route.ts` | Confirm / correct / prepare |
| `src/components/auditor/DonorHealingOrientationReviewPanel.tsx` | Auditor UI |
| `src/components/patient/DonorHealingOrientationSection.tsx` | Patient report block |
| `src/components/patient/DonorReportViewedTracker.tsx` | Report-viewed event |
| `src/lib/reports/postSurgeryAuditReport.ts` | Report integration |
| `src/app/cases/[caseId]/submit-button.tsx` | `donor_case_submitted` |
| `tests/donorHealing1b.test.ts` | Contract + forbidden-language proofs |

---

## Out of scope (1C+)

- Longitudinal donor photograph comparison
- Image alignment
- Donor heatmaps
- AI future-outcome images / automated extraction counts / capacity calculations

---

## Verification

```bash
pnpm exec tsx --test tests/donorHealing1b.test.ts
pnpm exec tsx --test tests/donorHealing1a.test.ts
pnpm typecheck
```
