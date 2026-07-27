# HA-PROJECTION-1G — Longitudinal Projection Review

**Date:** 2026-07-27  
**Status:** GREEN  
**Scope:** Patient-facing longitudinal review presenting frozen HA-PROJECTION-1D projection, HA-PROJECTION-1E observation, and HA-PROJECTION-1F comparison  
**PHI:** None in this document, committed fixtures, or audit event bodies  

---

## Summary

HA-PROJECTION-1G is presentation only:

| Milestone | Question answered |
|-----------|-------------------|
| **1A** | What can HairAudit observe from surgery-day evidence? |
| **1B** | What projected characteristics follow from that reconstruction? |
| **1E** | What can HairAudit observe at this follow-up stage? |
| **1F** | How do frozen projected characteristics compare with frozen observed follow-up characteristics? |
| **1G** | How do we present that frozen lineage to the patient? |

1G does **not** re-run 1A/1B, derive new comparison statuses, invent success/accuracy scores, create cohort intelligence, surgeon benchmarking, graft survival inference, ImagingOS measurements, or generated future-result images.

---

## Canonical frozen inputs

The report accepts only:

1. `ProjectionSnapshot` (1D)  
2. `ProjectionObservationSnapshot` (1E)  
3. `ProjectionComparisonSnapshot` (1F)

Presentation DTO: `LongitudinalProjectionReviewReportModel`

Assessment / report mode: `longitudinal_projection_review`

Pipeline reuse:

```text
print route → report selector → HTML renderer → Playwright PDF → existing storage / access
```

No separate PDFKit architecture.

---

## Lineage validation

Fail closed before render when any of the following fail:

- `comparison.projectionSnapshotId === projection.id`
- `comparison.observationSnapshotId === observation.id`
- `observation.projectionSnapshotId === projection.id`
- case IDs match across all three
- patient IDs match across all three
- stage matches between comparison and observation
- `comparisonPayload` lineage matches snapshot identities

Mismatched inputs are **not** repaired by selecting latest records.

---

## Report structure (section order)

1. Report header  
2. Longitudinal review notice  
3. Follow-up stage + evidence confidence  
4. Original surgery-day projection summary  
5. Current observed follow-up summary  
6. Projected vs Observed — domain review  
7. Treatment-area context  
8. Donor review  
9. What is not yet assessable / insufficiently evidenced  
10. Follow-up timeline  
11. Next recommended capture point  
12. Clinical disclaimer  

Projected and observed text are never merged into one paragraph.

---

## Patient-facing status mapping

| Internal (1F) | Patient label |
|---------------|---------------|
| `consistent` | Broadly consistent |
| `partially_consistent` | Partially consistent |
| `divergent` | Different from original projection |
| `not_yet_assessable` | Not yet assessable |
| `insufficient_evidence` | More evidence needed |

Overall:

| Internal | Patient label |
|----------|---------------|
| `consistent` | Broadly consistent |
| `partially_consistent` | Mixed / partially consistent |
| `divergent` | Some characteristics differ from the original projection |
| `not_yet_assessable` | Too early for overall comparison |
| `insufficient_evidence` | More evidence needed for comparison |

Visual treatment uses neutral badges (`badge-neutral`, `badge-amber`, `badge-slate`, `badge-blue`, `badge-muted`). No green=success / red=failure scoring.

---

## Stage-aware behavior

- **Month 3:** early-stage + expected not-yet-assessable notices  
- **Month 6:** early-stage notice retained; partial comparisons expected  
- **Month 9 / 12:** mature comparison where evidence supports it  

Not-yet-assessable (timing) is separated from insufficient evidence (documentation).

---

## Confidence presentation

Three separate displays:

1. Projection Confidence (frozen 1B)  
2. Observation Confidence (frozen 1E)  
3. Comparison Confidence (presentation surface of frozen 1F domain confidences)

Not averaged. Not converted to %. Not combined into one outcome score.

Explanation copy:

> Confidence reflects evidence quality, completeness and stage suitability, not the probability of a successful outcome.

---

## Treatment-area context

Reuses `buildTreatmentAreaRows` from frozen 1A reconstruction on the 1D snapshot. Untreated crown is explained as scope, not failure.

---

## Image comparison

- Reuses existing signed print photo pipeline (`photosByCategory`)  
- Groups: Preoperative Baseline (optional), Surgery-Day Evidence, Follow-Up Evidence, matched side-by-side views  
- Labels: Surgery Day / Month N (not marketing before/after framing)  
- Caveat: lighting, angle, hair length, and styling can influence visual comparison; images are supporting evidence, not calibrated measurements  
- No density heat maps, graft dots, scalp segmentation overlays, or generated future images  

---

## Safety controls

Before render:

1. 1B projection safety on frozen projection texts  
2. 1E observation safety on frozen observation texts  
3. 1F comparison safety on frozen comparison texts  
4. 1G report-layer forbidden patterns on presentation dynamic copy  

Blocked examples: successful/failed transplant, better/worse than expected, on/off track, survival/accuracy %, success/failure scores, excellent/poor outcome, guaranteed result.

Allowed examples: Broadly consistent, Different from original projection, Not yet assessable, More evidence needed.

Explicit educational denials in the safety notice (e.g. “does not measure graft survival”) are intentional.

---

## Historical re-render

Supported via print query / PDF URL params:

- `assessmentType=longitudinal_projection_review`
- `projectionSnapshotId`
- `observationSnapshotId`
- `comparisonSnapshotId`

Or embedded frozen snapshots in report summary under `longitudinal_projection_review` / `longitudinalProjectionReview`.

Re-render reproduces the historical frozen result. No silent upgrade to latest projection/observation.

---

## Patient app / gateway note

No new FI-PATIENT-APP gateway API in this milestone.

Compatible future assessment shape:

```text
assessmentType: longitudinal_projection_review
metadata: { stage, overallComparison, reportAvailable, observedAt }
```

---

## PDF smoke fixtures

Synthetic HTML under `tmp/projection-1g-smoke/` (not committed; no PHI):

| Fixture | Intent |
|---------|--------|
| A month3 | mostly not-yet-assessable + early notice |
| B month6 | mixed / partial |
| C month12 | mature multi-domain |
| D month12 divergent | frozen divergent domain → “Different from original projection” |
| E insufficient | evidence-limited month 12 |
| F no donor | donor section absent / limited |
| G baseline-plus | preoperative baseline image group eligible |
| H surgery-day images | surgery-day + follow-up pairing |

---

## Visual inspection outcome

Inspected regenerated synthetic HTML:

- Hero clearly identifies Longitudinal Projection Review + Month X  
- Projected vs observed visually distinct (amber vs blue columns)  
- Comparison labels readable; divergent uses slate badge (not catastrophic red)  
- Month 3 not-yet-assessable reads as expected, not incomplete failure  
- Long rationale wraps; dual cards avoid overflow in smoke HTML  
- Disclaimer present; snapshot UUIDs absent from patient body  
- Timeline marks only captured stages; next review present  

**Visual inspection: PASS** (synthetic HTML). Playwright PDF binary smoke remains available through the existing print pipeline when tokens/cases exist.

---

## Tests

| File | Coverage |
|------|----------|
| `tests/longitudinalProjectionReview.test.ts` | Lineage, contract, stage, domain, status, confidence, images, smoke |
| `tests/longitudinalProjectionReviewSafety.test.ts` | Safety allow/deny |
| `tests/longitudinalProjectionReviewRouting.test.ts` | PDF URL + template + print wiring |

Regression: 1F comparison suites, 1E observation suites, 1C surgery-day projection report, PDF template normalization — GREEN.

---

## Verification

| Check | Result |
|-------|--------|
| `pnpm typecheck` | PASS |
| ESLint on 1G report modules | PASS |
| 1G focused tests | PASS (31) |
| 1E/1F/1C focused regression | PASS |
| Synthetic HTML smoke + visual inspection | PASS |

Repo-wide `pnpm lint` may retain pre-existing unrelated failures (e.g. `no-explicit-any` elsewhere in print route). `pnpm test` default script covers nexus/security subsets and remains separately verifiable.

---

## No-PHI attestation

No patient names, emails, real case IDs from production, image URLs from production storage, or clinical notes are committed. Tests use synthetic UUIDs and fixture reconstructions only. Smoke HTML uses `https://example.test/signed/...` placeholders.

---

## Known limitations

- Observation/comparison Supabase load path in print route is fail-closed when tables/IDs are absent; domain-first in-memory / embedded summary path is primary for 1G v1  
- Comparison confidence display surfaces frozen 1F domain confidences; it is not a new intelligence score  
- No patient dashboard UI beyond print/PDF HTML in this milestone  
- Inter-stage trend scoring is deferred  

---

## Deferred

- FiOS cohort analytics / Outcome Intelligence  
- Surgeon / clinic benchmarking  
- Projection accuracy %  
- Graft survival estimation  
- Generated future-result images  
- New ImagingOS measurements / registration  
- ML calibration  
- Dedicated patient gateway API (unless later required)

---

## Key files

| Path | Role |
|------|------|
| `src/lib/reports/longitudinalProjectionReview.ts` | DTO builder, lineage, mode guards |
| `src/lib/reports/longitudinalProjectionReviewSections.ts` | Labels, timeline, images, next review |
| `src/lib/reports/longitudinalProjectionReviewSafety.ts` | Report-layer + layered safety |
| `src/lib/reports/LongitudinalProjectionReviewHtml.tsx` | Patient HTML |
| `src/app/api/print/report/route.ts` | Template dispatch + frozen load |
| `src/lib/reports/pdfUrl.ts` | Historical snapshot query params |
| `src/lib/pdf/normalizeReportTemplateForPdf.ts` | `longitudinal-projection-review` → elite |
| `src/lib/projection/types.ts` | `longitudinal_projection_review` assessment |
