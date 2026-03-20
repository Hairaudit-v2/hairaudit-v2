# Doctor & clinic audit form display i18n

Batch 15 extends the **display-layer** pattern used for patient intake to the deeper doctor and clinic audit forms.

## Principles

- Canonical field ids, option values, validation, payloads, and workflow logic stay in the source schemas:
  - `src/lib/doctorAuditForm.ts`
  - `src/lib/clinicAuditForm.ts`
- Localized display copy lives in locale bundles under:
  - `dashboard.doctor.forms.caseAudit.*`
  - `dashboard.clinic.forms.caseAudit.*`
- Missing strings fall back to the canonical English schema text.

## Generated display trees

Run these in order:

```bash
pnpm exec tsx scripts/generate-doctor-clinic-audit-display.ts
pnpm exec tsx scripts/translate-doctor-clinic-audit-display-es.mts
pnpm exec tsx scripts/merge-doctor-clinic-audit-display-bundles.mts
```

Generated artifacts land under `src/lib/i18n/translations/_generated/`:

- `doctorCaseAudit.en.json`
- `doctorCaseAudit.flat.en.json`
- `doctorCaseAudit.flat.es.json`
- `doctorCaseAudit.es.json`
- `clinicCaseAudit.en.json`
- `clinicCaseAudit.flat.en.json`
- `clinicCaseAudit.flat.es.json`
- `clinicCaseAudit.es.json`

## Runtime resolution

- `src/lib/audit/auditDisplayI18n.ts` resolves section titles, prompts, help, placeholders, and option labels by stable id.
- `QuestionField` localizes generic select / inherited-record UI from `dashboard.shared.auditForms.*`.
- Review summaries and form sections use the localized display labels, but submitted values remain canonical.

## Notes

- Translation is keyed by **field id** and **section id**, not by free text.
- Doctor / clinic page-level wrapper copy lives under `dashboard.{actor}.forms.caseAudit.page.*`.
- Clinic doctor roster management strings live under `dashboard.clinic.forms.doctorsManager.*`.
