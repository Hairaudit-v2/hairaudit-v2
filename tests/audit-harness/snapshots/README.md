# Regression lock snapshots

The file **`expectedOutputs.json`** stores the expected outputs for **gold scenarios** so that unintended changes in business-rule behavior are detected.

## Locked scenarios

- **patient.complete-fue** — Complete patient case (all required images + valid answers)
- **doctor.gold** — Gold-standard doctor (full schema validation, readiness, manifest, scoring)
- **clinic.gold** — Gold-standard clinic (full schema validation, readiness, manifest, scoring)

## Compared fields

For each gold scenario the harness compares actual vs expected:

- **readinessResult** — `pass` | `fail`
- **missingCategories** — list of missing required photo categories
- **manifestStatus** — e.g. `ready` | `incomplete`
- **manifestCategoriesRecognized** — categories present in the evidence manifest (sorted)
- **validationResult** — form validation `pass` | `fail`
- **scoringEligibility** — `eligible` | `blocked` | `not_asserted`

If any field differs, the run **fails** with a clear diff.

## When rules change deliberately

1. Run the harness with **`--update-snapshots`** so actual outputs are written to `expectedOutputs.json`:
   ```bash
   pnpm run test:audits -- --update-snapshots
   ```
   Or for a single type:
   ```bash
   pnpm run test:audits:doctor -- --update-snapshots
   ```
   (Only gold scenarios that ran are updated.)

2. Review the diff in `tests/audit-harness/snapshots/expectedOutputs.json`.

3. Commit the updated snapshot so the new behavior becomes the locked baseline.

## First-time setup

If `expectedOutputs.json` has empty `manifestCategoriesRecognized` (or is missing), run once with `--update-snapshots` to populate it from the current run, then commit.
