# FI-OUTCOME-INTELLIGENCE-1E — Guided Longitudinal Capture Experience

**Status:** GREEN  
**Date:** 2026-07-27  
**Feature flag:** `FI_LONGITUDINAL_CAPTURE_UI_ENABLED` (default false)

## Objective

Mobile-first patient capture experience for Month 3 / 6 / 9 / 12 HairAudit follow-up.

1E is **presentation + upload orchestration only**. It consumes canonical FI-OUTCOME-INTELLIGENCE-1C capture plan state and reuses existing patient upload infrastructure.

```
HA-PROJECTION-1D (frozen projection)
  → FI-OUTCOME-INTELLIGENCE-1C (capture plan + milestone state)
  → FI-OUTCOME-INTELLIGENCE-1E (guided patient capture UI)
  → existing patient upload API
  → canonical photo satisfaction / HA-PROJECTION-1E observation eligibility
  → 1C becomes ready_for_review
  → HA-PROJECTION-1E → 1F → 1G
```

1E does **not** decide milestone dates, required evidence, treatment scope, photo taxonomy, projection/observation/reminder logic, projected-vs-observed comparison, ImageOS measurements, density/graft survival, future-result images, cohort analytics, or provider benchmarking.

## Canonical 1C dependency

Guided DTOs are built only from hydrated `LongitudinalCapturePlan` milestones:

- stage / label / targetDate / windowStart / windowEnd
- status
- requiredEvidenceRoles / recommendedEvidenceRoles / presentEvidenceRoles
- nextAction (href updated to 1E routes)
- photography guidance (enriched for mobile, not rewritten as policy)

Server builder: `buildGuidedLongitudinalCaptureDto` / `buildGuidedCaptureLandingDto`.

Loader: `guidedCaptureLoad.server.ts` (ownership re-checked; projection + case patient IDs must match).

## Routes

Canonical case patient structure (no second navigation model):

| Route | Purpose |
|-------|---------|
| `/cases/[caseId]/patient/follow-up` | Timeline landing |
| `/cases/[caseId]/patient/follow-up/[stage]` | Guided wizard for one milestone |
| `/cases/[caseId]/patient/longitudinal-capture?stage=month_6` | Deep-link alias → follow-up stage |
| `GET /api/patient/cases/[caseId]/guided-capture?stage=` | Patient-safe guided DTO |
| `GET /api/patient/cases/[caseId]/guided-capture` | Landing DTO |
| Existing `GET .../longitudinal-capture` | Unchanged 1C plan DTO |

1C `deriveNextAction` hrefs for upload/complete/wait now point to `/cases/{id}/patient/follow-up/{stage}` so 1D reminders land in 1E.

## Patient-safe DTO

`GuidedLongitudinalCaptureDto` allowlists:

- stage, title, subtitle, dates, status, statusMessage
- progress (required vs recommended separately)
- views (public key, patient label, required/complete, instructions, signed reference/current URLs, server-selected `uploadCategory`)
- nextAction, photography guidance, notes
- policy/protocol versions, uiEnabled

Does **not** expose projectionSnapshotId, patientId, caseId as DTO fields, raw storage paths, or internal `followup_*` labels.

Safety: `assertPatientGuidedCaptureDtoSafe`.

## Required vs recommended

- Required views block finish / ready_for_review (via 1C).
- Recommended remain optional; skip CTA available; never combined into a single “required” counter.
- Patient copy: optional assessment help — no guilt language.

## Treatment-aware views

UI renders exactly the roles 1C provides. Crown / sides / donor appear only when 1C requires or recommends them. No hardcoded crown-for-everyone list in React.

## Capture guidance

- Global standardization (consistency, dry hair, no fibres/filters, even lighting, similar distance/style).
- Per-role concise bullets (Front / Top / Close-up / Donor / etc.).
- Representative capture note (avoid most-flattering-only selection).
- No calibrated / registered / measurement claims.

## Reference-assisted capture

`resolveReferenceImageForRole` priority:

1. prior same-family follow-up  
2. surgery-day equivalent  
3. preoperative equivalent  

Signed URLs only (10-minute). Copy: “Try to match this angle.” Current-stage uploads excluded from reference.

## Upload integration

- Reuses `uploadPatientPhotoFiles` → `POST /api/uploads/audit-photos` (existing guided wizard path).
- Categories from `roleToPostopCategoryHint` / `postop_month{N}_*` — no new taxonomy.
- Metadata: `captureWorkflow=longitudinal_followup`, stage, role key, referenceUsed, policy version, client timestamp.
- After success: refetch guided-capture API (canonical 1C wins).
- Replace: delete then re-upload when uploadId present.
- **Submitted-case unlock:** month-banded `postop_month*` always allowed; shared role categories require `capture_workflow=longitudinal_followup` (delete checks stored metadata).

## Resume / replace / milestone states

| Status | Entry behavior |
|--------|----------------|
| future | Opening date; guidance viewable; upload off unless early policy |
| due | “Ready” + Start photos |
| evidence_incomplete | Resume first missing required |
| ready_for_review | Complete screen; no upload pressure |
| observed | Review CTA when 1C provides href |
| missed | “Still available” + Add photos |

Finish does not create observations in the client — 1C readiness drives downstream.

## Security

- Auth + `requireCaseAccess` + `requirePatientCaseAccess`
- Projection ownership mismatch → 403
- Invalid stage / missing plan → 404 patient-safe messages
- Signed URLs via existing storage gate; no public bucket paths in DTO

## Accessibility / mobile

- Large touch targets (min ~48px CTAs)
- Focus-visible outlines
- Status icon + text (not colour alone)
- Progress `role="status"` / `aria-live`
- Alt text on reference/current images
- One primary capture action per view; library secondary
- Layout tuned for ~360–430px; desktop preserves same workflow

## Feature flag / rollout

`FI_LONGITUDINAL_CAPTURE_UI_ENABLED=true` enables pages.  
1C plan resolution remains independent.  
Staging → QA → pilot → broader release. Default off.

## Tests

```bash
pnpm test:outcome-capture-1e
pnpm test:outcome-capture-1c
pnpm test:outcome-engagement-1d
pnpm typecheck
```

Coverage includes: 1C consumption, status copy, wizard resume, required/recommended, reference priority, upload category allowance, forbidden language, DTO safety.

Playwright: `tests/e2e/hairaudit/guided-longitudinal-capture.spec.ts` (route smoke; full projection fixtures deferred for live upload scenarios A–H).

Visual QA: responsive fixture inspected at 375 / 430 / tablet / desktop layouts (`tmp/projection-1e-guided-capture-visual-qa.html`).

## Verification (this GREEN)

| Check | Result |
|-------|--------|
| `pnpm test:outcome-capture-1e` | PASS (28) |
| `pnpm test:outcome-capture-1c` | PASS |
| `pnpm test:outcome-engagement-1d` | PASS |
| patient photo satisfaction / upload route tests | PASS |
| `pnpm typecheck` | PASS |
| touched-file lint (1E libs + components) | PASS |
| `pnpm test` (repo default suite) | PASS |
| Visual QA browser inspection | PASS (layout fixture) |

## No-PHI attestation

Synthetic fixtures only. No real patient names, emails, phones, or clinical imagery in tests/docs.

## Deferred

- Full Playwright live scenarios A–H with synthetic projection fixtures
- Async FiOS/ImagingOS quality feedback soft surfaces (upload still succeeds without classifier)
- Wrong-view override policy UI beyond existing upload confidence messages
- Product analytics events (no safe analytics wiring assumed)
- Early-upload product policy (flagged off; future may enable with stage-validation note)
- External delivery / 1D channels (unchanged deferred)
- ImageOS anatomical measurements / generated future images / cohort / provider benchmarking
