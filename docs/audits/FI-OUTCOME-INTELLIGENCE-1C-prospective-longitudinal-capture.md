# FI-OUTCOME-INTELLIGENCE-1C — Prospective Longitudinal Capture Programme

**Status:** GREEN  
**Date:** 2026-07-27  
**Plan version:** `fi-outcome-capture-plan-v1`  
**Protocol version:** `fi-outcome-capture-protocol-v1`

## Objective

Operational capture orchestration that starts when a HairAudit surgery-day projection is frozen and creates a structured Month 3 / 6 / 9 / 12 evidence plan for future observed outcome capture.

Feeds existing lineage:

```
HA-PROJECTION-1D (frozen projection)
  → FI-OUTCOME-INTELLIGENCE-1C (capture plan)
  → Month 3/6/9/12 evidence capture
  → HA-PROJECTION-1E observation
  → HA-PROJECTION-1F comparison
  → HA-PROJECTION-1G patient review
```

Does **not** replace 1E/1F/1G, send reminders, materialize cohort rows, predict outcomes, score success, rank providers, estimate graft survival, or create a competing photo taxonomy.

## Architecture

| Layer | Role |
|-------|------|
| Identity | One capture plan per `projection_snapshot_id` + policy/protocol versions |
| Schedule | Calendar-month targets from frozen procedure date |
| Windows | Product timing windows (± days) — distinct from 1E stage provenance |
| Evidence | Reuses 1E `collectStageEvidence` / role resolution |
| Status | Server-derived at read time |
| Persistence | Minimal plan identity only; milestone state not stored |

## Projection lineage anchor

Preferred identity: **`projection_snapshot_id`**.

Not keyed only by patient, case, latest report, or latest projection. Superseded projections retain their historical plans; a new projection gets a separate plan.

## Milestone stages

Exactly: `month_3` | `month_6` | `month_9` | `month_12`.

No `month_18` (canonical HairAudit taxonomy not extended).

Patient labels: **3-Month / 6-Month / 9-Month / 12-Month HairAudit**.

## Target-date rules

UTC calendar-month arithmetic from canonical procedure date (`YYYY-MM-DD`):

| Stage | Target |
|-------|--------|
| month_3 | procedure + 3 months |
| month_6 | +6 months |
| month_9 | +9 months |
| month_12 | +12 months |

Month-end clamping (e.g. 31 Jan + 1 month → 28/29 Feb).

## Capture windows

Inclusive product timing windows (not biological guarantees):

| Stage | Radius |
|-------|--------|
| Month 3 | target ± 21 days |
| Month 6 | target ± 30 days |
| Month 9 | target ± 30 days |
| Month 12 | target ± 45 days |

Documented via `describeCaptureWindowPolicy()`. Distinct from 1E stage provenance windows (≈ 2–4.5 / 4.5–7.5 / 7.5–10.5 / 10.5–18 months).

## Status derivation

Server-derived with injected `now`:

| Status | Rule |
|--------|------|
| `observed` | Canonical 1E observation exists for projection + stage |
| `future` | now &lt; windowStart |
| `ready_for_review` | All **required** roles satisfied; no 1E observation (including late complete) |
| `missed` | now &gt; windowEnd and no adequate required evidence / observation |
| `evidence_incomplete` | Some evidence present; required still missing |
| `due` | Within window; no adequate required evidence |

Missed Month 6 does **not** block Month 9. Late evidence may still satisfy readiness; 1E decides exact-stage classification.

Internal `lateEvidencePresent` when evidence arrives after `windowEnd`.

Optional: `comparisonAvailable` / `reviewAvailable` — do not determine capture completion.

## Treatment-aware evidence policy

From frozen 1A/1B reconstruction treated zones:

**Required (v1 baseline):** `followup_front`, `followup_top`, `followup_recipient_closeup`

| Condition | Effect |
|-----------|--------|
| Crown treated | require `followup_crown` |
| Temples treated | require `followup_left` + `followup_right` |
| Donor concerns on reconstruction | require donor rear (+ close-up after Month 3) |

Otherwise crown / sides / donor remain **recommended** only.

Recommended views never block readiness.

## Capture protocol / guidance

Patient-safe photography guidance (dry hair, no fibres/concealers, even lighting, consistent distance/angles, no filters, scalp visible). No clinical promises or density predictions.

Reference-image metadata supported on `CaptureViewInstruction` (`referenceImageAvailable` / `referenceImageSource`) without registration UI.

Upload mapping reuses existing `postop_month{N}_*` / supported equivalents — no new storage namespaces.

## Evidence satisfaction

Uses HA-PROJECTION-1E `collectStageEvidence`. Month-banded aliases only satisfy their own stage. File presence alone is insufficient. 1E stage provenance rejection is respected.

## Patient next actions

Server-derived:

| Status | Action type |
|--------|-------------|
| future | `wait` |
| due | `upload_followup_images` |
| evidence_incomplete | `complete_followup_images` |
| ready_for_review | `wait_for_review` |
| observed | `view_review` |
| missed | upload still offered; wording: “Follow-up not yet completed” |

Patient DTO allowlists views as short public keys (`front`, `top`, …) with patient-safe labels. No case/patient/snapshot IDs, storage paths, or raw `followup_*` role strings in labels.

API: `GET /api/patient/cases/[caseId]/longitudinal-capture`

## Policy versioning

- Plan: `fi-outcome-capture-plan-v1`
- Protocol: `fi-outcome-capture-protocol-v1`

Historical meaning preserved by freezing **protocol version** on the plan and resolving requirements through versioned rules (not silently rewriting stored roles). Same projection + same versions → idempotent.

## Cohort-governance separation

Capture programme works when:

- `FI_OUTCOME_COHORT_ENABLED=false`
- `FI_OUTCOME_COHORT_GOVERNANCE_APPROVED=false`

Does not gate on analytics consent. Does not materialize `fi_outcome_longitudinal_cohort` rows.

## Security / ownership

- Persist table: `hairaudit_longitudinal_capture_plans`
- RLS on; anon denied; authenticated direct denied; service_role allowed
- Plan create/read validates projection exists, case match, patient ownership
- Patient identity server-resolved; client-supplied patientId not trusted for ownership

Migration applied remotely (project `vbzjkqhvzfunahmlxevb`).

## Persistence pattern

Minimal row: `id`, `projection_snapshot_id`, `case_id`, `patient_id`, `procedure_date`, `capture_policy_version`, `capture_protocol_version`, `created_at`.

Milestone state derived at read time.

## Tests

Focused suites (`pnpm test:outcome-capture-1c`):

- Schedule (targets, month-end, windows, injected now)
- Status + next actions
- Treatment-aware policy + evidence normalization
- Service: ownership, idempotency, fixtures A–F, missed independence, cohort separation, DTO safety, migration RLS SQL

Regressions GREEN: HA-PROJECTION 1D–1G, photo satisfaction, FI Outcome 1A/1B.

- `pnpm typecheck` PASS
- Touched-file lint PASS

## No-PHI attestation

Synthetic fixtures only. No real patient identifiers in tests or evidence. Patient DTO scans reject case/patient/snapshot IDs, storage paths, and raw role/storage keys.

## Deferred

- Reminder sending (email / SMS / push / WhatsApp / scheduled jobs) — future 1D reminder consumer
- Full patient capture UI polish
- Cohort analytics of planned-vs-captured coverage (1B may consume later)
- Capture-protocol-v2 from 1B priorities (must not silently mutate v1 plans)
- Patient-specific prediction, provider benchmarking, graft-survival estimation, ImagingOS measurements, ML calibration
