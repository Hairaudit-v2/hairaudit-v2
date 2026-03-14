# Auditor Capacity Review (Patient + Doctor + Clinic + Internal)

This review verifies auditor operational capacity after the expanded Doctor/Clinic schema rollout and documents remaining scale gaps.

## A. Current Auditor Capabilities

- Source-aware queueing supports `patient`, `doctor`, `clinic`, and `internal` submission sources (derived from `audit_type`, `submission_channel`, `visibility_scope`).
- Auditor dashboard supports lifecycle actions:
  - open/mark in progress
  - request more information
  - mark needs manual review
  - suppress public visibility
  - archive
  - safe delete (with reason)
- Auditor case workspace supports:
  - manual score overrides
  - section feedback
  - confidence/evidence review surfaces
  - rerun controls and rerun history
- Doctor and Clinic expanded fields render in auditor case view with structured per-field output (including multi-select, advanced/forensic fields, and graft-tray-specific fields).

## B. Gaps Preventing Doctor/Clinic Manual Audit At Scale

- Field provenance is now supported, but legacy submissions may have sparse provenance until re-saved.
- Follow-up inheritance comparison is currently surfaced as practical delta summaries, not a fully normalized baseline/follow-up relational model.
- Evidence sufficiency/confidence readiness are visible in multiple panels, but not yet unified into a single persisted triage record.
- Escalation-to-second-reviewer exists at API metadata level but still needs a dedicated queue lane in dashboard UX.

## C. Required Schema/UI/Backend Changes

Implemented in this pass:

- Added field provenance support for Doctor/Clinic answers and auditor rendering.
- Added queue source filter + badges for:
  - Patient Submissions
  - Doctor Submissions
  - Clinic Submissions
  - Follow-Up Audits
  - Advanced / Forensic Audits
  - Needs Manual Input
  - Awaiting More Info
  - Ready to Review
  - Completed
  - Archived
- Added evidence-priority and follow-up-delta panels in auditor case workspace.

Recommended next:

- Add explicit persisted `audit_source` column for canonical source semantics.
- Add normalized follow-up linkage fields on `cases` (e.g., original surgery case id, follow-up chain id).
- Add dedicated auditor queue lanes for second-review escalations and visibility suppressions.

## D. Rerun Support Status

Implemented:

- Rerun actions support:
  - AI audit regen
  - scoring regen alias
  - evidence analysis regen alias
  - graft integrity regen
  - report generation/PDF regen
  - full reaudit
  - full reaudit (latest submission alias)
  - full reaudit (original + follow-up linkage alias)
- Tracking now includes:
  - `rerun_count`
  - `last_rerun_at`
  - `last_rerun_by`
  - `processing_log`

Schema migration:

- `supabase/migrations/20260315000002_auditor_rerun_tracking.sql`

## E. Follow-Up Audit Support Status

Implemented:

- Follow-up mode in Doctor/Clinic forms with inherited baseline and changed-only editing support.
- Auditor case detail shows:
  - inherited/baseline-aware field provenance
  - changed-fields-only delta summary between report versions
  - follow-up evidence emphasis panel

Remaining:

- Persist a first-class original-surgery-to-follow-up linkage key for deterministic chain navigation and rerun policy.

## F. Delete / Archive / Duplicate Handling Status

Implemented:

- Archive and delete (safe-delete) are active lifecycle actions.
- Suppress-public-visibility action now available to auditors.

Remaining:

- Add explicit duplicate resolution state and merge/supersede workflow for abandoned/duplicate audits.
- Add explicit “delete as junk” reason taxonomy and reporting.

## G. Recommended Implementation Priority

1. **Canonical source + follow-up linkage model**  
   Add explicit DB columns (`audit_source`, `original_case_id`, `followup_chain_id`) to reduce inference drift.
2. **Second-review queue lane**  
   Promote escalation metadata into top-level dashboard section with assignment workflow.
3. **Normalized triage record**  
   Persist completeness/evidence/confidence/manual-readiness into a single queryable table or materialized view.
4. **Duplicate-resolution workflow**  
   Add explicit duplicate/superseded states with safe merge/archive actions.
5. **Historical provenance backfill**  
   Backfill provenance tags for existing doctor/clinic submissions where feasible.
