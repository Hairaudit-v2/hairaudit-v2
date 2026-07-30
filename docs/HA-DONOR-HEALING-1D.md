# HA-DONOR-HEALING-1D — Donor Heatmaps and Zone Annotation

**Date:** 2026-07-30  
**Status:** IMPLEMENTED  
**Scope:** Clinician-painted qualitative donor zone overlays on rear / left / right photos, fixed anatomical zone taxonomy, clinician confirm gate, and a patient-safe schematic (no painted heatmap, no density claims).

---

## Objective

Let reviewing clinicians mark where visible irregularity appears on donor photographs and summarise that for discussion — without measuring density or claiming permanent depletion.

Does **not** automatically claim:

- follicle death
- permanent depletion
- exact density loss
- confirmed overharvesting
- future safe graft capacity

---

## Locked decisions

| Decision | Choice |
|----------|--------|
| Heatmaps | Clinician-painted qualitative intensity overlays (not CV density maps) |
| Geometry | Normalised 0–1 polygons (reuse pre-surgery validation helpers; separate storage domain) |
| Storage | `reports.summary.donor_zone_annotation` |
| Patient surface | Schematic + plain-language zone notes only after clinician confirm/correct |
| Domain | Separate from pre-surgery `hairaudit_pre_surgery_annotations` and HA-PROJECTION |

---

## Zone taxonomy

| Zone id | Label |
|---------|--------|
| `occipital` | Occipital (rear central) |
| `parietal_left` | Left parietal |
| `parietal_right` | Right parietal |
| `temporal_left` | Left temporal |
| `temporal_right` | Right temporal |
| `nuchal` | Nuchal / lower border |
| `custom` | Custom region (requires note) |

## Intensity bands

| Intensity | Patient-safe label |
|-----------|-------------------|
| `broadly_even_appearance` | Appearance looks broadly even in this zone |
| `mild_visible_irregularity` | Mild visible irregularity in this zone |
| `moderate_visible_irregularity` | Moderate visible irregularity in this zone |
| `marked_visible_irregularity` | Marked visible irregularity in this zone |
| `not_assessable` | This zone cannot be assessed reliably from the photograph |

---

## Storage & provenance

Full record on `reports.summary.donor_zone_annotation`:

- `annotations[]` with upload/view/zone/intensity/geometry
- Derived `heatmapSummaries[]` (rollup, not pixel grids)
- Append-only `provenance.history`
- Immutable `snapshots[]` on confirm/correct

Patient-safe slice on `post_surgery_audit_report.donorZoneAnnotation` — only when clinician-reviewed.

---

## Module map

| Path | Role |
|------|------|
| `src/lib/patient/donorZoneAnnotation.ts` | Zones, intensity, rollup, provenance, patient-safe slice |
| `src/app/api/auditor/donor-zone-annotation/route.ts` | Prepare / Confirm / Correct / Upsert / Delete |
| `src/components/auditor/DonorZoneOverlayCanvas.tsx` | SVG draw/edit overlay |
| `src/components/auditor/DonorZoneAnnotationReviewPanel.tsx` | Auditor UI |
| `src/components/patient/DonorZoneAnnotationSection.tsx` | Patient schematic |
| `src/lib/reports/postSurgeryAuditReport.ts` | Report integration |
| `tests/donorHealing1d.test.ts` | Contract + safety proofs |

---

## Out of scope (later)

- **1E** Future donor-capacity planning using clinical measurements — see `docs/HA-DONOR-HEALING-1E.md`
- **1F** Donor content cluster and conversion optimisation
- **1G** Clinic-facing longitudinal donor monitoring inside FiOS
- Automated CV heatmaps, follicle counts, density %, geometric registration across timepoints

---

## Verification

```bash
pnpm exec tsx --test tests/donorHealing1d.test.ts
pnpm exec tsx --test tests/donorHealing1c.test.ts
pnpm typecheck
```
