# HA-PROJECTION-1C — Patient Projected Result Report

**Date:** 2026-07-27  
**Status:** GREEN  
**Scope:** Patient-safe HTML/PDF presentation of canonical 1A reconstruction + 1B projected outcome  
**PHI:** None in this document, committed fixtures, or smoke artifacts  

---

## Summary

HA-PROJECTION-1C renders surgery-day projected results through the existing print → HTML → Playwright PDF stack. It consumes only `SurgeryDayProcedureReconstruction` (1A) and `SurgeryDayProjectedOutcome` (1B). No new projection engine, CV stack, persistence/lineage, or FI-PATIENT-APP API.

---

## Report mode

| Assessment type | Template |
|-----------------|----------|
| `surgery_day_projection` | `surgery-day-projection` → PDF header `elite` |
| `surgery_day_projection_with_baseline` | same template |

Selection precedence (patient audit mode):

1. Explicit `assessmentType` (query param or summary field)  
2. Existing pathway templates (`pre_surgery` / `post_surgery`)  
3. Elite fallback  

EliteReportHtml and surgery-evidence PDFKit are **not** used for projection.

---

## Canonical input contract

```text
Raw evidence
  ↓
1A buildSurgeryDayProcedureReconstruction(...)
  ↓
1B buildSurgeryDayProjectedOutcome(...)
  ↓
1C buildSurgeryDayProjectionReport({ reconstruction, projectedOutcome })
  ↓
renderSurgeryDayProjectionReportHtml(...)
  ↓
print route → Playwright PDF
```

- Report builder does **not** query uploads, storage, or forensic payloads.  
- Print route may resolve embedded 1A/1B from summary, or build 1A→1B on demand when `assessmentType` requests projection.  
- Insufficient reconstruction → `409 PROJECTION_NOT_READY` (fail closed; no empty/generic projection).

---

## Section order

1. Report header  
2. Projection safety notice  
3. Evidence & confidence  
4. Key surgery-day images (when signed URLs available)  
5. Procedure context  
6. What HairAudit Can Observe Today  
7. Treatment area summary  
8. Projected Cosmetic Characteristics  
9. Graft / procedure evidence  
10. Donor observations  
11. Expected biological timeline  
12. What Cannot Yet Be Determined  
13. Future HairAudit Comparison  
14. Recommended next steps  
15. Clinical disclaimer  

Empty optional sections are omitted cleanly.

---

## Safety banner wording

**Primary title:** HairAudit Surgery-Day Projection  

**Banner:**  
“Projected analysis based on surgery-day evidence — not an observed final result.”

**Baseline mode:**  
“Projection informed by preoperative baseline and surgery-day evidence.”

**Surgery-only mode:**  
“Projection based on surgery-day evidence only. No verified preoperative baseline was available.”

---

## Confidence display

- Reconstruction confidence and projection confidence shown as separate Low / Moderate / High labels  
- No percentages, stars, or /100 scores  
- Explanatory copy:  
  “Projection confidence reflects the completeness and quality of available evidence, not the probability of a successful transplant.”

---

## Observed vs projected separation

Each 1B `PatientSafeProjectedCharacteristic` renders three blocks:

- Observed  
- Projected Characteristic  
- Limitations / Confidence  

Observed reconstruction content is confined to “What HairAudit Can Observe Today”. Domains omitted by 1B remain omitted in 1C.

---

## Graft evidence presentation

- Clinic-reported, patient-reported, and image-derived (GII) values remain separate  
- Conflicts are noted and never averaged  
- Missing counts produce no fabricated numbers  
- No “HairAudit confirms N grafts” language

---

## Timeline policy

Educational biological timeline only (0–1 through 12–18 months). Not patient-specific. Includes “Individual timelines vary.”

Future comparison section describes Month 3/6/9/12 review intent without implementing lineage/persistence.

---

## Image security

Uses existing print `photosByCategory` signed/data-URL pipeline. No storage paths, bucket names, or permanent URLs exposed. No generated “future result” images.

---

## Report routing

| File | Role |
|------|------|
| `src/lib/reports/surgeryDayProjectionReport.ts` | Builder, routing helpers, fail-closed safety |
| `src/lib/reports/surgeryDayProjectionSections.ts` | Section helpers / patient-safe labels |
| `src/lib/reports/SurgeryDayProjectionReportHtml.tsx` | HTML template |
| `src/app/api/print/report/route.ts` | Template selection + 409 when not ready |
| `src/lib/pdf/normalizeReportTemplateForPdf.ts` | Maps `surgery-day-projection*` → `elite` |

---

## Tests

```text
pnpm exec tsx --test \
  tests/surgeryDayEvidence.test.ts \
  tests/surgeryDayProcedureReconstruction.test.ts \
  tests/surgeryDayProjectedOutcome.test.ts \
  tests/surgeryDayProjectionSafety.test.ts \
  tests/surgeryDayProjectionReport.test.ts \
  tests/pdfTemplateNormalization.test.ts \
  tests/preSurgeryPlanningReport.test.ts \
  tests/postSurgeryAuditReport.test.ts \
  tests/patientReportExperience.test.ts \
  tests/imageLimitedAuditOverride.test.ts
→ pass (all green)

pnpm typecheck → pass
pnpm exec eslint <1C sources> → pass
```

Coverage includes routing, data contract, sections, domain omission, graft separation, safety fail-closed, donor day-0 wording, and regression wiring.

---

## PDF smoke results

Synthetic fixtures (no PHI) rendered locally:

```text
pnpm exec tsx scripts/smokeSurgeryDayProjectionReport.ts
→ PASS
  HTML: tmp/projection-1c-smoke/fixture-A-projection.html
  PDF:  tmp/projection-1c-smoke/fixture-A-projection.pdf (~320 KB)
  PNG:  tmp/projection-1c-smoke/fixture-A-page1.png
```

Visual inspection (Fixture A page 1):

- HairAudit branding + title present  
- Projection banner visible and unmistakable  
- Reconstruction vs projection confidence distinct  
- Evidence role chips patient-friendly  
- Limitations listed  
- Images grouped without storage internals  
- No overflow suspected in DOM check  
- Disclaimer + “What Cannot Yet Be Determined” present in full HTML  

Smoke outputs under `tmp/` are **not** committed.

---

## Future patient-app mapping (not implemented in 1C)

When FI-PATIENT-APP assessment gateway lands, map:

| assessmentType | Report mode |
|----------------|-------------|
| `surgery_day_projection` | This template |
| `surgery_day_projection_with_baseline` | Same template |

Do not create a second projection result API in this milestone.

---

## Typecheck / lint / no-PHI attestation

- `pnpm typecheck` — pass  
- ESLint on 1C sources — pass  
- No patient images, production case IDs, or PHI committed  
- Fixtures use synthetic category strings and numeric placeholders only  

---

## Known limitations

- Projection report availability requires explicit `assessmentType` (query/summary); no automatic case-wide cutover  
- On-demand 1A/1B build in print route uses available summary metadata; full clinical-history enrichment may be incomplete until 1D persistence  
- Punch-size / fractional hairs-per-graft display depends on 1A procedure-context field resolution  
- Longitudinal Day0→Month12 comparison not implemented  

---

## Deferred to 1D / ImagingOS

- `projection_snapshot` / projected-outcome persistence  
- Immutable projection versions and Day0→Month12 lineage  
- Longitudinal observed-vs-projected comparison UI  
- Generated future-result imagery  
- ImagingOS anatomical measurements / site detection  
- Cohort-calibrated outcome modelling  
- New patient gateway APIs  
