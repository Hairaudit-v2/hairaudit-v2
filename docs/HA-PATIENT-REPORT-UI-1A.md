# HA-PATIENT-REPORT-UI-1A — Unified Patient Report Shell and Donor Report Migration

**Date:** 2026-07-30  
**Status:** GREEN  
**Scope:** Canonical patient report architecture + donor-healing migration only.  
**Does not change:** donor orientation mapping, six orientation states, pathway logic, snapshots, scoring engines, or PDF generation contracts.

**Follow-ons:** [HA-PATIENT-REPORT-UI-1A.1](./HA-PATIENT-REPORT-UI-1A.1.md) (seeded Playwright — GREEN) · [HA-PATIENT-REPORT-UI-1A.2](./HA-PATIENT-REPORT-UI-1A.2.md) (Donor PDF parity — GREEN).

---

## Objective

Create one reusable patient-facing report system and migrate the donor-healing Post-Surgery Audit experience into it, improving hierarchy and usability without altering clinical logic from HA-DONOR-HEALING-1A/1B.

---

## Current-state UX issues (pre-migration)

| Issue | Observation |
|-------|-------------|
| Narrow page | Case/report content felt constrained vs usable desktop width |
| Long scroll | Orientation, photos, findings, and technical detail competed without progressive disclosure |
| Fragmented surfaces | Dark case chrome + nested scorecard / radar / section cards |
| Radar dominance | Pathway visual / scorecards competed with orientation as primary conclusion |
| Photo burial | Clinical evidence gallery sat below dense technical sections |
| Professional proximity | Auditor Prepare / Confirm / Correct lived on the same case page (already gated, but not visually separated as a workspace) |

Before reference (donor landing / prior visual QA): `tmp/donor-healing-1a-desktop.png`, `tmp/donor-healing-1a-mobile.png`.

---

## Architecture decisions

1. **One patient report contract** — `PatientReportViewModel` in `src/lib/patientReport/types.ts`.
2. **Adapters, not engines** — UI consumes `buildDonorHealingPatientReportViewModel`; orientation labels still come from `DONOR_HEALING_ORIENTATION_LABELS` / `toPatientSafeDonorOrientationSlice`.
3. **Shell renders configured sections only** — no forced full section set per report type.
4. **Donor first** — `DonorHealingPatientReport` mounts the shell when `donorHealingEntryActive`; non-donor post-surgery keeps `PostSurgeryAuditReportShell`.
5. **Professional separation** — auditor controls wrapped in `data-testid="professional-donor-orientation-workspace"`; never passed into the patient shell; hidden in print CSS.
6. **Fallback** — missing donor orientation → `buildPostSurgeryFallbackViewModel` (safe post-surgery summary through the same contract).

---

## Current report route inventory

| Kind | Route / surface | Notes |
|------|-----------------|-------|
| Primary case report | `/cases/[caseId]` | Pre + post shells; **donor migration mounts here** |
| Patient reports index | `/dashboard/patient/reports` | List + download |
| HTML viewer | `/reports/[caseId]/html` | Session / render-token |
| PDF download | `/api/reports/[reportId]/download` | Unchanged |
| Print → PDF | `/api/print/report` | Templates unchanged this phase |
| Projection / longitudinal | Print/PDF HTML only | Not migrated (out of scope) |
| Pre-surgery web | `PreSurgeryPlanningReportShell` | Unchanged |
| Non-donor post-surgery web | `PostSurgeryAuditReportShell` | Unchanged |
| Auditor donor controls | Same case page, `isAuditor` only | Professional workspace wrapper |

### Duplicated patterns documented

- Pre vs Post web shells share hero / scorecard / shared section modules.
- Web vs PDF HTML twins for post/pre (donor orientation still web-primary).
- `PatientSafeSummaryShell` fallback under both pathways.

---

## Canonical report contract

```ts
type PatientReportType =
  | "pre_surgery"
  | "post_surgery"
  | "donor_healing"
  | "projection"
  | "longitudinal";

type PatientReportViewModel = {
  reportType: PatientReportType;
  reportTitle: string;
  reportSubtitle?: string;
  caseStatus?: string;
  reportDate?: string;
  procedureDate?: string;
  patientDisplayName?: string;
  reportReference?: string | null;
  summary: PatientReportSummary;
  statusItems: PatientReportStatusItem[];
  sections: PatientReportSection[];
  actions: PatientReportAction[];
  disclosures: PatientReportDisclosureItem[];
  analytics: { reportType; entryContext?; pathway? };
};
```

### Section types

`orientation` · `narrative` · `findings` · `photos` · `timeline` · `comparison` · `limitations` · `recommendations` · `disclosure`

### Donor section order

1. Header  
2. Donor healing orientation (summary + status strip)  
3. What this means  
4. Donor photographs  
5. Observed donor features  
6. Healing-stage interpretation  
7. Evidence limitations  
8. Recommended next steps  
9. Supporting evidence (collapsed)  
10. Methodology and report record (collapsed)

---

## Donor adapter

`src/lib/patientReport/adapters/donorHealingReportAdapter.ts`

Preserves:

- orientation state + patient-safe label (1B mapping)
- stage-aware narrative + red-flag escalation
- evidence sufficiency → status strip
- photo grouping (rear / left / right / additional)
- limitations + next steps from existing report contracts
- provenance as patient-safe label only (no actor IDs)

Does **not** duplicate orientation mapping in the UI.

Fallback: `adapters/postSurgeryFallbackAdapter.ts` when orientation is absent.

---

## Professional separation

| Surface | Patient report | Professional workspace |
|---------|----------------|------------------------|
| Prepare / Confirm / Correct | Absent | `DonorHealingOrientationReviewPanel` |
| Internal provenance history | Absent | Auditor panel |
| Report IDs / actor IDs | Never rendered | Internal only |
| Print | Hides workspace + sticky nav | N/A |

Mount: `/cases/[caseId]` when `isAuditor && donorHealingEntryActive`, wrapped as `professional-donor-orientation-workspace`.

---

## Responsive behaviour

- Shell: `max-w-6xl`
- Narrative: `max-w-4xl`
- Photos / wide evidence: full shell width
- Desktop: two/three-column status + “what this means”; findings table
- Mobile: single column; findings as stacked cards; compact jump menu
- `overflow-x-hidden` on shell; no sticky panel blocking mobile content

---

## Print behaviour

`src/app/globals.css` `@media print`:

- hides `.patient-report-no-print` (nav, action chrome)
- hides professional workspace
- light background, avoid ink-heavy full-page dark fills
- avoid clipping images (`break-inside: avoid`, max-height)
- disclosure items marked `expandInPrint` include print-only body text

PDF generation engines / snapshot contracts unchanged.

---

## Analytics map

| Event | When | Safe dimensions |
|-------|------|-----------------|
| `donor_report_viewed` | Existing tracker (patient + donor entry) | `entry_context=donor_healing` via `donorHealingAnalyticsMeta` |
| `patient_report_section_opened` | Disclosure expand | `report_type`, `section_type`, `entry_context`, `pathway` |
| `patient_report_photo_expanded` | Lightbox open | + `photo_role` |
| `patient_report_download_clicked` | Download control | header |
| `patient_report_print_clicked` | Print control | header |
| `patient_report_next_step_clicked` | Next-step tap | `next_step_key` |

### Analytics privacy proof

Forbidden keys stripped (`caseId`, `patient_name`, `photograph_id`, `imageUrl`, health answers, etc.) — covered in `tests/patientReportUi1a.test.ts` (`buildPatientReportAnalyticsPayload` + `patientReportAnalyticsContainsForbiddenKeys`).

---

## Accessibility review

- Semantic regions / headings for shell sections
- Status strip uses text labels + colour (colour not sole indicator)
- Photo expand buttons keyboard-focusable; Escape closes lightbox
- Disclosure controls: `aria-expanded` / `aria-controls`
- Always-visible urgent-care disclosure outside collapsed groups
- Escalation copy rendered in primary summary (not disclosure-only)
- Focus-visible styles inherit global HairAudit focus ring

---

## Screenshots

| File | Purpose |
|------|---------|
| `tmp/patient-report-ui-1a-donor-desktop.png` | New desktop donor report |
| `tmp/patient-report-ui-1a-donor-mobile.png` | Mobile stack |
| `tmp/patient-report-ui-1a-donor-expanded-photo.png` | Photo expand |
| `tmp/patient-report-ui-1a-donor-supporting-detail.png` | Supporting detail open |
| `tmp/patient-report-ui-1a-print-preview.png` | Print media |
| `tmp/patient-report-ui-1a-professional-separation.png` | Professional workspace vs patient shell |

Generator: `scripts/patient-report-ui-1a-visual-qa.ts`

### Before / after UX differences

| Dimension | Before | After (1A) |
|-----------|--------|------------|
| Page length | Long educational/technical mix | Shorter primary path; secondary collapsed |
| Usable width | Narrow column feel | `max-w-6xl` shell |
| Photograph prominence | Below scorecards / shared modules | Near top after orientation + “what this means” |
| Orientation visibility | Small block under dark hero | Dominant first-screen summary |
| Nested cards | Many scorecard / concern stacks | Fewer surfaces; findings table |
| Professional controls | Same page, weakly separated | Explicit professional workspace; absent from patient shell / print |

---

## Files changed

### New

- `src/lib/patientReport/types.ts`
- `src/lib/patientReport/buildPatientReportViewModel.ts`
- `src/lib/patientReport/analytics.ts`
- `src/lib/patientReport/healingStageLabels.ts`
- `src/lib/patientReport/photoGrouping.ts`
- `src/lib/patientReport/adapters/donorHealingReportAdapter.ts`
- `src/lib/patientReport/adapters/postSurgeryFallbackAdapter.ts`
- `src/lib/patientReport/index.ts`
- `src/components/patient-report/*` (shell + sections)
- `tests/patientReportUi1a.test.ts`
- `tests/e2e/hairaudit/patient-report-ui-1a.spec.ts`
- `scripts/patient-report-ui-1a-visual-qa.ts`
- `docs/HA-PATIENT-REPORT-UI-1A.md`

### Updated

- `src/app/cases/[caseId]/page.tsx` — donor mount + professional workspace wrapper
- `src/app/globals.css` — print rules for patient report

---

## Tests

```bash
pnpm exec tsx --test tests/patientReportUi1a.test.ts
pnpm exec tsx --test tests/donorHealing1b.test.ts tests/patientReportUi1a.test.ts
pnpm exec eslint "src/lib/patientReport/**/*.{ts,tsx}" "src/components/patient-report/**/*.{ts,tsx}" "tests/patientReportUi1a.test.ts" "tests/e2e/hairaudit/patient-report-ui-1a.spec.ts" "scripts/patient-report-ui-1a-visual-qa.ts"
pnpm typecheck
pnpm run build
pnpm exec playwright test --config=playwright.config.ts tests/e2e/hairaudit/patient-report-ui-1a.spec.ts
```

### Results (2026-07-30)

| Check | Result |
|-------|--------|
| Unit (`patientReportUi1a`) | **18/18 pass** |
| Regression with 1B | **29/29 pass** |
| ESLint (changed patient-report files) | **pass** |
| Typecheck | **pass** |
| Production build | **pass** |
| Playwright Journeys A–E + extras | **11/11 pass** — see [1A.1](./HA-PATIENT-REPORT-UI-1A.1.md) |

**Verdict: GREEN** — donor web shell shipped; seeded E2E proof complete. PDF orientation parity is tracked separately as **1A.2** (not absorbed into 1B).

---

## Known limitations

- Pre-surgery / projection / longitudinal React shells not migrated.
- Post-surgery PDF HTML donor orientation parity — **HA-PATIENT-REPORT-UI-1A.2** (GREEN).
- Visual QA screenshots use fixture HTML with placeholder photo frames (not live signed URLs); live signed-URL behaviour is covered in 1A.1 Playwright.
- Case page outer chrome remains dark for non-patient forensic context; patient shell itself is light.

---

## Rollback plan

1. Revert case-page branch that mounts `DonorHealingPatientReport` → restore sole `PostSurgeryAuditReportShell`.
2. Leave `src/lib/patientReport/**` and `src/components/patient-report/**` unused (safe to delete in follow-up).
3. Professional workspace wrapper can revert to prior panel mount without touching orientation APIs.
4. No DB / snapshot migrations in this phase — rollback is code-only.

---

## Migration plan for later report types

| Phase | Scope |
|-------|-------|
| **HA-PATIENT-REPORT-UI-1A.2** | Donor PDF orientation parity — **GREEN** |
| **HA-PATIENT-REPORT-UI-1B** | Standard Post-Surgery Audit → shell (non-donor) |
| **1C** | Pre-Surgery Planning adapter + shell |
| **1D** | Projection / longitudinal web shells (today PDF-only) |
| **1E** | Shared PDF HTML header parity with patient shell |

Each phase: adapter → section config → mount swap → tests → screenshots; keep clinical engines untouched.

---

## Acceptance criteria checklist

- [x] Canonical reusable patient report shell
- [x] Donor-healing report uses new shell
- [x] Primary orientation in first screen
- [x] Wider desktop report width (`max-w-6xl`)
- [x] Photographs near top + expandable
- [x] Concise findings table
- [x] Progressive disclosure for supporting detail
- [x] Professional controls absent from patient report
- [x] Professional controls remain for auditors
- [x] Orientation logic / labels / snapshots unchanged
- [x] Legacy non-donor post-surgery unchanged
- [x] Print CSS patient-friendly
- [x] Analytics privacy-safe
- [x] Unit tests pass
- [x] ESLint pass on changed patient-report files
- [x] Typecheck pass
- [x] Production build pass
- [x] Docs complete
- [x] Playwright live pass (1A.1 seeded Journeys A–E + extras)
