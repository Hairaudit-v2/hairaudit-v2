# Audit Test Harness

Internal QA test framework for end-to-end audit flows: **Patient**, **Doctor**, and **Clinic** submissions.

## What is covered

- **Case creation** — Test cases created in DB with `qa_automated_` prefix.
- **Answers storage** — Patient (reports.patient_audit_v2 / summary), doctor (summary.doctor_answers), clinic (summary.clinic_answers).
- **Upload handling** — Storage upload + `uploads` rows with correct `type` (patient_photo:, doctor_photo:, clinic_photo:).
- **Evidence mapping** — `prepareCaseEvidenceManifest` runs; categories inferred via `inferCanonicalPhotoCategory`.
- **Readiness** — `canSubmit(submitterType, photos)` and missing required categories.
- **Scoring eligibility** — Readiness + manifest ready implies scoring can run.
- **Auditor consistency** — Missing evidence list and readiness state aligned with expectations.
- **Provenance** — Scenarios with `field_provenance` (doctor/clinic); harness stores and can assert presence.
- **Legacy** — Patient legacy (`patient_photo:donor_rear`), doctor (`doctor_photo:preop_donor_rear`), clinic (`clinic_photo:preop_donor_rear`) scenarios insert legacy types and assert normalization and required-category satisfaction.
- **Gold scenarios** — `doctor.gold` and `clinic.gold` use full schema-valid payloads (`data/goldDoctorAnswers.ts`, `data/goldClinicAnswers.ts`); validation pass, readiness, manifest, scoring eligibility, auditor visibility asserted.
- **Clinic readiness** — Production and harness use one canonical clinic evidence/category model; no patient fallback and no test-only workaround.
- **Auditor smoke** — `getAuditorCaseSnapshot()` (case status, manifest status, missing categories, report presence) and `auditorVisibilityResult` in each scenario output.
- **Cleanup** — When cleanup is enabled, `cleanupTestCase()` also deletes storage objects under `cases/<caseId>/` (see `helpers/db.ts`).

## What is not yet covered

- **Full PDF/report generation** — Only upstream inputs and report row creation; no end-to-end PDF render in harness.
- **Inngest pipeline** — No real `case/submitted` trigger; evidence preparation is invoked directly.
- **Browser / UI** — No Playwright or UI automation; API and DB only.

## Regression tests

Focused unit-style tests for critical behavior (no DB):

- **Doctor primary_procedure_type:** `PROCEDURE_TYPE_FUE` / `PROCEDURE_TYPE_FUT` contain expected values; FUE/FUT share `combined`.
- **Canonical upload category mapping:** `PATIENT_REQUIRED_KEYS` and `DOCTOR_REQUIRED_KEYS` match submit requirements; `getRequiredKeysForSubmit` aligns with app; patient legacy aliases (photoCategories) and doctor legacy types (preop_*, day0_*) normalize correctly; `parsePhotoKey` and `DOCTOR_PHOTO_CATEGORIES` include required keys.
- **Auditor missing evidence visibility:** `computeEvidenceDetails(...).missingRequired` matches required keys minus completed; shape is suitable for auditor display; when all required present, `missingRequired` is empty; `buildCountsByKey` and `getRequiredKeys` align with `computeEvidenceDetails`.

Run: `pnpm run test:audits:regression`

## How to run

**Prerequisites**

- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- `HARNESS_TEST_USER_ID` — A valid user UUID (owner of test cases). Create a test user in Supabase Auth if needed.

**Commands**

```bash
# All scenarios (patient + doctor + clinic)
pnpm run test:audits

# By type
pnpm run test:audits:patient
pnpm run test:audits:doctor
pnpm run test:audits:clinic

# Regression tests only (no DB)
pnpm run test:audits:regression

# Keep test data (no cleanup)
pnpm run test:audits -- --no-cleanup

# Refresh regression snapshots (after intentional rule changes)
pnpm run test:audits -- --update-snapshots
```

**Regression locking**

Gold scenario outputs (readiness, missing categories, manifest status/categories, validation, scoring) are compared to `tests/audit-harness/snapshots/expectedOutputs.json`. If any locked output drifts, the run fails with a clear diff. When you change business rules on purpose (e.g. new required category, new validation rule), run with **`--update-snapshots`** to refresh the expected file, then commit. See `tests/audit-harness/snapshots/README.md` for details.

**Terminal output**

- **Startup:** Banner (“HairAudit Automated Audit Harness”), working directory, run mode (type filter, cleanup, update-snapshots), scenario counts by type.
- **Per scenario:** Start line (scenario id and name), then pass/fail with a compact state line (validation, manifest, readiness, scoreEligible) and duration; on failure, reason and errors.
- **Final summary:** Table with columns Scenario, Type, Validation, Manifest, Readiness, Score Eligible, Result; totals (passed/failed/total); paths to JSON and Markdown output files.
- **Failure clarity:** Setup errors (missing env) list which variable(s) and where to add them (.env.local). Regression drift shows expected vs actual and reminds to use `--update-snapshots` only when intentional. Scenario failures show the scenario name and error reason.

**File output (unchanged)**

- **Machine-readable:** `tests/audit-harness-output/results-<timestamp>.json` — each scenario includes `validationResult`, `manifestStatus`, `scoringEligibility`, `auditorVisibilityResult`, `pass`/fail.
- **Human-readable:** `tests/audit-harness-output/summary-<timestamp>.md` — table per scenario with scenario name, submission type, procedure type, validation result, readiness, missing fields/categories, manifest status, scoring eligibility, auditor visibility result, pass/fail.
- Exit code `1` if any scenario failed, or regression lock failed, or setup (missing env) failed.

## How to add more scenarios

1. **Define scenario** in `tests/audit-harness/scenarios/`:
   - `patient.scenarios.ts`, `doctor.scenarios.ts`, or `clinic.scenarios.ts`.
2. **Use types** from `types/scenario.ts`: `ScenarioDefinition`, `ScenarioMeta`, `ScenarioExpectations`, `ImageMapping`, optional `legacyUploads`.
3. **Use factories** from `data/factories.ts` for minimal valid (or invalid) answers; for **full validation pass** use `data/goldDoctorAnswers.ts` / `data/goldClinicAnswers.ts` (gold scenarios).
4. **Set `imageMapping`** — keys = category names (patient: `preop_front`, etc.; doctor/clinic: `img_preop_front`, etc.); value = `true` (default generated image) or path to file under `fixtures/images/<type>/`.
5. **Optional `legacyUploads`** — e.g. `[{ type: "patient_photo:donor_rear" }]` to test legacy type normalization; runner inserts these and includes them in readiness.
6. **Set `expectations`** — e.g. `readinessPass`, `expectedMissingCategories`, `scoringEligible`, `provenancePresent`, `evidenceRecognizesCategories`.
7. **Run** with `pnpm run test:audits` or `pnpm run test:audits:patient` (etc.).

**Example**

```ts
{
  meta: {
    id: "patient.my-scenario",
    name: "My scenario",
    submissionType: "patient",
  },
  answers: createMinimalPatientAnswers({ clinic_name: "Custom" }),
  imageMapping: { preop_front: true, preop_top: true, preop_donor_rear: true },
  expectations: {
    caseCreated: true,
    answersStored: true,
    uploadsStored: true,
    readinessPass: true,
  },
}
```

## Canonical mappings

- **Patient upload categories:** `src/lib/photoCategories.ts` — `preop_front`, `preop_top`, `preop_donor_rear`, etc.; submit readiness uses `PATIENT_REQUIRED_KEYS` in `auditPhotoSchemas` (patient_current_front, patient_current_top, patient_current_donor_rear) via legacy map.
- **Doctor/Clinic:** `src/lib/doctorPhotoCategories.ts` / `clinicPhotoCategories.ts` — `img_preop_front`, …, `img_immediate_postop_donor`; same keys in `auditPhotoSchemas` for `canSubmit`.
- **Evidence manifest:** `src/lib/evidence/prepareCaseEvidence.ts` — `REQUIRED_EVIDENCE_CATEGORIES`: preop_front, preop_top, preop_donor_rear, day0_recipient, day0_donor.
- Harness reuses these via `tests/audit-harness/config/canonicalMappings.ts`.

## Test assets

- **Default image:** Generated in-memory (sharp) 1000×1000 JPEG so evidence preparation does not mark as "poor".
- **Custom images:** Place under `tests/audit-harness/fixtures/images/patient/`, `doctor/`, or `clinic/` and reference in `imageMapping` by path relative to that folder.

## Known gaps

- **Report/PDF** generation not run in harness; validate report row and summary shape instead.

## Adding future regression cases

- **Gold scenarios** — Use `getGoldDoctorAnswers()` / `getGoldClinicAnswers()` and full required image mapping; assert validation pass, readiness pass, manifest ready, scoring eligible, auditor visibility consistent. Keep gold payloads in `data/goldDoctorAnswers.ts` and `data/goldClinicAnswers.ts` in sync with `doctorAuditSchema` / `clinicAuditSchema` when new required fields are added.
- **Legacy** — Add `legacyUploads: [{ type: "submitter_photo:legacy_key" }]` and omit that category from `imageMapping`; expect `readinessPass: true` and `evidenceRecognizesCategories: true` if the app maps that legacy key to a required category.
- **Auditor** — Assertions use `getAuditorCaseSnapshot()`; extend snapshot or expectations if new auditor-facing fields are added.
