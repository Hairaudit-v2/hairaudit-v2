# Patient-safe summary translated narrative pilot (Batch 19)

Batch 19 introduces the first live translated narrative pilot in HairAudit, limited to the lowest-risk patient-facing summary surface.

## Scope

This pilot applies only to the patient case-page summary shell rendered by:

- `src/app/cases/[caseId]/page.tsx`
- `src/components/patient/PatientSafeSummaryShell.tsx`

It does not apply to:

- full report bodies
- PDF output
- rubric explanations
- forensic analysis
- clinician/internal narrative
- auditor-facing content

## Source of truth

English remains authoritative.

- the canonical source snapshot is the English patient-safe summary observation list
- translated Spanish text is stored as an additive overlay in `report_narrative_translations`
- the full report summary, report PDF, and underlying report storage stay unchanged

## Pilot generation path

The pilot uses `src/lib/reports/patientSafeSummaryNarrativeTranslation.ts` to:

1. build a source snapshot from the latest report summary observations
2. look for an existing stored Spanish translation for that exact report version snapshot
3. mark old translations stale if the English source changed
4. generate a fresh Spanish translation on demand when missing or stale
5. persist the translated overlay separately from canonical report content

Generation is bounded:

- only `es` is supported
- only `patientSafeSummaryNarrative` is generated
- only the patient-safe summary observation texts are translated

## Serving rules

Translated summary text is shown only when all of the following are true:

- requested locale is supported by the pilot (`es`)
- translated observation items exist
- translated item count matches the English source count
- the translation is not stale relative to the current English source snapshot
- the section passes pilot gating

Pilot gating allows:

- `reviewed_approved` translations
- `generated_unreviewed` translations for this bounded patient-safe summary pilot because the contract policy for `patientSafeSummaryNarrative` is `humanReviewRequirement: recommended`

Fallback behavior:

- unsupported locale -> English source observations
- missing stored translation -> English unless generation succeeds
- stale translation -> English until regeneration succeeds
- generation failure -> English
- missing feature table / missing service-role access -> English

## Staleness

Each translation is bound to:

- `report_id`
- `report_version`
- `source_content_version`
- `source_text_snapshot`

If the English source summary changes, the old translation is marked `stale_due_to_source_change` and is no longer served.

## UI behavior

The shell remains localized as in Batch 16.

When translated summary text is active:

- the shell shows a small pilot badge
- the copy explains that Spanish summary text is pilot-only
- the English source summary remains authoritative

When translation is unavailable or unsafe, the same shell falls back to the existing English summary observations.

## Rollback

- set `ENABLE_PATIENT_SAFE_SUMMARY_TRANSLATION_PILOT=false`
- rebuild

This disables the live translated narrative pilot while leaving stored additive translation rows untouched.
