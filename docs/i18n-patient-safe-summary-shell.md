# Patient-safe summary shell (Batch 16)

## What is localized now

Batch 16 adds the first **patient-facing summary-output shell** without touching live report generation:

- Section heading / subtitle for the patient-safe summary block on the case page
- Status and score labels
- Stage badges for structured summary observations (`preop`, `day0`, `month_1_3`, etc.)
- Helper text and disclaimer copy explaining the boundary between localized shell copy and generated report content

The shell is rendered from app-owned UI strings under `dashboard.patient.safeSummary.*`.

## What remains English-generated

The following content is still shown exactly as it comes from the current report summary / AI pipeline:

- observation text extracted from `summary.key_findings` / `summary.red_flags`
- AI-generated narrative
- findings / recommendations prose
- PDF output
- rubric-driven report content

No scoring, finalize, storage, or PDF generation behavior was changed in this batch.

## Runtime boundary

- `src/lib/reports/patientSafeSummary.ts` builds a small structured observation list from existing report summary data.
- `src/components/patient/PatientSafeSummaryShell.tsx` localizes only the surrounding shell.
- `src/app/cases/[caseId]/page.tsx` renders the shell for patient viewers when a latest report exists.

## Additive readiness only

`src/lib/i18n/reportTranslationBlueprint.ts` now includes a small `PatientSafeSummaryShellBlueprint` helper plus `patientSafeSummaryShell` as a future translation section id. These are **blueprint-only** markers for later work and are not read by current generators.

## Next step

If future product work wants translated narrative delivery, the next safe step is to store **separate translated structured sections** alongside the canonical English report content, then let the render layer choose between:

- localized shell + English narrative (today)
- localized shell + translated reviewed narrative (future)
