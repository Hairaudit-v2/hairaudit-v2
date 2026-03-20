# Patient intake: canonical data vs localized display (Batch 12)

## Goals

- **Submit and store** the same field ids and option **values** as today (`patientAuditForm.ts`, validation, APIs).
- **Show** translated prompts, help, placeholders, and option **labels** when keys exist in `en.json` / `es.json`.
- Keep **English** as the canonical fallback: every string on `PatientFormQuestion` remains the source of truth when a translation key is missing or mis-typed.

## Where things live

| Concern | Location |
|--------|----------|
| Field ids, types, `required`, option **values**, English prompt/help/placeholder/labels | `src/lib/patientAuditForm.ts` (`PATIENT_AUDIT_SECTIONS`) |
| Optional i18n keys per question (prompt/help/placeholder + per-value label keys) | `src/lib/patientIntake/intakeDisplayI18n.ts` → `PATIENT_INTAKE_QUESTION_DISPLAY` |
| English + Spanish copy for dedicated field keys | `dashboard.patient.forms.intakeFields.*` in `src/lib/i18n/translations/en.json` and `es.json` |
| Reused option labels (e.g. procedure type) | Often `dashboard.patient.forms.reviewEnums.<questionId>.<value>` so review summary and selects stay aligned |
| UI wiring | `PatientAuditFormClient` → `resolvePatientIntake*` helpers |

## How resolution works

1. Look up `PATIENT_INTAKE_QUESTION_DISPLAY[question.id]`.
2. If a `*Key` is present, call `t(key)`; if the bundle returns the key path (missing string), **fall back** to the canonical string from `patientAuditForm`.
3. For select/checkbox options, **`option value` is never translated**—only the visible label. The submitted payload is still `value` (e.g. `fue`, `not_sure`).

## Adding a new localized question

1. **Do not** change existing `value` strings or question `id` values in `patientAuditForm.ts` unless you are doing a dedicated migration (out of scope for display-only work).
2. Add keys under `dashboard.patient.forms.intakeFields.<question_id>.prompt` (and `help` / `placeholder` if needed) in **both** `en.json` and `es.json`. English must match the current `patientAuditForm` text so default locale stays identical.
3. For selects/checkboxes, either:
   - add `optionLabelKeys` in `PATIENT_INTAKE_QUESTION_DISPLAY` pointing at `intakeFields...` or `reviewEnums...` keys, **one key per option value**, or
   - add a `reviewEnums` subtree and reference those keys from `optionLabelKeys` (recommended when the review step shows the same enum).
4. Register the question id in `PATIENT_INTAKE_QUESTION_DISPLAY` with `promptKey` / `helpKey` / `placeholderKey` / `optionLabelKeys` as appropriate.

## Regression avoidance

- **Changing** prompt text in `patientAuditForm` without updating `en.json` `intakeFields` (when keys exist) will not break submission but **Spanish** may diverge until translations are updated; keep English bundles in sync with canonical labels whenever you change the source string.
- **Renaming** an option `value` requires DB/schema/validation work—treat as a schema change, not an i18n-only edit.
- **Adding** options requires a new `value` in `patientAuditForm` plus a new translation key and `optionLabelKeys` entry if that option should be localized.

## Batch 12 proof (sample)

These question ids are registered end-to-end: `clinic_name`, `preop_consult`, `procedure_type` (option labels reuse `reviewEnums.procedure_type`).

Use this as a template for rolling more questions forward mechanically.
