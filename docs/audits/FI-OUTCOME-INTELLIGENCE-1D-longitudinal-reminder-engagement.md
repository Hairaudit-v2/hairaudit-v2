# FI-OUTCOME-INTELLIGENCE-1D — Longitudinal Reminder & Engagement Engine

**Status:** GREEN  
**Date:** 2026-07-27  
**Policy version:** `fi-outcome-engagement-v1`

## Objective

Reminder / engagement decision engine that consumes canonical FI-OUTCOME-INTELLIGENCE-1C milestone state and produces safe, rate-limited, channel-agnostic follow-up events for Month 3 / 6 / 9 / 12 capture.

```
HA-PROJECTION-1D (frozen projection)
  → FI-OUTCOME-INTELLIGENCE-1C (canonical capture plan + milestone state)
  → FI-OUTCOME-INTELLIGENCE-1D (reminder / engagement decisions)
  → channel-neutral reminder events
  → existing notification delivery infrastructure (deferred)
  → patient returns to existing 1C capture flow
```

1D **consumes** 1C. 1D does **not** reinterpret schedule, evidence requirements, or clinical outcomes.

## Canonical 1C input

Required fields (from `LongitudinalCaptureMilestone` + plan identity):

| Field | Source |
|-------|--------|
| `projectionSnapshotId` | Capture plan |
| `stage` | Milestone |
| `targetDate` / `windowStart` / `windowEnd` | 1C schedule (not recomputed in 1D) |
| `status` | 1C derived status |
| `missingRequiredEvidenceRoles` | 1C evidence assessment |
| `observationSnapshotId` | 1C / 1E |
| `nextAction` | 1C `deriveNextAction` (href reused) |
| `capturePolicyVersion` / protocol | Plan freeze |
| `reviewAvailable` | 1C optional 1G signal |

Optional: `evidenceFirstPresentAt` for incomplete delay; when absent, delay anchors to `windowStart`.

## Event types

| Type | Intent |
|------|--------|
| `upcoming_window` | Gentle heads-up before window opens |
| `capture_due` | Window open; required evidence missing |
| `evidence_incomplete` | Partial evidence; required views remain |
| `ready_for_review` | Required complete; awaiting 1E (quiet; once) |
| `late_capture_recovery` | Window passed; non-punitive recovery |
| `review_available` | 1G viewable (completion; once) |

## Timing policy (`fi-outcome-engagement-v1`)

| Event | Timing |
|-------|--------|
| upcoming_window | 7 days before `windowStart` |
| capture_due | on/after `windowStart` when status=`due` |
| evidence_incomplete | 5 days after first partial (fallback: `windowStart`) |
| late_capture_recovery | +7 days after `windowEnd`; optional wave 2 at +21 |
| ready_for_review | once when status=`ready_for_review` |
| review_available | once when observed + `reviewAvailable` |

Documented via `describeEngagementTimingPolicy()`. Product-engagement timings only — not clinical timing.

## Cooldown / max reminders

- ≤ 1 longitudinal contact reminder per patient per **72 hours**
- ≤ **3** contact reminders per milestone before observation (`upcoming_window`, `capture_due`, `evidence_incomplete`, `ready_for_review`, `late_capture_recovery`)
- `review_available` is separate (once)
- Identical state does not resend during cooldown

## Dedupe

Deterministic key:

`projectionSnapshotId :: stage :: eventType :: policyVersion :: stateFingerprint`

Fingerprint includes milestone status, missing required count, review availability, recovery wave.

Identical decision replay returns existing event (unique constraint on `dedupe_key`).

Meaningful state change (e.g. `due` → `evidence_incomplete`) allows a new event type.

## Send-time revalidation

Before delivery, re-read canonical 1C state via `revalidateBeforeDelivery` / `revalidateReminderAgainstMilestone`.

Stale examples:

| Queued | Current | Result |
|--------|---------|--------|
| capture_due | ready_for_review | suppress `STATE_CHANGED` |
| evidence_incomplete | observed | suppress `MILESTONE_ALREADY_OBSERVED` |
| evidence_incomplete | missing count changed | suppress `STATE_CHANGED` (obsolete text) |
| review_available | review no longer viewable | suppress |

## Suppression codes

`MILESTONE_ALREADY_OBSERVED` · `REVIEW_ALREADY_VIEWABLE` · `STATE_CHANGED` · `COOLDOWN_ACTIVE` · `MAX_REMINDERS_REACHED` · `CHANNEL_NOT_ALLOWED` · `EVENT_EXPIRED` · `DUPLICATE` · `PATIENT_NOT_ELIGIBLE` · `INVALID_LINEAGE` · `FEATURE_DISABLED` · `HISTORICAL_BLAST_BLOCKED` · `NOT_YET_ELIGIBLE` · `NO_EVENT_TYPE`

## Patient messaging

Stable keys (no LLM; no free-text body persistence):

- `LONGITUDINAL_UPCOMING_WINDOW`
- `LONGITUDINAL_CAPTURE_DUE`
- `LONGITUDINAL_EVIDENCE_INCOMPLETE`
- `LONGITUDINAL_READY_FOR_REVIEW`
- `LONGITUDINAL_LATE_CAPTURE_RECOVERY`
- `LONGITUDINAL_REVIEW_AVAILABLE`

Non-punitive missed copy: “still available” — never deadline guilt / non-compliant / on-track / graft survival / growth %.

Missing counts / labels come only from canonical 1C `missingRequiredEvidenceRoles` → patient-safe labels.

## Channel abstraction

Core events are channel-neutral. No Twilio / SendGrid / WhatsApp in domain logic.

Delivery adapters translate `messageKey` + variables. **External delivery is deferred** in this milestone — stop at event persistence / pending status.

## Consent / quiet hours

**Gap:** No canonical patient communication-preference system for longitudinal reminders. Documented in `COMMUNICATION_PREFERENCE_GAP`. Default: **no new external sends** unless channel flags + adapter exist.

When preferences are supplied: respect `emailAllowed` / `smsAllowed` / `pushAllowed` / `transactionalAllowed`.

Quiet hours helper: **08:00–19:00** (patient offset if known; else UTC — same date convention as 1C). Not applied to external sends until adapters exist.

## Feature gating

| Flag | Default |
|------|---------|
| `FI_LONGITUDINAL_ENGAGEMENT_ENABLED` | false |
| `FI_LONGITUDINAL_EMAIL_ENABLED` | false |
| `FI_LONGITUDINAL_SMS_ENABLED` | false |
| `FI_LONGITUDINAL_PUSH_ENABLED` | false |
| `FI_LONGITUDINAL_PERSIST_EVENTS` | false |

Independent of `FI_OUTCOME_COHORT_ENABLED` / `FI_OUTCOME_COHORT_GOVERNANCE_APPROVED`.

## Dry-run / activation

```bash
pnpm longitudinal-engagement:run          # dry-run default
pnpm longitudinal-engagement:run --apply  # fails closed without enable + persist/channel
pnpm longitudinal-engagement:run --apply --historical-recovery
```

Historical blast blocked by default (`HISTORICAL_BLAST_BLOCKED` when plan created after window closed). Operator must pass `--historical-recovery`.

Daily Inngest cron scaffold: `longitudinalEngagementDailyScan` (12:00 UTC) — no-ops when feature disabled; plan scanner adapter pending.

## Security / RLS

Table: `hairaudit_longitudinal_engagement_events`

- RLS on
- anon: denied (REVOKE)
- authenticated direct: denied (REVOKE)
- service_role: allowed

Patient visibility only via safe DTO (`PatientLongitudinalEngagementDto`) — no event IDs, suppression codes, provider refs, or patient/case IDs in DTO fields.

Migration applied remotely (project `vbzjkqhvzfunahmlxevb`).

## Tests

`pnpm test:outcome-engagement-1d`

Coverage: eligibility A–G, timing, dedupe/cooldown/max, send-time revalidation, milestone independence, messaging safety, channels/flags, RLS SQL, fixtures A–I.

Regressions: 1C capture programme, HA-PROJECTION 1D–1G, FI Outcome 1A/1B remain GREEN (run separately).

## No-PHI attestation

Synthetic fixtures only. Aggregate operational logs (evaluated / created / suppressed / delivered / failed). No patient names, emails, or phones in engagement logs.

## Activation status

**Off by default.** Domain engine testable; external delivery deferred; CLI dry-run default; production apply fail-closed.

## Deferred

- Full external delivery adapters (email / SMS / push)
- Capture-plan production scanner wiring in CLI / Inngest batch
- Full patient capture UI polish
- Engagement A/B testing / behavioural scoring
- Patient-specific prediction, provider rankings, graft-survival estimation, ImagingOS measurements, ML calibration
- Cohort analytics governance (remains separate)
