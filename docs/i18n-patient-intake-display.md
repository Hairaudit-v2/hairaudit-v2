# Patient intake: canonical data vs localized display (Batches 12–13)

## Goals

- **Submit and store** the same field ids and option **values** as today (`patientAuditForm.ts`, validation, APIs).
- **Show** translated prompts, help, placeholders, and option **labels** from locale bundles when present.
- Keep **English** as the canonical fallback: every string on `PatientFormQuestion` remains the source of truth when bundle data is missing.

## Where things live

| Concern | Location |
|--------|----------|
| Field ids, types, `required`, option **values**, English prompt/help/placeholder/labels | `src/lib/patientAuditForm.ts` (`PATIENT_AUDIT_SECTIONS`) |
| Resolver entry points (review-enum id set + fallbacks) | `src/lib/patientIntake/intakeDisplayI18n.ts` |
| English source tree for display copy | `src/lib/i18n/translations/_generated/intakeFields.en.json` (regenerated from sections) → merged into `en.json` at `dashboard.patient.forms.intakeFields` |
| Spanish display copy | `_generated/intakeFields.flat.es.json` (machine-translated + hand fixes) → unflattened → merged into `es.json` at the same path |
| Reused option labels (10 review enums) | `dashboard.patient.forms.reviewEnums.<questionId>.<value>` — same ids as `PATIENT_INTAKE_REVIEW_ENUM_QUESTION_IDS` in `intakeDisplayI18n.ts` |
| Bracket-walk helpers (nested ids, option keys with spaces) | `getIntakeFieldPrompt` / `Help` / `Placeholder` / `getIntakeFieldOptionLabel` in `src/lib/i18n/getTranslation.ts` |
| UI wiring | `PatientAuditFormClient` → `resolvePatientIntake*` helpers + `locale` from `useI18n` |

## How resolution works

1. **Prompt / help / placeholder** — Read `dashboard.patient.forms.intakeFields` via a **segment walk** on `question.id` (dot-separated path under intakeFields). If missing in the active locale, fall back to English bundle, then to `patientAuditForm` strings.
2. **Select/checkbox option labels** — If `question.id` is in `PATIENT_INTAKE_REVIEW_ENUM_QUESTION_IDS`, use `t("dashboard.patient.forms.reviewEnums.<id>.<value>")` so the review step and dropdowns stay aligned. Otherwise use **`getIntakeFieldOptionLabel`** (object bracket access on `options`) so values like `Prefer not to say` work without dotted key paths.
3. **`option.value` is never translated**—only the visible label. The submitted payload is still the canonical value (`fue`, `not_sure`, `Yes`, etc.).

## Regenerating intake field bundles

1. **English tree + flat English** (from `PATIENT_AUDIT_SECTIONS`):

   `pnpm exec tsx scripts/generate-patient-intake-intakeFields.ts`

   Writes `_generated/intakeFields.en.json` and `_generated/intakeFields.flat.en.json`.  
   **Review-enum questions** (`clinic_country`, `procedure_type`, `donor_shaving`, `surgery_duration`, `post_op_swelling`, `bleeding_issue`, `recovery_time`, `shock_loss`, `months_since`, `would_repeat`) have **no** `options` in this tree so labels are not duplicated under `intakeFields`.

2. **Spanish flat** (optional refresh):

   `pnpm exec tsx scripts/translate-intake-flat-es.mts`

   Uses the MyMemory public API. Spot-check and patch `_generated/intakeFields.flat.es.json` for currency codes, placeholders, or garbled segments.

3. **Merge into `en.json` / `es.json`**:

   `pnpm exec tsx scripts/merge-intake-fields-into-bundles.mts`

   Unflattens Spanish with **deep merge** of `options` so per-option keys merge correctly.

After changing canonical English copy in `patientAuditForm.ts`, re-run (1) and (3); refresh (2) when Spanish should track the new strings.

## Regression avoidance

- **Changing** prompt text in `patientAuditForm` without re-merging `intakeFields` leaves Spanish showing old machine text until regeneration; keep **English** bundle in sync with canonical source strings.
- **Renaming** an option `value` requires schema/validation work—not an i18n-only edit.
- **Dotted `getTranslation`** must not be used for option labels when the canonical **value** can contain spaces; use `getIntakeFieldOptionLabel` instead.

## Rollout status

- **Batch 12:** Resolver pattern + sample `intakeFields` keys + `reviewEnums` for procedure type.
- **Batch 13:** Full question set under `dashboard.patient.forms.intakeFields` (merged from generated EN + flat ES), convention-based resolvers, shared `PATIENT_INTAKE_REVIEW_ENUM_QUESTION_IDS` with review summary.
- **Batch 14:** Spanish copy QA on `_generated/intakeFields.flat.es.json` and aligned dashboard/report-adjacent `es.json` strings; glossary in **`docs/i18n-es-terminology.md`**.
