# HairAudit dual-pathway E2E QA (HA-QA-E2E-2)

Browser-level Playwright coverage for the patient pre-surgery and post-surgery journeys using the 20 synthetic demo QA cases seeded by `npm run seed:demo-qa`.

## Prerequisites

1. **Local app** — Next.js dev server (started automatically unless `E2E_SKIP_WEB_SERVER=true`).
2. **Supabase env** — `.env.local` with:
   - `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY`
3. **Demo seed data** — run once per Supabase project:

```bash
npm run seed:demo-qa
```

This creates:

| Pathway | Demo users | Password |
|---------|------------|----------|
| Pre-surgery | `presurgery-demo-01@hairaudit.test` … `presurgery-demo-10@hairaudit.test` | `Demo-QA-Seed-2026!` |
| Post-surgery | `postsurgery-demo-01@hairaudit.test` … `postsurgery-demo-10@hairaudit.test` | `Demo-QA-Seed-2026!` |

4. **Playwright browsers** (first run only):

```bash
npx playwright install chromium
```

## Run

```bash
# Default: http://localhost:3000, starts dev server if not running
npm run test:e2e:hairaudit

# Reuse an already-running server
E2E_SKIP_WEB_SERVER=true npm run test:e2e:hairaudit

# Custom base URL (staging preview, etc.)
E2E_BASE_URL=https://your-preview.vercel.app E2E_SKIP_WEB_SERVER=true npm run test:e2e:hairaudit
```

## Production guard

Tests **refuse** production-like hosts (`hairaudit.com`, `hairaudit.vercel.app`) unless:

```bash
E2E_ALLOW_PRODUCTION=true npm run test:e2e:hairaudit
```

## Graceful skip

If Supabase admin env is missing or demo seed cases are not found, the global setup marks the suite to skip with a clear reason instead of failing opaquely.

## What is covered

| Area | Spec file | Notes |
|------|-----------|-------|
| Pre-surgery reports (×10) | `pre-surgery-reports.spec.ts` | Shell, scorecards, next steps, PDF link, no post-surgery leakage |
| Post-surgery reports (×10) | `post-surgery-reports.spec.ts` | Shell, scorecards, concerns/next steps, PDF link, no pre-surgery leakage |
| Homepage pathway chooser | `pathway-chooser.spec.ts` | Both CTAs; `pathway` posted to `/api/audit/start` |
| Upload evidence UI | `upload-evidence.spec.ts` | Pathway-specific packs, tier sections, non-blocking recommended/optional |
| Waiting timeline | `waiting-timeline.spec.ts` | Submitted case, live timeline, polling → ready |
| PDF / print smoke | `pdf-routes.spec.ts` | `/api/reports/:id/download` 200; `/api/print/report` `X-Report-Template` |
| Mobile layout | `mobile-reports.spec.ts` | Pixel 7 viewport, overflow + CTA visibility |

## Stable selectors (`data-testid`)

| ID | Component |
|----|-----------|
| `pathway-chooser` | `PatientPathwayChooser` |
| `start-pre-surgery-review` | `StartFreeAuditButton` (pre_surgery) |
| `start-post-surgery-audit` | `StartFreeAuditButton` (post_surgery) |
| `pre-surgery-report-shell` | `PreSurgeryPlanningReportShell` |
| `post-surgery-report-shell` | `PostSurgeryAuditReportShell` |
| `report-pdf-link` | `DownloadReport` |
| `patient-processing-timeline` | `PatientProcessingWaitingExperience` |
| `upload-evidence-pack` | `PhotoUploader` |
| `upload-required-section` | `PathwayEvidenceUploadSection` |
| `upload-recommended-section` | `PathwayEvidenceUploadSection` |
| `upload-optional-section` | `PathwayEvidenceUploadSection` |

## Related commands

```bash
npm run seed:demo-qa          # Seed / refresh 20 demo cases
npm run test:demo-qa-seed     # Unit tests for seed builders (no browser)
```
