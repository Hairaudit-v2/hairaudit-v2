# Audit Test Harness

Run: `pnpm run test:audits` (or `test:audits:patient`, `test:audits:doctor`, `test:audits:clinic`).

Requires in `.env.local` at project root: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `HARNESS_TEST_USER_ID` (a Supabase Auth user UUID; create a test user in the dashboard if needed).

**Highlights**

- **Gold scenarios** — `doctor.gold` and `clinic.gold` use full schema-valid payloads (`data/goldDoctorAnswers.ts`, `data/goldClinicAnswers.ts`) for regression.
- **Regression locking** — Gold outputs (readiness, missing categories, manifest status/categories, validation, scoring) are compared to `snapshots/expectedOutputs.json`. Drift fails the run. Refresh with `--update-snapshots` when rules change deliberately (see `snapshots/README.md`).
- **Clinic readiness** — Uses canonical clinic evidence/category model (no patient fallback).
- **Legacy compatibility** — Scenarios `patient.legacy-donor-rear`, `doctor.legacy-preop-donor-rear`, `clinic.legacy-preop-donor-rear` assert legacy upload types normalize correctly.
- **Cleanup** — With cleanup enabled, DB rows and storage objects under `cases/<caseId>/` are removed (see `helpers/db.ts`).
- **Output** — Each scenario report includes validation result, manifest status, scoring eligibility, and auditor visibility result (JSON + Markdown).

**Terminal output** — The runner prints a startup banner, working directory, run mode, and scenario counts; live progress per scenario (start, pass/fail, compact state line); a final summary table (Scenario, Type, Validation, Manifest, Readiness, Score Eligible, Result); totals; and output file paths. Setup and regression failures are clearly separated (missing env vs. scenario failure vs. snapshot drift).

**Refresh expectations (after intentional rule changes)**  
`pnpm run test:audits -- --update-snapshots`

See [docs/audit-test-harness.md](../../docs/audit-test-harness.md) for full documentation.
