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

## Batch 20 operational hardening

Batch 20 adds internal operational controls without expanding pilot scope:

- auditor-only ops endpoint: `src/app/api/auditor/patient-safe-summary-translation/route.ts`
- auditor-only case-page panel: `src/app/cases/[caseId]/PatientSafeSummaryTranslationOpsPanel.tsx`
- resolver trace/fallback fields in `PatientSafeSummaryNarrativePresentation`

### Internal status visibility

The auditor ops panel reports:

- pilot flag status
- requested locale and target locale
- whether a stored translation row exists
- translation status (`generated_unreviewed`, `reviewed_approved`, `stale_due_to_source_change`, etc.)
- review status (`not_reviewed`, `approved`, `rejected`)
- current serve decision and fallback reason
- translation provenance marker

### Regeneration / refresh workflow

Auditors can trigger a bounded translation refresh for the latest report snapshot:

1. Open case page as auditor.
2. Use **Regenerate translation**.
3. The server recomputes from the current English source snapshot and upserts only the `patientSafeSummaryNarrative` overlay.

No report scoring/finalize/PDF flows are called.

### Review workflow

Auditors can set pilot review status:

- **Mark approved** -> `review_status=approved`, `translation_status=reviewed_approved`
- **Mark rejected** -> `review_status=rejected` (translation is not served)
- **Reset review** -> `review_status=not_reviewed`, `translation_status=generated_unreviewed`

These controls affect only pilot translation rows in `report_narrative_translations`.

## Batch 21 review workflow refinement

Batch 21 improves auditability of human review decisions without expanding translation scope.

### Added review action metadata

`report_narrative_translations` now tracks:

- `last_review_action` (`approved` | `rejected` | `reset_review`)
- `last_review_action_at`
- `last_review_action_by`

Existing review fields remain in use:

- `review_status`
- `reviewed_at`
- `reviewer_id`
- `review_notes`

### Review rigor rules

- rejection now requires a review note/rationale
- approve/reject/reset actions capture who acted and when
- stale detection still prevents serving outdated translations even if they were previously approved

### Auditor UX

The ops panel now shows:

- current translation status + review status
- reviewer identity / reviewed timestamp
- last review action metadata
- persisted review note

This remains auditor-only internal tooling and is not shown to patients.
