# FI-OUTCOME-INTELLIGENCE-1B — Cohort Data Quality & Longitudinal Coverage Audit

**Status:** GREEN  
**Date:** 2026-07-27  
**Depends on:** FI-OUTCOME-INTELLIGENCE-1A (`fi-outcome-cohort-v1`)

## Objective

Internal, aggregate-only audit of the de-identified longitudinal cohort: coverage, evidence gaps, assessability vs timing, metadata missingness, and conservative calibration readiness. No modelling, predictions, rankings, accuracy %, or PHI.

## Source cohort

Operates only on `fi_outcome_longitudinal_cohort` domain rows (via `OutcomeCohortRepository`). Does not query patient/case/upload/raw 1D–1F payloads for metrics.

## Governance state

**NEEDS_POLICY_CONFIRMATION** (preserved from 1A).

- Does **not** set `FI_OUTCOME_COHORT_GOVERNANCE_APPROVED=true`
- Does **not** enable production materialization
- Technical audit readiness: GREEN
- Production cohort activation: `BLOCKED_PENDING_POLICY_CONFIRMATION`

## Unique-procedure denominator

All major coverage metrics use unique `cohort_procedure_key`, never domain-row count.

Example — Month 12 coverage:

```
proceduresWithStage(month_12) / uniqueProcedures(current lineage)
```

## Stage coverage formulas

For each of `month_3|6|9|12` (current lineage only):

| Field | Definition |
|-------|------------|
| `proceduresWithStage` | Unique procedures with ≥1 row at stage |
| `proportionOfCohort` | `proceduresWithStage / uniqueProcedures` (null if empty) |
| `proceduresWithAssessableDomain` | Unique procedures with ≥1 assessable domain status |
| `proceduresOnlyNotYetAssessable` | All stage rows are `not_yet_assessable` |
| `proceduresWithInsufficientEvidence` | Otherwise evidence-limited |
| `evidenceQuality` | Per-procedure max evidence band at stage |

Assessable statuses: `consistent` | `partially_consistent` | `divergent`.

Early-stage `not_yet_assessable` is a **timing** limitation, not an automatic data-quality failure.

## Follow-up data retention

Funnel counts (unique procedures): Day-0 lineage → Month 3 → 6 → 9 → 12.

Retention (labelled **follow-up data retention**, not patient/clinical retention):

```
month3→month6 = |month3 ∩ month6| / |month3|
```

(and similarly for 6→9, 9→12). Null when prior stage is empty.

## Assessability definitions

Separated explicitly:

- **A. Timing:** `not_yet_assessable`
- **B. Evidence:** `insufficient_evidence`
- **Assessable:** consistent / partially_consistent / divergent

Never mapped to accuracy/success/failure.

## Evidence-quality definitions

Bands `low|moderate|high` from 1A `evidenceCompletenessBand`. Per-procedure uses max band across current rows. Also reported by stage and as high-evidence share by stage.

Projection / observation / comparison confidence are kept **separate** (per-procedure worst band across current rows). Not averaged; not called “outcome confidence”.

## Baseline definition

Uses normalized 1A fields only:

- `baselineAvailable`
- `assessmentMode` ∈ `baseline_plus_surgery_day` | `surgery_day_only` | `unknown`

Does **not** infer baseline from raw `preop_*` category names.

## Suppression policy

`MIN_COHORT_SIZE = 10` (configurable).

**SafeDistribution strategy:**

1. Total unique procedures &lt; 10 → suppress entire distribution.
2. Categories with count &lt; 10 collapsed into `__other_suppressed__`.
3. If collapsed other &lt; 10 (would reveal small cells via total − large) → suppress **entire** distribution.
4. Never return under-threshold bucket counts.

**Zone counts:** overlapping features; individual zone counts &lt; 10 → `insufficient_cohort_size` without publishing the exact count.

**Domain status-by-stage:** unique procedures at stage×domain &lt; 10 → suppressed object.

## Calibration-readiness rules

| Status | Conservative criteria |
|--------|------------------------|
| `NOT_READY` | Empty / not populated / &lt;10 unique procedures |
| `FOUNDATION` | ≥10 procedures; some coverage; mature pool insufficient |
| `GROWING` | Month-12 ≥20 AND eligible ≥10 AND ≥2 domains at Month-12 |
| `REVIEW_FOR_CALIBRATION` | Month-12 ≥50 AND eligible ≥30 AND ≥3 domains AND high-evidence Month-12 share ≥0.4 AND unknown graft share ≤0.3 AND baseline share ≥0.5 |

`REVIEW_FOR_CALIBRATION` means statistical review may be appropriate — **not** ML-ready.

### Eligibility count

Unique Month-12 procedures with ≥1 assessable domain and moderate/high projection + observation + comparison confidence and moderate/high evidence completeness.

## Data-quality flags

Dataset flags only (not clinical):  
`EMPTY_COHORT`, `LOW_MONTH12_COVERAGE`, `LOW_BASELINE_COVERAGE`, `HIGH_INSUFFICIENT_EVIDENCE_RATE`, `HIGH_LOW_CONFIDENCE_RATE`, `ZONE_REPRESENTATION_IMBALANCE`, `PROCEDURE_METADATA_MISSINGNESS`, `INSUFFICIENT_MATURE_CASES`, `SCHEMA_VERSION_HETEROGENEITY`, `LINEAGE_INTEGRITY_ISSUE`.

## Version-drift / lineage health

Distributions of projection / observation / comparison / cohort schema versions (safe). Heterogeneity flagged when &gt;1 distinct version key exists. Lineage health checks missing checksums, invalid enums, missing schema versions, duplicate idempotency identities.

## Tenant scope

`deployment_local` — respects 1A provider-agnostic partition model. No provider dimensions.

## CLI

```
pnpm outcome-cohort:audit
pnpm outcome-cohort:audit --json
pnpm outcome-cohort:audit --json --write-artifact
```

Aggregate metrics only. Optional artifact: `tmp/outcome-cohort-data-quality-audit.json` (not committed).

Honest empty/not-enabled report when materialization remains gated and no local rows are wired.

## Test results

| Suite | Result |
|-------|--------|
| `pnpm test:outcome-cohort-1b` (15 tests) | PASS |
| `pnpm test:outcome-cohort` (1A, 20 tests) | PASS |
| HA-PROJECTION 1E/1F focused (38 tests) | PASS |
| `pnpm typecheck` | PASS |
| eslint touched outcome-intelligence / 1B tests / CLI | PASS |
| `pnpm outcome-cohort:audit` | PASS — governance NEEDS_POLICY_CONFIRMATION; materialization NOT ENABLED; 0 procedures |

## No-PHI attestation

Audit export sanitizer rejects serialized outputs containing patient/case IDs or cohort HMAC keys. CLI prints aggregates only.

## Deferred

- Patient reminders / prospective capture automation
- Predictions, nearest-neighbour, surgeon/clinic benchmarking
- Projection accuracy %, graft survival, treatment-effect analysis
- ML calibration
- Live staging/production repository adapters for audit CLI
