# Translated narrative contract (Batch 17)

This batch defines the future contract for translated report narrative content without enabling broad live AI translation, translated PDFs, or report-wide patient-visible narrative switching.

Batch 19 later adds one narrow live exception for the patient-safe summary pilot only. See `docs/i18n-patient-safe-summary-translation-pilot.md`.

## Current boundary

The current source narrative language remains English:

- English report narrative stays canonical
- patient-safe summary shell may be localized
- generated narrative, findings, recommendations, and PDF output remain unchanged
- finalize, scoring, storage, and AI prompt behavior remain unchanged

## Contract surface

`src/lib/i18n/reportTranslationBlueprint.ts` now includes a dedicated additive contract for future translated narrative overlays:

- `ReportNarrativeTranslationStatus`
- `ReportNarrativeTranslationReviewStatus`
- `ReportNarrativeTranslationSection`
- `ReportNarrativeSourceSnapshot`
- `ReportNarrativeTranslationBundle`
- `ReportNarrativeTranslationStorageBinding`

The contract is intentionally separate from current generators. It is a blueprint for future storage and read paths only.

## Lifecycle states

`ReportNarrativeTranslationStatus` models the end-to-end state for a translated section:

- `not_requested`: no translation job has been requested for this section/locale
- `pending_generation`: queued or in progress, with no generated output yet
- `generated_unreviewed`: machine-generated output exists but is not approved for patient-visible delivery
- `reviewed_approved`: reviewed and approved for future locale rollout
- `stale_due_to_source_change`: source English changed after translation generation or approval

`ReportNarrativeTranslationReviewStatus` keeps review bookkeeping separate:

- `not_reviewed`
- `review_required`
- `approved`
- `rejected`

This separation lets future rollout logic distinguish "translation exists" from "translation may be shown".

## Storage strategy

Future translated narrative should attach to an immutable report snapshot, not to a mutable user or case locale preference.

Recommended attachment model:

- scope: `report_version_snapshot`
- primary anchor: `reportId`
- secondary anchors: `caseId`, `reportVersion`
- optional snapshot marker: `summaryReleaseKey`

Why this shape:

- translations remain tied to the exact English source version they were derived from
- stale detection is straightforward when English source changes
- translated overlays can be added later without replacing canonical English report content
- future PDF or render layers can opt in safely by versioned read logic

Recommended future persistence pattern:

1. Keep canonical English narrative in the existing report data.
2. Store translated overlays in a separate JSON column or sidecar document keyed by report version snapshot.
3. Let future render layers explicitly choose English or reviewed translated overlays.
4. Never overwrite canonical English narrative text with translated text.

## Source snapshot and stale detection

Each translated section should store a `ReportNarrativeSourceSnapshot` containing:

- `locale`: current canonical narrative locale, still `en`
- `sourceContentLocale`: locale of original evidence when known, otherwise `und`
- `text`: source English snapshot used to generate the translation
- `capturedAt`: when the English snapshot was taken
- `contentVersion`: optional immutable marker such as `report:v3:findings`

Staleness should be detected by:

1. comparing `contentVersion` when available
2. otherwise comparing normalized English source text snapshots

Batch 17 adds `isReportNarrativeTranslationStale(...)` as a small pure helper for this future logic.

## Risk and review guidance

These categories are intentionally separated because they do not carry the same review risk:

- `app_owned_shell`: app-authored framing and labels; machine translation is acceptable, human review recommended before broad release
- `patient_safe_generated`: patient-facing generated summary prose; machine translation may be generated, but human review should be required before patient-visible delivery
- `patient_visible_clinical`: findings and recommendations that may affect interpretation; human review should be required
- `clinician_internal`: internal/clinical-only narrative; machine translation may assist internal workflows, but review expectations should stay strict
- `structured_data`: lower-risk structured score labels or similar overlays; review recommended
- `metadata`: non-narrative storage metadata; review not required

Patient-safe messaging is not the same as clinician/internal content:

- patient-safe messaging should prioritize clarity, caution, and non-diagnostic phrasing
- clinician/internal content may include denser technical phrasing and should not automatically inherit patient-safe release rules
- future rollout should gate patient-visible translated narrative more strictly than internal previews

## Release guidance

Even after translated narrative generation exists in the future, a section should only be eligible for display when all of the following are true:

- translation status is `reviewed_approved`
- review status is `approved`
- translated text is present
- the stored English source snapshot is not stale

Batch 17 adds `canServeReviewedNarrativeTranslation(...)` as a tiny pure helper for this future gate, but nothing currently calls it.

## Out of scope in this batch

- live translation generation
- translated PDF output
- replacing current English narrative in app or report views
- prompt changes for AI generation
- finalize/storage/runtime integration for translated narrative

The current patient-visible behavior remains: localized shell where available, English generated narrative everywhere else.
