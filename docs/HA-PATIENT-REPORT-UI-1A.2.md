# HA-PATIENT-REPORT-UI-1A.2 — Donor PDF Parity

**Date:** 2026-07-30  
**Status:** GREEN  
**Parent:** [HA-PATIENT-REPORT-UI-1A](./HA-PATIENT-REPORT-UI-1A.md)  
**Prerequisite:** [HA-PATIENT-REPORT-UI-1A.1](./HA-PATIENT-REPORT-UI-1A.1.md) GREEN  
**Rollback boundary (pre-1A.2):** `59d76b4` — `feat(patient-report): unify donor report shell and validate seeded journeys`

---

## Why this exists

Patients could see a polished **web** donor report while the downloadable **Post-Surgery PDF HTML** lacked a dedicated donor orientation block. Web and PDF must not tell different stories.

---

## What shipped

| Surface | Behaviour |
|---------|-----------|
| PDF hero (donor cases) | Title **Post-Surgery Audit**, subtitle **Donor healing review…**, outcome band shows orientation label |
| Orientation block | Patient-safe title + narrative + optional direct-care escalation |
| Status strip | Healing stage, evidence suitability, next-step category |
| Limitations | Shared `DONOR_EVIDENCE_LIMITATIONS` (same copy as web adapter) |
| Findings / photos | Existing donor-area section + clinical evidence gallery (when signed URLs exist) |
| Next steps | Existing `recommendedNextSteps` (orientation-aware upstream) |
| Exclusions | No Prepare/Confirm/Correct, no actor IDs, no provenance history, no case UUID in title, no Report ID chrome on donor PDFs |
| Snapshot safety | Renders `PatientSafeDonorOrientationSlice` only — no remapping of orientation states |

### Key files

- `src/lib/reports/donorHealingPdfSection.ts` — donor PDF block
- `src/lib/reports/PostSurgeryAuditReportHtml.tsx` — mount when `report.donorHealingOrientation` set
- `src/lib/patientReport/donorPatientCopy.ts` — shared limitations / titles
- `src/app/api/print/report/route.ts` — passes `monthsSinceBand` for stage label
- `tests/patientReportUi1a2Pdf.test.ts` — text regression
- `scripts/patient-report-ui-1a2-pdf-visual-qa.ts` — HTML + screenshot smoke → `tmp/patient-report-ui-1a2-pdf/`

---

## Verification

```bash
pnpm exec tsx --test tests/patientReportUi1a2Pdf.test.ts
pnpm exec tsx --test tests/postSurgeryAuditPdf.test.ts
pnpm exec tsx scripts/patient-report-ui-1a2-pdf-visual-qa.ts
```

**Results (2026-07-30):** `patientReportUi1a2Pdf` **7/7 pass**.

---

## Acceptance checklist

- [x] PDF HTML renders patient-safe donor orientation title + narrative
- [x] Reported healing stage + evidence suitability
- [x] Direct-care warning when active
- [x] Donor findings (donor-area section) + photos when gallery supports them
- [x] Limitations + recommended next steps
- [x] No auditor controls, internal IDs, provenance history, diagnostic wording
- [x] Snapshot-safe rendering (patient-safe slice only)
- [x] PDF text + screenshot regression coverage
- [x] Docs

---

## Non-goals (unchanged)

- Snapshot storage contract rewrite
- Standard (non-donor) Post-Surgery **web** shell migration → **HA-PATIENT-REPORT-UI-1B**
- Clinician Prepare / Confirm / Correct API changes

---

## Next

**HA-PATIENT-REPORT-UI-1B — Standard Post-Surgery Audit Migration** onto the unified patient report shell (reuse proven header / summary / status / findings / gallery / limitations / next steps / disclosure / print).
