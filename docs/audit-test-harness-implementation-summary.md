# Audit Test Harness — Implementation Summary

## Files created

| Path | Purpose |
|------|--------|
| `tests/audit-harness/config/canonicalMappings.ts` | Re-exports app category/field mappings; submission-type helpers |
| `tests/audit-harness/types/scenario.ts` | Scenario definition types (meta, expectations, imageMapping) |
| `tests/audit-harness/data/factories.ts` | Minimal valid (and invalid) patient/doctor/clinic answer factories |
| `tests/audit-harness/helpers/env.ts` | Load `.env.local`; `validateHarnessEnv()` for fail-fast missing env; `getTestUserId()` |
| `tests/audit-harness/helpers/db.ts` | Create test case, cleanup (DB + storage under `cases/<id>/`), `getAuditorCaseSnapshot`, list harness cases |
| `tests/audit-harness/helpers/output.ts` | Terminal output: startup banner, per-scenario progress, summary table, totals, output file paths, regression drift and setup failure messages (uses chalk, cli-table3) |
| `tests/audit-harness/helpers/uploads.ts` | Upload file to storage + insert `uploads` row; attach images for scenario |
| `tests/audit-harness/helpers/imageBuffer.ts` | Default 1000×1000 JPEG buffer (sharp) for evidence min dimensions |
| `tests/audit-harness/helpers/answers.ts` | Save patient/doctor/clinic answers to `reports` table |
| `tests/audit-harness/helpers/assertions.ts` | Readiness (canSubmit, evidence details), evidence manifest, missing-category match |
| `tests/audit-harness/data/goldDoctorAnswers.ts` | Full schema-valid doctor payload for gold regression scenario |
| `tests/audit-harness/data/goldClinicAnswers.ts` | Full schema-valid clinic payload for gold regression scenario |
| `tests/audit-harness/scenarios/patient.scenarios.ts` | Patient scenarios including legacy-donor-rear (legacy upload normalization) |
| `tests/audit-harness/scenarios/doctor.scenarios.ts` | Doctor scenarios including gold (full validation), legacy-preop-donor-rear |
| `tests/audit-harness/scenarios/clinic.scenarios.ts` | Clinic scenarios including gold (full validation), legacy-preop-donor-rear |
| `tests/audit-harness/runner.ts` | Main runner: create case → save answers → attach images → evidence prep → assertions → regression lock → output |
| `tests/audit-harness/regressionLock.ts` | Compare gold-scenario outputs to snapshots; `--update-snapshots` to refresh |
| `tests/audit-harness/snapshots/expectedOutputs.json` | Locked expected outputs for patient.complete-fue, doctor.gold, clinic.gold |
| `tests/audit-harness/snapshots/README.md` | How to refresh expectations when rules change deliberately |
| `tests/audit-harness/README.md` | Short run instructions |
| `docs/audit-test-harness.md` | Full documentation (coverage, gaps, how to add scenarios) |
| `docs/audit-test-harness-implementation-summary.md` | This file |

## Files changed

| Path | Change |
|------|--------|
| `package.json` | Added scripts: `test:audits`, `test:audits:patient`, `test:audits:doctor`, `test:audits:clinic` |

## How scenarios are executed

1. **Load env** — `loadEnvLocal()` loads `.env.local` from project root.
2. **Supabase** — `createSupabaseAdminClient()` (requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
3. **Test user** — `HARNESS_TEST_USER_ID` (required) is the owner of all created cases.
4. **Per scenario:**
   - Create case: `createTestCase(supabase, { auditType, userId })` → `cases` row (draft).
   - Save answers: `saveAnswersForType(supabase, caseId, submissionType, answers)` → `reports` (insert or update summary).
   - Attach images: `attachImagesForScenario(...)` → storage upload + `uploads` rows (`patient_photo:*` / `doctor_photo:*` / `clinic_photo:*`). Optional `legacyUploads` on scenario insert additional rows with legacy types (e.g. `patient_photo:donor_rear`).
   - Readiness: `computeReadinessForSubmitApi(auditType, photos)` — canonical clinic path (no patient fallback).
   - Evidence: `prepareCaseEvidenceManifest({ supabase, caseId, bucket })` → `case_evidence_manifests` row.
   - Auditor snapshot: `getAuditorCaseSnapshot(supabase, caseId)` → case status, manifest status, missing categories, report presence.
   - Assert: readiness pass/fail, missing categories, manifest status, validation result, auditor visibility consistent.
   - Cleanup (default): `cleanupTestCase(supabase, caseId)` — deletes manifests, uploads, reports, **storage under `cases/<caseId>/`**, then case.
5. **Output** — JSON and Markdown written to `tests/audit-harness-output/` with timestamp. Terminal: startup banner and mode, live per-scenario progress (start, pass/fail, compact state line), final summary table and totals, output file paths; setup and regression failures printed clearly.

## Implemented

- **Gold scenarios** — `doctor.gold` and `clinic.gold` use `getGoldDoctorAnswers()` / `getGoldClinicAnswers()`; full schema validation pass, readiness, manifest, scoring, auditor visibility.
- **Clinic readiness** — Production and harness use canonical clinic evidence/category model; no patient fallback, no test-only workaround.
- **Legacy compatibility** — Scenarios insert `patient_photo:donor_rear`, `doctor_photo:preop_donor_rear`, `clinic_photo:preop_donor_rear` via `legacyUploads`; manifest and required-category logic asserted.
- **Auditor smoke** — `getAuditorCaseSnapshot()` in `helpers/db.ts`; each scenario output includes `auditorVisibilityResult` (case status, manifest status, missing categories, report presence).
- **Storage cleanup** — `cleanupTestCase()` calls `cleanupCaseStorage()` to remove objects under `cases/<caseId>/` (recursive list + remove); bucket name from `CASE_FILES_BUCKET` or `case-files`.
- **Output** — Scenario result includes `validationResult`, `manifestStatus`, `scoringEligibility`, `auditorVisibilityResult`; Markdown and JSON updated.

## Known gaps

- **Inngest** — No real `case/submitted` trigger; evidence preparation is called directly.
- **PDF/report** — Not generated in harness; only report row and summary shape.

## Adding future regression cases

- **Gold** — Keep `data/goldDoctorAnswers.ts` and `data/goldClinicAnswers.ts` in sync with schema when required fields change; add new gold scenarios that use them.
- **Legacy** — Add `legacyUploads` with the legacy type and omit that category from `imageMapping`; assert readiness pass and manifest recognition.
- **Auditor** — Extend `getAuditorCaseSnapshot()` or expectations if new auditor-facing fields are added.
