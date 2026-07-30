# HA-PATIENT-REPORT-UI-1B — Standard Post-Surgery Audit Migration

**Date:** 2026-07-30  
**Status:** GREEN (unit + lint + typecheck + production build + visual QA; Playwright seeded journeys authored, require demo-qa seed to execute)  
**Scope:** Migrate standard (non-donor) patient-facing Post-Surgery Audit reports onto `PatientReportShell`.  
**Does not change:** clinical assessment engines, scoring, evidence thresholds, donor orientation mapping, immutable snapshots, Pre-Surgery / projection / longitudinal reports.

---

## Objective

Extend the proven HA-PATIENT-REPORT-UI-1A donor shell architecture to ordinary Post-Surgery Audit cases so patients see one consistent report experience regardless of entry pathway.

---

## Rollback boundary

| Item | Value |
|------|-------|
| Required prior commit | `feat(patient-report): add donor orientation parity to PDF` |
| SHA | `792157a` / `792157ae220ff594b61aea5bc78cd2d8e20a3f59` |
| Prior commit message | `feat(patient-report): add donor orientation parity to PDF` |

1B changes are **not** included in that commit.

Verified on branch `main` at start of 1B: HEAD history includes `792157a` immediately before unrelated build fix `b02e76c`.

---

## Route inventory

| Kind | Route / surface | 1B behaviour |
|------|-----------------|--------------|
| Primary case report | `/cases/[caseId]` | `donorHealingEntryActive` → `DonorHealingPatientReport`; else → **`PostSurgeryPatientReport`** (new) |
| Patient reports index | `/dashboard/patient/reports` | List + download only (unchanged) |
| HTML viewer | `/reports/[caseId]/html` | Legacy score HTML (unchanged) |
| Print HTML | `/api/print/report` | Existing `renderPostSurgeryAuditReportHtml` retained |
| PDF download | `/api/reports/[reportId]/download` | Unchanged |
| Demo marketing | `/demo-report` | Marketing iframe — **not migrated** (follow-up) |
| Pre-surgery web | `PreSurgeryPlanningReportShell` | Out of scope |
| Auditor donor controls | Same case page, `isAuditor` | Professional workspace unchanged |

---

## Legacy component inventory

| Component | Status |
|-----------|--------|
| `PostSurgeryAuditReportShell` | **Deprecated** — no patient route mounts it; retained for rollback |
| `ClinicalEvidenceReviewGallery` (inside legacy shell) | Still used by PDF / legacy shell only |
| Pathway visual / confidence / scorecard grid in legacy shell | Migrated to collapsed supporting detail or omitted from primary viewport |
| `PatientSafeSummaryShell` | Still used when structured post-surgery report is null |

---

## Adapter architecture

```
donorHealingEntryActive === true
  → DonorHealingPatientReport
      → buildDonorHealingPatientReportViewModel
          → (missing orientation) buildPostSurgeryFallbackViewModel
              → buildPostSurgeryAuditPatientReportViewModel

donorHealingEntryActive === false
  → PostSurgeryPatientReport
      → buildPostSurgeryAuditPatientReportViewModel
          → PatientReportShell (reportType: "post_surgery")
```

Routing helpers (unit-tested):

- `resolvePatientPostSurgeryReportMount`
- `shouldMountDonorHealingPatientReport`
- `shouldMountStandardPostSurgeryPatientReport`

Normalization (pure, non-mutating):

- `normalizePostSurgeryReportSnapshot`
- `normalizePostSurgeryFindings`
- `normalizePostSurgeryPhotos`
- `normalizePostSurgeryTiming`
- `stripInternalIdsFromPatientText`

---

## Report contract usage

Reuses `PatientReportViewModel` / `PatientReportShell` without new clinical engines.

`reportType: "post_surgery"`  
Analytics: `{ reportType: "post_surgery", pathway: "post_surgery", entryContext: "post_surgery" }`  
`reportReference: null` (never case/report/snapshot UUIDs)

---

## Section mapping

Canonical order (`POST_SURGERY_SECTION_ORDER`):

1. orientation (summary + status strip)
2. what_this_means
3. findings (key findings)
4. photographs
5. recipient_area (when data present)
6. donor_area (standard findings — not six-state orientation)
7. density_coverage (when data present)
8. procedural_integrity (when data present)
9. healing_stage (timeline)
10. limitations
11. next_steps
12. supporting_detail (collapsed)
13. methodology (collapsed)

Empty sections are omitted.

---

## Legacy normalization

Supports missing procedure dates, partial photos, recipient-only / donor-only evidence, no scores, older snapshots without optional modules. Stored snapshots are never mutated on read.

---

## Donor routing preservation

- Donor entry cases still mount `DonorHealingPatientReport`.
- Standard adapter is never used as the mount for `donorHealingEntryActive`.
- Donor unit regression asserts `reportType: "donor_healing"` when orientation exists.
- Visual QA includes `donor-regression.png`.

---

## Professional separation

- Patient shell receives no Prepare / Confirm / Correct props.
- Auditor workspace remains on the case page for donor cases only (`professional-donor-orientation-workspace`).
- Legacy shell deprecated; professional modules were never moved into patient routes.

---

## Analytics map

| Event | When |
|-------|------|
| `donor_report_viewed` | Patient + donor entry (unchanged) |
| `patient_report_section_opened` | Disclosure expand |
| `patient_report_photo_expanded` | Gallery expand |
| `patient_report_download_clicked` / `_print_clicked` | Print actions |
| `patient_report_next_step_clicked` | Next steps |

Forbidden keys extended to include `report_id`, `patient_id`, `image_id`, `snapshot_id` (and camelCase variants).

---

## Privacy proof

- Unit: `findInternalIdLeaks` clean on standard VM
- Unit: analytics forbidden-key strip
- Unit: no professional control strings in VM
- `reportReference` always null

---

## Accessibility review

Shared shell already provides: one H1 via header, status strip not colour-only, keyboard nav, disclosures with aria-expanded, photo lightbox keyboard close, print-hidden nav. Standard reports inherit these behaviours.

---

## Responsive proof

Visual QA fixtures at 390px and 1440px. Playwright Journey E asserts no horizontal overflow on seeded cases (when catalog present).

---

## PDF decision

**Decision for 1B:** Keep existing standard Post-Surgery PDF / print HTML (`renderPostSurgeryAuditReportHtml`). It already mirrors outcome, findings, photos, limitations, and next steps.

**Tracked follow-up:** `HA-PATIENT-REPORT-UI-1B.1 — Standard Post-Surgery PDF Parity` — adapter-driven HTML hierarchy matching the new shell section order (same approach as 1A.2 donor PDF).

Existing PDF unit tests (`patientReportUi1a2Pdf.test.ts`, `postSurgeryAuditPdf.test.ts`) remain green for non-donor structure.

---

## Demo-report decision

`/demo-report` is a **marketing Clinical Intelligence Report Preview** (iframe of `/api/print/demo-report`), not a live case report and not wired to `PatientReportShell`.

**Decision:** Do not migrate in 1B (scope expansion). Document as follow-up if product wants the public demo on the shared shell with safe fixture data.

---

## Screenshots

Generated under `tmp/patient-report-ui-1b/`:

- `standard-post-surgery-desktop.png`
- `standard-post-surgery-mobile.png`
- `standard-post-surgery-photo-expanded.png`
- `standard-post-surgery-supporting-detail.png`
- `standard-post-surgery-early-stage.png`
- `standard-post-surgery-partial-evidence.png`
- `standard-post-surgery-legacy.png`
- `standard-post-surgery-print-preview.png`
- `standard-post-surgery-professional-separation.png`
- `donor-regression.png`

Script: `scripts/patient-report-ui-1b-visual-qa.ts`

---

## Fixture inventory

Reuses existing demo-qa scenarios:

| Fixture | Use |
|---------|-----|
| `post_01` strong outcome | Journey A mature |
| `post_02` moderate donor concerns | Journey D / donor irregularity without donor entry |
| `post_05` healing concern (`under_3`) | Journey B early-stage |
| `post_08` low concern | Journey C partial-friendly |
| Donor `orientation_confirmed` | Journey G / F regression |
| Donor `missing_orientation_fallback` | Fallback via donor mount |

No real patient data seeded.

---

## Unit results

```
pnpm exec tsx --test tests/patientReportUi1b.test.ts tests/patientReportUi1a.test.ts tests/patientReportUi1a2Pdf.test.ts
# tests 51
# pass 51
# fail 0
```

---

## Playwright results

Spec: `tests/e2e/hairaudit/patient-report-ui-1b.spec.ts` (Journeys A–J)

Requires:

```bash
pnpm run seed:demo-qa
# E2E_HAS_DEMO_CATALOG=true (+ donor catalog for G/F)
pnpm exec playwright test tests/e2e/hairaudit/patient-report-ui-1b.spec.ts
```

1A Journey D updated to expect `patient-report-shell` for standard post-surgery (no longer asserts legacy shell).

Seeded Playwright execution against a live catalog was not run in this agent session (catalog env not available). Specs are ready for CI / local seed verification.

---

## Lint result

```
pnpm exec eslint src/lib/patientReport src/components/patient-report/PostSurgeryPatientReport.tsx \
  src/components/patient/PostSurgeryAuditReportShell.tsx tests/patientReportUi1b.test.ts \
  tests/patientReportUi1a.test.ts tests/e2e/hairaudit/patient-report-ui-1b.spec.ts \
  tests/e2e/hairaudit/patient-report-ui-1a.spec.ts tests/e2e/helpers/demoQaCatalog.ts \
  scripts/patient-report-ui-1b-visual-qa.ts --max-warnings 0
# exit 0
```

---

## Typecheck result

```
pnpm exec tsc --noEmit -p tsconfig.json
# exit 0
```

---

## Production build result

```
pnpm run build
# Compiled successfully; exit 0
```

---

## Known risks

1. Legacy shell modules (pathway radar, assessment confidence, long-term / future-risk full sections) are collapsed or summarized — PDF still has fuller twins until 1B.1.
2. New shell copy is English-first (adapters); legacy i18n keys on `PostSurgeryAuditReportShell` are unused on the patient mount path.
3. Seeded Playwright must be run after `seed:demo-qa` before release confidence is complete.
4. Photo group IDs expanded (`recipient_area`, `supporting_comparison`) — donor triad grouping preserved.

---

## Rollback plan

1. Revert case-page branch: mount `PostSurgeryAuditReportShell` again when `!donorHealingEntryActive`.
2. Keep donor mount unchanged.
3. Boundary commit `792157a` remains the last known-good donor PDF parity point before 1B.

---

## Deprecated components

| Component | Decision |
|-----------|----------|
| `PostSurgeryAuditReportShell` | Deprecated; retain temporarily for rollback; remove in cleanup phase after seeded journeys + optional 1B.1 |

---

## Recommended cleanup / next phases

1. **HA-PATIENT-REPORT-UI-1B.1** — Standard Post-Surgery PDF parity via adapter.
2. **HA-PATIENT-REPORT-UI-1C** — Pre-Surgery Review Migration.
3. Cleanup commit: delete `PostSurgeryAuditReportShell` after route proof is complete.
4. Optional: migrate `/demo-report` onto shared shell with safe fixtures.

---

## Files changed (primary)

- `src/lib/patientReport/adapters/postSurgeryAuditReportAdapter.ts` (new)
- `src/lib/patientReport/normalizePostSurgeryReport.ts` (new)
- `src/lib/patientReport/postSurgeryPatientCopy.ts` (new)
- `src/lib/patientReport/resolvePatientPostSurgeryReportMount.ts` (new)
- `src/lib/patientReport/adapters/postSurgeryFallbackAdapter.ts` (delegates to full adapter)
- `src/lib/patientReport/photoGrouping.ts` (recipient / supporting groups)
- `src/lib/patientReport/types.ts` (photo group ids)
- `src/lib/patientReport/buildPatientReportViewModel.ts` (`POST_SURGERY_SECTION_ORDER`)
- `src/lib/patientReport/analytics.ts` (forbidden keys)
- `src/lib/patientReport/index.ts`
- `src/components/patient-report/PostSurgeryPatientReport.tsx` (new)
- `src/app/cases/[caseId]/page.tsx` (route resolution)
- `src/components/patient/PostSurgeryAuditReportShell.tsx` (deprecated notice)
- `tests/patientReportUi1b.test.ts` (new)
- `tests/e2e/hairaudit/patient-report-ui-1b.spec.ts` (new)
- `tests/e2e/hairaudit/patient-report-ui-1a.spec.ts` (Journey D update)
- `scripts/patient-report-ui-1b-visual-qa.ts` (new)
- `docs/HA-PATIENT-REPORT-UI-1B.md` (this file)
