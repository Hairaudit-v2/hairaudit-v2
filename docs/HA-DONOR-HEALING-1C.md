# HA-DONOR-HEALING-1C — Longitudinal Donor Comparison

**Date:** 2026-07-30  
**Status:** IMPLEMENTED  
**Scope:** Compare two or more dated donor photo sets via view pairing (rear / left / right), record comparability limits, clinician-gate patient conclusions, and integrate into the post-surgery donor report section.

---

## Objective

Allow HairAudit to describe **visible change across comparable photographs** rather than judging isolated donor images.

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
| Alignment | View pairing only (`rear↔rear`, `left↔left`, `right↔right`) — no geometric registration |
| Storage | `reports.summary.donor_longitudinal_comparison` (JSON, same pattern as 1B) |
| Zones | Coarse per-view change (rear / left / right); pixel heatmaps deferred to **1D** |
| Patient gate | Only `clinician_confirmation` / `clinician_correction` appear in patient/PDF output |
| Domain | Separate from HA-PROJECTION and FI-OUTCOME longitudinal stacks |

---

## Comparison states

| State | Patient-safe label |
|-------|-------------------|
| `improving_appearance` | Visible appearance looks improved across comparable photos |
| `broadly_stable` | Visible appearance looks broadly stable across comparable photos |
| `persistent_irregularity` | Persistent irregularity remains visible across comparable photos |
| `increased_visible_patchiness` | Patchiness looks more noticeable across comparable photos |
| `not_comparable` | The photographs are not comparable enough for a reliable longitudinal read |
| `insufficient_longitudinal_evidence` | There is not enough dated donor evidence for longitudinal comparison |

---

## Eligibility

- ≥2 dated donor sets with at least one shared view (prefer rear; left/right strengthen).
- Single photo / single set → `insufficient_longitudinal_evidence`.
- Material lighting / hair length / angle / distance mismatch → `not_comparable`.
- Automated draft may suggest a state from weak heuristics (e.g. patient appearance trend); auditor must confirm before patient surface.

---

## Storage & provenance

Full record on `reports.summary.donor_longitudinal_comparison`:

- `sets[]`, `pairs[]`, `comparability`, `overallState`, optional `viewStates`
- Append-only `provenance.history`
- Immutable `snapshots[]` frozen on confirm/correct (never mutate prior entries)

Patient-safe slice on `post_surgery_audit_report.donorLongitudinalComparison` — no actor ids; only when clinician-reviewed.

---

## Module map

| Path | Role |
|------|------|
| `src/lib/patient/donorLongitudinalComparison.ts` | Clustering, pairing, comparability, provenance, snapshots, patient-safe slice |
| `src/app/api/auditor/donor-longitudinal-comparison/route.ts` | Prepare / Confirm / Correct |
| `src/components/auditor/DonorLongitudinalComparisonReviewPanel.tsx` | Auditor UI |
| `src/components/patient/DonorLongitudinalComparisonSection.tsx` | Patient report block |
| `src/lib/reports/postSurgeryAuditReport.ts` | Report integration |
| `tests/donorHealing1c.test.ts` | Contract + safety proofs |

---

## Out of scope (later)

- **1D** Donor heatmaps and freeform zone annotation — see `docs/HA-DONOR-HEALING-1D.md`
- **1E** Future donor-capacity planning using clinical measurements (not photographs alone)
- **1F** Donor content cluster and conversion optimisation
- **1G** Clinic-facing longitudinal donor monitoring inside FiOS
- Automated geometric alignment, follicle counts, density % claims

---

## Verification

```bash
pnpm exec tsx --test tests/donorHealing1c.test.ts
pnpm exec tsx --test tests/donorHealing1b.test.ts
pnpm typecheck
```
