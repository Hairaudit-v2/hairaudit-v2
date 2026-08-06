# HA-PRE-SURGERY-PROJECTION-REPORT-1A — Evidence

**Date:** 2026-08-06  
**Status:** GREEN (domain + unit suite + synthetic HTML smoke; remote migration pending apply)  
**Scope:** Approved immutable illustrative projection in Pre-Surgery Review web + PDF; auditor correction + learning signals

---

## Architecture discovered

### Two stacks (do not conflate)

| Stack | Role |
|-------|------|
| **HA-PROJECTION-1A–1G** | Post-surgery / longitudinal text DTOs + `hairaudit_projection_snapshots` |
| **HA-PRE-SURGERY-INTELLIGENCE-2A–2D** | Pre-surgery clinician workspace + illustrative imagery (`hairaudit_pre_surgery_projections`) |

**HA-PROJECTION-1B ↔ Pre-Surgery Intelligence 2A:** not productively connected (explicitly separated in docs/types). Report imagery reuses **2A–2D** only.

### Canonical entities / services

- Table: `hairaudit_pre_surgery_projections` (immutable snapshot bytes; supersession governed)
- Modes (reused): `conservative` | `planned` (≈ balanced) | `optimistic_within_approved_range` (≈ maximum visual coverage)
- Helpers: `selectReportEligibleProjections`, `buildClinicianReportSlice`, `decideReportProjectionInclusionAllowed`
- New resolver: `resolveIllustrativeProjectedResultForReport`
- Consistency: `validateProjectionReportConsistency` (fail closed on material conflicts)

### Report integration

- Freeze path: Inngest `generatePreSurgeryPlanningReport({ clinicianReportSlice })` via `loadClinicianReportSliceForCase`
- Pin: reissue keeps `pinnedProjectionId` / checksum — does not silently upgrade
- Web: `IllustrativeProjectedResultSection` after Estimated Graft Requirement
- PDF: `illustrativeProjectedResultHtml` + short-lived signed media in print route
- Paths: `pre_surgery_projections/{caseId}/…` added to case-scoped storage gate

---

## Auditor correction + AI learning (extension)

| Piece | Path |
|-------|------|
| Domain | `projectionCorrections.ts`, `projectionLearningSignals.ts` |
| Persistence | `hairaudit_pre_surgery_projection_corrections` (+ learning_signal JSON) |
| API | `GET/POST …/projection/corrections` (clinician/auditor only) |
| UI | `ProjectionAuditorCorrectionPanel` in professional workspace |
| Patient safety | Corrections **never** embedded in web/PDF patient report |

Corrections supersede via new rows; projection `storagePath` / `outputChecksum` are immutability-checked.

---

## Migration required

**Yes:** `supabase/migrations/20260806120000_hairaudit_pre_surgery_projection_report_1a.sql`

- New table `hairaudit_pre_surgery_projection_corrections` (RLS, service_role only)
- Expanded audit event types: inclusion/omit, correction recorded/adjusted, learning signal emitted

Apply remotely before production use of auditor corrections.

---

## Files changed (high level)

### Domain / report
- `src/lib/preSurgeryIntelligence/reportProjectionCopy.ts` (new)
- `src/lib/preSurgeryIntelligence/reportProjectionConsistency.ts` (new)
- `src/lib/preSurgeryIntelligence/reportProjectionInclusion.ts` (new)
- `src/lib/preSurgeryIntelligence/reportProjectionMedia.server.ts` (new)
- `src/lib/preSurgeryIntelligence/loadClinicianReportSlice.server.ts` (new)
- `src/lib/preSurgeryIntelligence/projectionCorrections.ts` (new)
- `src/lib/preSurgeryIntelligence/projectionLearningSignals.ts` (new)
- `src/lib/preSurgeryIntelligence/reportIntegration.ts`
- `src/lib/preSurgeryIntelligence/types.ts`, `auditTimeline.ts`, `index.ts`, `repository.server.ts`
- `src/lib/preSurgeryIntelligence/graftPlanTotals.ts` (deferredZones sync fix)
- `src/lib/reports/preSurgeryPlanningReport.ts`
- `src/lib/reports/illustrativeProjectedResultHtml.ts` (new)
- `src/lib/reports/PreSurgeryPlanningReportHtml.tsx`
- `src/lib/uploads/caseFilesPath.ts`

### UI / API
- `src/components/patient/IllustrativeProjectedResultSection.tsx` (new)
- `src/components/patient/PreSurgeryPlanningReportShell.tsx`
- `src/components/professional/ProjectionAuditorCorrectionPanel.tsx` (new)
- `src/components/professional/PreSurgeryIntelligenceWorkspace.tsx`
- `src/app/api/cases/[caseId]/pre-surgery-intelligence/projection/report-media/route.ts` (new)
- `src/app/api/cases/[caseId]/pre-surgery-intelligence/projection/corrections/route.ts` (new)
- `src/app/api/print/report/route.ts`
- `src/lib/inngest/functions.ts`

### Tests / evidence
- `tests/preSurgeryProjectionReport1a.test.ts` (new) — **16/16 pass**
- `scripts/smokePreSurgeryProjectionReport1a.ts` (new)
- `tmp/pre-surgery-projection-report-1a/*.html` synthetic fixtures
- Regression: `preSurgeryIntelligence2b` + `preSurgeryAuditPdf` + `preSurgeryPlanningReport` — **26/26 pass**

---

## Security review

| Control | Result |
|---------|--------|
| No permanent public projection URLs in frozen report | PASS (paths stripped) |
| Case-scoped storage gate includes `pre_surgery_projections/{caseId}` | PASS |
| Cross-case projection rejected | PASS (unit) |
| Patient media route verifies report pin + case ownership | PASS (code path) |
| Auditor corrections internal-only | PASS |
| Learning signals de-identified (no raw case id / note body) | PASS |

---

## Clinical-copy review

| Requirement | Result |
|-------------|--------|
| Required intro + limitation panel | PASS |
| No prohibited guarantee language | PASS (unit) |
| Modes display as Conservative / Balanced / Maximum visual coverage | PASS |
| Deferred crown textual + grafts=0 | PASS |
| Discussion-only gate for not-recommended-yet | PASS |

---

## Verdict

**GREEN** for domain behaviour, patient report inclusion rules, PDF/web render paths, auditor correction domain, learning-signal shape, and unit evidence.

**AMBER** only for operational deploy: remote migration not applied in this session; live ImagingOS/real-image browser screenshots not captured (synthetic SVG/HTML smoke used as agreed).
