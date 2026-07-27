# FI-OUTCOME-INTELLIGENCE-1F — Longitudinal E2E Fixture & Journey Validation

**Status:** AMBER  
**Date:** 2026-07-28  
**Scope:** Validation infrastructure only — no new clinical / projection / capture / reminder / comparison logic.

## Status note

**GREEN** for fixture architecture, production guards, synthetic assets, canonical service reuse, unit/integration suite (`pnpm test:outcome-e2e-1f` — 17/17), DB seed/cleanup CLI (10 fixtures seeded successfully into Supabase), and Playwright specs/page objects.

**AMBER** for live browser journeys in this workspace: password auth via Supabase admin/API succeeds, but the Next.js login → dashboard path bounces back to `/login` (SSR session cookie not accepted). The same bounce affects general local E2E login, not only longitudinal fixtures. Re-run `pnpm longitudinal-e2e:test:smoke` once local patient login reaches `/dashboard` or `/cases` successfully.

## Objective

Prove a synthetic patient can move through:

```
HA-PROJECTION-1D freeze
  → FI-OUTCOME-INTELLIGENCE-1C capture plan
  → FI-OUTCOME-INTELLIGENCE-1D reminder / deep-link (optional)
  → FI-OUTCOME-INTELLIGENCE-1E guided upload
  → HA-PROJECTION-1E observation
  → HA-PROJECTION-1F comparison
  → HA-PROJECTION-1G longitudinal review
```

…without hidden manual repair, using deterministic synthetic fixtures.

## Fixture strategy

| Layer | Location | Role |
|-------|----------|------|
| Manifest | `tests/fixtures/longitudinalE2e/manifest.ts` | Scenario matrix (keys, stages, modes, treated zones) |
| In-memory builder | `seedLongitudinalProjectionFixture` | Unit/integration; canonical services only |
| DB seed | `seedLongitudinalE2eFixtureToDatabase` | Browser E2E against Supabase |
| Cleanup | `cleanupLongitudinalE2eFixtures` | Namespace-only delete |
| Advance helper | `advanceFixtureToObservedComparison` | Full-loop 1E→1F after UI ready |

### Fixture namespace

- Prefix: `FI-OI-1F-`
- `external_case_id`: `FI-OI-1F:{KEY}` (e.g. `FI-OI-1F:FRONTAL`)
- Emails: `e2e-fi-oi-1f-{slug}@hairaudit.test`
- Password: `Longitudinal-E2E-2026!`
- Cases marked `is_test: true`

Resolution uses `external_case_id` / fixture key — not display name alone.

## Production guard

Seed/cleanup require:

```bash
FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true
```

Production (`NODE_ENV=production`) additionally requires:

```bash
LONGITUDINAL_E2E_ALLOW_PRODUCTION=true
```

Fail closed otherwise.

## Synthetic assets

Generated under `tests/e2e/fixtures/images/longitudinal/`:

front, top, left, right, recipient_closeup, crown, donor_rear, donor_closeup

Valid JPEGs (1000×1000) via `sharp`. No clinical meaning. No production imagery.

## Canonical service reuse

| Step | Service |
|------|---------|
| Freeze | `createProjectionSnapshotService` + surgery-day fixtures A/B |
| Capture plan | `createLongitudinalCapturePlanService` |
| Reminder | `createLongitudinalEngagementService.decideForMilestone` / `revalidateBeforeDelivery` |
| Observation | `buildLongitudinalOutcomeObservation` + `createProjectionObservationService` |
| Comparison | `createProjectionComparisonService` |
| Review | `buildLongitudinalProjectionReviewReport` / print route |

## Fixture modes

- `seed-to-due`
- `seed-to-incomplete`
- `seed-to-ready`
- `seed-to-observed`

## Scenario matrix

| Key | Scenario |
|-----|----------|
| FRONTAL | A — frontal Month 6 due |
| CROWN | B — crown required / incomplete |
| RECOMMENDED-SKIP | C — required complete, donor recommended absent |
| RESUME | D — resume at recipient close-up |
| REPLACE | E — replace front |
| MISSED-M6 | F — M6 missed, M9 due |
| BASELINE-PLUS | G — baseline-aware observed |
| SURGERY-ONLY | H — surgery-day-only observed |
| REMINDER | I — engagement deep-link |
| STALE-REMINDER | J — revalidation suppress |
| FULL-LOOP | K — ready → obs → cmp → review |
| ISOLATION-A/B | Cross-patient deny |
| HISTORICAL | Supersession lineage |

## Commands

```bash
# Unit / integration (no DB)
pnpm test:outcome-e2e-1f

# Seed (requires Supabase admin + guard flag)
FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true pnpm longitudinal-e2e:seed

# Optional subset
FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true pnpm longitudinal-e2e:seed -- --keys=FRONTAL,RESUME,ISOLATION-A,ISOLATION-B

# Browser (app needs FI_LONGITUDINAL_CAPTURE_UI_ENABLED=true)
pnpm longitudinal-e2e:test:smoke   # PR smoke
pnpm longitudinal-e2e:test         # smoke + extended + mobile

# Reset / cleanup (namespace only)
FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true pnpm longitudinal-e2e:reset
FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true pnpm longitudinal-e2e:cleanup
```

Catalog written to `tmp/longitudinal-e2e-catalog.json`.

## Playwright routes

- `/cases/[caseId]/patient/follow-up`
- `/cases/[caseId]/patient/follow-up/[stage]`
- `GET /api/patient/cases/[caseId]/guided-capture?stage=`
- Upload via existing patient upload helpers
- 1G HTML: `/api/print/report?...&assessmentType=longitudinal_projection_review&projectionSnapshotId=&observationSnapshotId=&comparisonSnapshotId=`

Page objects: `LongitudinalLandingPage`, `GuidedCapturePage`, `LongitudinalReviewPage`.

## Mobile / browser coverage

- Mobile: `longitudinal-journey-mobile.spec.ts` @ 375×812 (+ Pixel 7 project match)
- Desktop: chromium smoke + extended
- Tags in describe titles: `@longitudinal` `@patient` `@projection` `@smoke` `@extended`

## Async handling

- `expect.poll` on guided-capture API — no arbitrary long `waitForTimeout`
- Bounded timeouts (45s upload / poll)

## No live AI dependency

E2E does not call OpenAI/ImagingOS. Observation/comparison use deterministic domain builders. Classifier not required for synthetic JPEG acceptance on upload path used by guided capture.

## CI tiering

| Tier | Specs |
|------|-------|
| Always (unit) | `pnpm test:outcome-e2e-1f` |
| PR smoke | `longitudinal-journey.spec.ts` + mobile |
| Extended / nightly | `longitudinal-journey-extended.spec.ts` (crown, skip, missed, reminder, replace, full-loop) |

No in-repo GitHub/GitLab E2E workflow yet — follow local `docs/hairaudit-e2e-qa.md` pattern. Documented for when CI wires Playwright.

## Required app env for browser

```
FI_LONGITUDINAL_CAPTURE_UI_ENABLED=true
FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true   # seed only
REPORT_RENDER_TOKEN / render secret         # 1G print route
```

## Full-loop proof

1. Seed `FULL-LOOP` to ready (or due + browser upload)
2. Browser confirms `ready_for_review`
3. `advanceFixtureToObservedComparison` via canonical services
4. Assert `observation.projectionSnapshotId` / comparison lineage
5. Open 1G print HTML — assert Projected / Observed / Comparison; assert absence of success/growth/survival/accuracy language

## Cross-patient isolation

Patient A cannot load Patient B landing / guided API (403/404/redirect away from B UI).

## Historical lineage

In-memory: P1/O1/C1 remain after P2 supersession; review rebuilds from frozen P1.

## Visual QA

Mobile viewport assertions on CTA/progress bounding boxes. Full interactive visual pass requires seeded DB + `FI_LONGITUDINAL_CAPTURE_UI_ENABLED` and running Playwright mobile + full-loop specs.

## No-PHI attestation

Synthetic names/emails/images only. No production patient clone. Fixture keys acceptable in logs.

## Test results (unit)

| Suite | Result |
|-------|--------|
| `pnpm test:outcome-e2e-1f` | PASS (17) |
| `pnpm test:outcome-capture-1c` | PASS |
| `pnpm test:outcome-engagement-1d` | PASS |
| `pnpm test:outcome-capture-1e` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` (default) | PASS |
| `pnpm longitudinal-e2e:seed` (10 keys) | PASS (catalog written) |
| Playwright smoke (this machine) | BLOCKED — login SSR cookie bounce |

## Remaining limitations

- Live browser GREEN blocked here by local auth session cookie bounce after successful API sign-in (environment / SSR cookie wiring). Fixture seed + unit proofs are complete.
- External delivery adapters still deferred (1D) — stale reminder proven at service revalidation layer
- Capture-plan production scanner not required for fixture seed
- PDF generation left to existing 1G tests; browser asserts HTML print route
- No schema migration — uses `external_case_id` + metadata
- Policy v2 fixture not introduced (architecture has v1 only); historical v1 identity asserted
- Windows TLS inspection may require `DEMO_SEED_INSECURE_TLS=true` for seed scripts

## Deferred (out of scope)

Patient predictions, provider benchmarking, graft-survival estimation, ImagingOS measurements, generated future-result images, ML calibration, new clinical intelligence.
