# AuditOS Stage 4A — Scoring & Report Pipeline Map

This document captures the **current** HairAudit audit/scoring/report pipeline as implemented today. It supports Stage 4A boundaries only; it does **not** prescribe schema or scoring changes.

## 1. End-to-end flow (happy path)

1. **Case creation** — `POST /api/cases/create` or legacy `POST /cases/create` → `handlePostCreateAuditCaseRoute` → `createAuditCase` (`src/lib/cases/createCase.ts`, `src/lib/cases/createAuditCasePostHandler.server.ts`). Optional integration hook: `emitHairAuditEvent("hairaudit.case.created", …)` (`src/lib/integrations/emit.ts`).
2. **Answers & uploads** — Patient/doctor/clinic answers and photos via `/api/patient-answers`, `/api/doctor-answers`, `/api/clinic-answers`, `/api/uploads/*`.
3. **Submit** — `POST /api/submit` (`src/app/api/submit/route.ts`) validates gates, updates `cases`, emits Inngest **`case/submitted`** (and may emit other events for contribution flows).
4. **Inngest `run-audit`** (`src/lib/inngest/functions.ts`, id `run-audit`) — triggered by `case/submitted` or `case/audit-only-requested`:
   - Load case, uploads, existing report summary (answers).
   - **Evidence preparation** — `prepareCaseEvidenceManifest` (`src/lib/evidence/prepareCaseEvidence.ts`): Sharp-based image prep, `case_evidence_manifests` row, `CaseEvidenceManifest` (`src/lib/evidence/evidenceManifest.ts`).
   - **AI forensic audit** — `runAIAudit` (`src/lib/ai/audit.ts`) using prepared vision inputs; returns `AIAuditResult` (section scores, key findings, red flags, photo observations, `data_quality`, etc.).
   - **Deterministic domain scoring (v1)** — `computeDomainScoresV1` (`src/lib/benchmarks/domainScoring.ts`) combines AI output + uploads + case evidence scores → domains, tiers, overall `performance_score`, etc.
   - **Optional GPT narrative** — `runDoctorScoringNarrative` (`src/lib/ai/runDoctorScoringNarrative.ts`) merges **whitelist** narrative fields into persisted `doctor_answers.scoring` (numbers stay deterministic).
   - **Report row** — `reports` insert with monotonic `version`, large `summary` JSON (forensic block, key metrics, eligibility fields, `image_ingestion_stats`, etc.).
   - **PDF** — `renderAndUploadPdfForCase` (`src/lib/reports/renderPdfInternal.ts`) → internal print URL → Playwright (`src/lib/pdf/generateReportPdf.ts`); path `{caseId}/v{version}.pdf`.
5. **Inngest `run-graft-integrity-estimate`** — parallel to audit on submit; `runGraftIntegrityModelEstimate` / `runGraftIntegrityEstimate` (`src/lib/ai/graftIntegrity.ts`) → `graft_integrity_estimates` (`src/lib/inngest/functions.ts`).
6. **Human review** — Auditors: GII approve/override (`src/app/api/auditor/graft-integrity/review/route.ts`, UI `GraftIntegrityReviewPanel.tsx`); domain score overrides in `audit_score_overrides` applied in **read path** via `applyAuditorOverridesToSummary` (`src/lib/auditor/applyOverrides.ts`) on case/report HTML pages — stored AI summary is not rewritten.
7. **Rerun** — `POST /api/auditor/rerun` → `auditor/rerun` → `auditorRerun` dispatches `regenerate_ai_audit`, `regenerate_graft_integrity`, `rebuild_pdf`, or `full_reaudit` (`queueAuditorRerun.ts`, `functions.ts`).

Other jobs: `run-pdf-rebuild`, `caseSubmitted` (separate file), `runSurgeryUploadEvidenceReviewReport`, contribution reminders, historical GII backfill (`src/lib/inngest/functions/*.ts`, `src/app/api/inngest/route.ts`).

## 2. Scoring inputs (today)

| Source | What flows in | Where defined / produced |
|--------|----------------|---------------------------|
| Rubric + structured answers | `scoreAudit(rubric, answers)` for legacy/HTML recomputation | `src/lib/audit/score.ts`, consumers e.g. `src/app/reports/[caseId]/html/page.tsx`, `src/app/api/print/legacy-report/route.ts` |
| Patient/doctor/clinic answers | Merged into `reports.summary` and passed to `runAIAudit` | Inngest `load-report-summary`, `src/lib/ai/audit.ts` (`AIAuditInput`) |
| Prepared images | Base64 vision payloads from evidence manifest | `prepareCaseEvidence.ts` → `loadPreparedModelImageInputs` |
| Uploads metadata | Evidence coverage, GII donor/recipient selection, domain scoring context | `functions.ts`, `domainScoring.ts`, `graftIntegrity.ts` |
| Case row | `evidence_score_doctor`, `evidence_score_patient`, linkage | `cases` select in Inngest |

## 3. Scoring outputs (today)

| Output | Shape / storage | Notes |
|--------|------------------|--------|
| Rubric engine | `ScoreOutput` — `overall_score`, `grade`, `confidence`, `component_scores` | `src/lib/audit/score.ts` |
| AI audit | `AIAuditResult` — section scores, key findings, confidence 0–1, etc. | `src/lib/ai/audit.ts` |
| Forensic + v1 domains | Nested under `summary.forensic_audit`, `domain_scores_v1`, `doctor_answers.scoring`, tiers | Written in Inngest `insert-report-row` |
| Top-line summary | `score`, `donor_quality`, `graft_survival_estimate`, `findings`, `notes` | Same `summary` blob |
| GII | Row in `graft_integrity_estimates` + optional summary references | Separate from rubric score |

## 4. Report version ownership

- **Authoritative version** — `reports.version` per `case_id`; next version = max existing + 1 (`run-audit` step `next-version`).
- **Pipeline state** — `reports.status` / `cases.status` updated via `setReportPipelineStatus` / `setCasePipelineStatus` (`functions.ts`) through phases (`processing`, `pdf_ready` / `complete`, `failed`, etc.).
- **PDF artifact** — Stored path on report row; file name convention `v{version}.pdf`.
- **Evidence manifest** — `case_evidence_manifests` linked by `case_id` / manifest `id` referenced in `image_ingestion_stats.manifest_id` inside summary.

## 5. Human override points

- **Domain / forensic display** — `audit_score_overrides` + `applyAuditorOverridesToSummary` (UI/HTML/PDF read paths may differ; see `WORKFLOW_INTEGRATION.md`).
- **GII** — Auditor status, numeric overrides, notes via graft integrity review API; DB `graft_integrity_estimates.auditor_*`.
- **Auditor rerun** — New audit version or targeted job replay without changing historical row invariants (depends on action).

## 6. PDF / HTML rendering

- **Elite / internal print** — `GET /api/print/report`, `src/app/api/print/report/route.ts`, `buildReportViewModel`, patient narrative templates.
- **Legacy print** — `GET /api/print/legacy-report`, `src/app/api/print/legacy-report/route.ts`.
- **Public HTML report** — `src/app/reports/[caseId]/html/page.tsx` (may recompute `scoreAudit` for display).
- **Orchestration** — `renderPdfInternal.ts` → internal fetch of print route → PDF upload.

## 7. Risky coupling points (Stage 4B watch list)

1. **Monolithic `summary` JSON** — Consumers assume nested keys (`forensic_audit`, `forensic`, `patient_answers` vs `patient_audit_v2`); high drift risk.
2. **Dual scoring paths** — `scoreAudit` (rubric) vs `runAIAudit` + `computeDomainScoresV1` (production path); HTML/legacy may recompute and optionally persist (`legacy-report` route).
3. **Override application** — Applied in memory in some routes only; PDF pipeline must stay consistent with patient-visible score rules.
4. **Inngest step size** — `functions.ts` is a single large module coupling evidence, AI, scoring, PDF, email, transparency refresh.
5. **GII vs audit timing** — Report insert may read “latest” GII before auditor approval; ordering assumptions matter for PDF copy.
6. **Two integration-style event gates** — `INTEGRATION_EVENTS_ENABLED` (`emitHairAuditEvent`) vs new **`HAIRAUDIT_FI_EVENTS_ENABLED`** (`emitAuditOsEvent` in `emitAuditOsEvent.server.ts`); document which gate applies for FI network emission.

## 8. Stage 4A AuditOS artifacts (this PR)

| Boundary | Location |
|----------|-----------|
| Versioned scoring types | `src/lib/auditos/scoring/types.ts` |
| Legacy → scoring output adapter | `src/lib/auditos/scoring/adaptExistingAuditScore.ts` |
| Evidence manifest (read model) | `src/lib/auditos/evidence/types.ts`, `buildEvidenceManifestFromLegacy.ts` |
| Normalized report (read model) | `src/lib/auditos/reports/types.ts`, `adaptLegacyReportModel.ts` |
| FI event adapter (off by default) | `src/lib/auditos/events/emitAuditOsEvent.server.ts` |

No change to stored scoring values, PDF output, or patient-facing UI in Stage 4A.
