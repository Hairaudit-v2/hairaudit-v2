# FI-OUTCOME-INTELLIGENCE-1A — De-identified Longitudinal Cohort Foundation

**Status:** GREEN  
**Date:** 2026-07-27  
**Schema:** `fi-outcome-cohort-v1`

## Objective

Create a derived, analytics-safe cohort layer from frozen HairAudit projection lineage (HA-PROJECTION-1D / 1E / 1F) without exposing PHI, mutating source records, or introducing success/accuracy/surgeon ranking semantics.

## Canonical source lineage

| Layer | Role | Consumed fields |
|-------|------|-----------------|
| HA-PROJECTION-1D | Immutable Day-0 projection snapshot | reconstruction + projected outcome + checksums + evidence summary |
| HA-PROJECTION-1E | Immutable month 3/6/9/12 observation | stage, evidence roles/confidence, checksum |
| HA-PROJECTION-1F | Immutable projected-vs-observed comparison | domain statuses, confidence, stage, checksums |

HairAudit source tables remain canonical. Cohort rows are derived only.

**Not consumed:** raw uploads, storage objects, patient reports, raw AI responses, prompts, clinician notes, free-text PHI, mutable current-state case records when frozen equivalents exist.

## Row grain

One row per:

`procedure (pseudonymous) × projection snapshot × follow-up observation × comparison domain`

Example: Pseudo-procedure / Month 12 / `frontal_framing` / `consistent`.

## De-identification

### Persisted (analytics-safe)

HMAC keys, source checksums/schema versions, stage, domain, comparison status (exact 1F enum), categorical confidence bands, assessment mode, baseline flag, procedure-type / graft / hairs-per-graft / punch-size bands, treated-zone booleans, donor evidence flag, evidence completeness band, current-lineage flag, row checksum, timestamps.

### Never persisted

`patient_id`, `case_id`, person/tenant patient IDs, name, email, phone, DOB, exact procedure/appointment dates, address/postcode, raw image URLs, storage paths, filenames, report IDs as source identifiers, clinician notes, patient free text, staff emails, narratives/rationales, `surgeon_id` / `clinic_id` / `doctor_id`.

Serialized-row scans reject prohibited keys (snake_case + camelCase).

## Pseudonymous identity

```
cohort_subject_key   = HMAC-SHA256(secret, "fi-outcome-patient-v1:{patientId}")
cohort_procedure_key = HMAC-SHA256(secret, "fi-outcome-procedure-v1:{caseId}")
cohort_partition_key = HMAC-SHA256(secret, "fi-outcome-partition-v1:hairaudit-deployment")
```

- Secret: `FI_OUTCOME_COHORT_HMAC_SECRET` (server-side only)
- Not plain SHA-256 of IDs
- Deterministic for idempotency
- Fail-closed when materialization enabled without secret

Content `row_checksum` hashes de-identified payload only (identity HMAC keys excluded from content hash domain).

## Normalized cohort features

### Graft count bands

| Band | Boundary |
|------|----------|
| `under_1500` | &lt; 1500 |
| `1500_2499` | 1500–2499 |
| `2500_3499` | 2500–3499 |
| `3500_4499` | 3500–4499 |
| `4500_plus` | ≥ 4500 |
| `unknown` | missing / invalid |

### Hairs-per-graft bands

`under_1_8` (&lt;1.8), `1_8_to_2_1` [1.8, 2.1), `2_1_to_2_4` [2.1, 2.4), `over_2_4` (≥2.4), `unknown`

### Punch-size bands (mm)

`under_0_8`, `0_8_to_0_89` [0.8, 0.9), `0_9_to_0_99` [0.9, 1.0), `1_0_plus` (≥1.0), `unknown`

### Zones

Canonical HairAudit vocabulary only: hairline, temples, frontal, forelock, mid_scalp, crown → booleans.

### Stages / statuses / domains / confidence

Reuse exact 1F / 1E vocabularies. No success/failure remapping. Confidence bands only: `low` | `moderate` | `high`.

### Evidence completeness

`low` | `moderate` | `high` from frozen baseline / surgery-day roles / follow-up roles / stage presence — not raw upload counts.

## Governance / feature gating

**Governance finding:** `NEEDS_POLICY_CONFIRMATION`

Repo basis documents FI as an analytics consumer architecturally, but no in-repo Terms/Privacy clause confirms de-identified longitudinal outcome product-improvement analytics.

Production materialization requires all of:

1. `FI_OUTCOME_COHORT_ENABLED=true`
2. `FI_OUTCOME_COHORT_HMAC_SECRET` set
3. `FI_OUTCOME_COHORT_GOVERNANCE_APPROVED=true`

Default enabled = false. Tests inject deterministic secret + explicit approval.

## Tenant strategy

**Deployment-local, provider-agnostic (1A).**

- No raw tenant / clinic / surgeon columns
- Single `cohort_partition_key` for HairAudit deployment isolation
- No silent cross-tenant pooling of identifiable tenant IDs
- Cross-deployment / cross-tenant FiOS pooling requires separate governance milestone

## Small-cell protection

- `MIN_COHORT_SIZE` default **10** (`FI_OUTCOME_COHORT_MIN_SIZE`)
- Cohort size = **unique `cohort_procedure_key`**, never domain-row count
- Aggregates below threshold return `insufficient_cohort_size`
- Filters re-apply the threshold

## Aggregate surfaces (internal only)

### `getCohortCoverageSummary()`

`totalCurrentProcedures`, `proceduresByStage`, `domainAssessabilityByStage`, `evidenceCompletenessDistribution`

### `getDomainComparisonDistribution({ stage, domain, filters? })`

When threshold met: counts + proportions for exact 1F statuses; assessable vs non-assessable (timing / evidence) split.

**Denominator:** unique procedures with a current-lineage row for selected stage + domain (after filters), including `not_yet_assessable` and `insufficient_evidence`.

Never labeled success rate / failure rate / accuracy rate.

### `getCohortHealthSummary()`

Coverage shares, evidence shares, current vs superseded row counts, `eligibleForFutureCalibrationCount`, `calibrationReadiness: FOUNDATION` (1A default; not auto-promoted by counts).

## Backfill

```
pnpm outcome-cohort:backfill --dry-run
pnpm outcome-cohort:backfill --apply
```

- Dry-run default
- Counts / gate codes only — no PHI logs
- Fail-closed without flags/secret/governance
- Idempotent materialization via unique key
- No source mutation
- Full live listing adapter remains operator-wired (`--comparison-ids` until service-role listing is connected)

## Security / RLS

Table: `fi_outcome_longitudinal_cohort` + `fi_outcome_cohort_events`

- RLS enabled
- `anon` / `authenticated`: REVOKE ALL
- `service_role`: GRANT ALL + policy
- Not exposed via Supabase client for patient/clinic UI

## Materialization trigger

Preferred: retryable downstream after 1F creation (not tightly coupled to 1F transaction success) + operator backfill. 1F remains independently successful.

## Test results

| Suite | Result |
|-------|--------|
| `pnpm test:outcome-cohort` (20 tests) | PASS |
| HA-PROJECTION 1E/1F focused regressions (50 tests) | PASS |
| `pnpm typecheck` | PASS |
| eslint touched outcome-intelligence files | PASS (0 errors) |
| `pnpm outcome-cohort:backfill --dry-run` | PASS (gate FEATURE_DISABLED; no PHI) |

## No-PHI attestation

Focused de-identification tests assert materialized JSON lacks raw case/patient IDs, contact fields, narratives, storage URLs, and prohibited key names. Migration creates no `patient_id` / `case_id` columns.

## Deferred intelligence work

- Patient-specific predictions / nearest-neighbour matching
- Surgeon / clinic rankings or technique superiority
- Medication / PRP / exosome effect analysis
- Projection accuracy % / graft-survival estimation
- ML training
- Patient-facing or clinic-report cohort claims
- Cross-tenant FiOS pooling without governance approval
- ImagingOS objective feature bands (schema reserved conceptually; no placeholders)
- Live Supabase persistence adapter for materialization service (in-memory + SQL schema ready)

## Files

- `src/lib/outcomeIntelligence/*`
- `supabase/migrations/20260727180000_fi_outcome_longitudinal_cohort.sql`
- `scripts/backfill-outcome-cohort.ts`
- `tests/outcomeCohort*.ts`
- `.env.example` (documented flags)
