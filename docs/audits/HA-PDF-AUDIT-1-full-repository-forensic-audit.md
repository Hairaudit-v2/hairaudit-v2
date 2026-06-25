# HA-PDF-AUDIT-1 — Full Repository Forensic Audit

**Date:** 2026-06-25  
**Scope:** Read-only inventory of all report/PDF pathways — no code changes.  
**Auditor:** Cursor agent (HA-PDF-AUDIT-1)

---

## Executive Summary

HairAudit currently runs **at least four distinct report-generation stacks** in parallel:

1. **Production clinical PDF** — Playwright (default) or PDFKit (`PDF_RENDERER=pdfkit`) rendering HTML from `GET /api/print/report`, with **three HTML templates** (post-surgery, pre-surgery, elite fallback) selected by `patient_review_pathway` + `auditMode`.
2. **Legacy inline HTML print** — `GET /api/print/legacy-report` (rubric recompute via `scoreAudit`, older layout). Instrumented for retirement but **still deployed and reachable** with token or session auth. **Not wired to UI** but not disabled.
3. **Session HTML preview** — `/reports/[caseId]/html` (React page + `scoreAudit`; auditor-facing). Parallel to legacy print, different implementation.
4. **Non-clinical PDFs** — demo report + long-term patient education guide (public, no case auth).

Additionally, **surgery-upload evidence review PDFs** (`src/lib/reports/surgeryUpload/buildSurgeryEvidenceReviewPdf.ts`) form a **separate pipeline** from patient audit reports.

**Top risks:**

| # | Risk | Severity |
|---|------|----------|
| 1 | **Pre-surgery report uses raw `clinicianNotes` as fallback** in `preSurgeryPlanningReport.ts` without `sanitizePatientReportText` — can leak `"Forensic hair-loss classification (rule-based placeholder)."` into patient PDF/web. Post-surgery path sanitizes; pre-surgery does not. | **High** |
| 2 | **Three coexisting HTML renderers + legacy route + PDFKit path** for the same underlying case data — template drift, duplicate section logic, and inconsistent sanitization. | **High** |
| 3 | **Report bodies are English-only** (`src/lib/i18n/report.ts`) while UI shells use i18n — Spanish patients see English PDF content; `longTermPreservation` i18n block exists in `en.json` but is **missing from `es.json`**. | **Medium** |
| 4 | **Elite fallback still used** for non-pathway or professional modes — patient-facing elite HTML uses `"Forensic evidence board"` label when `auditMode !== patient` but can still surface for edge cases where pathway template gates fail. | **Medium** |
| 5 | **Legacy/orphan utilities** (`renderRadarChart.ts`, `elitePrintPhotoPipeline.ts`, `DomainScoreCards.tsx`, `AuditScoreBadge.tsx`) increase confusion during cleanup. | **Low** |

**Verdict:** Multiple report generations **definitely coexist**. Production path is clear (`renderPdfInternal` → `/api/print/report`), but legacy routes, duplicate renderers, and one unsanitized intelligence fallback create **real patient-facing leak risk**.

---

## Report/PDF File Inventory

**Total report/PDF-related files identified: 127**

Breakdown: `src/lib/reports/**` (47), `src/lib/pdf/**` (12), `src/components/reports/**` (18), patient report/guide components (8), API routes (13), app pages (6), tests (25+), docs/scripts (8).

| Path | Type | Likely purpose | Status | Importers / callers | Risk notes |
|------|------|----------------|--------|---------------------|------------|
| `src/lib/reports/renderPdfInternal.ts` | utility / pipeline | Core PDF upload orchestrator | **active** | Inngest, `internal/render-pdf`, `rebuildReportPdf` | Single production entry for case PDFs |
| `src/lib/reports/rebuildReportPdf.ts` | utility | Manual/auto PDF rebuild + persist `pdf_path` | **active** | Download recovery, auditor rebuild, Inngest | |
| `src/lib/reports/pdfUrl.ts` | utility | Builds signed `/api/print/report` URL | **active** | `renderPdfInternal` only | |
| `src/lib/reports/pdfReadiness.ts` | utility | Gates PDF generation on audit readiness | **active** | Print route, Inngest, rebuild | |
| `src/lib/reports/pdfPathCaseId.ts` | utility | Extract caseId from storage path | **active** | `reportAccess`, signed-url | |
| `src/lib/reports/pdfUrl.ts` | utility | Print URL builder | **active** | `renderPdfInternal` | |
| `src/lib/reports/getBaseUrl.ts` | utility | Base URL for server-side PDF fetch | **active** | render internal, demo/guide routes | |
| `src/lib/reports/internalRenderToken.ts` | utility | HMAC render tokens for print routes | **active** | All print routes, E2E helpers | |
| `src/lib/reports/reportAccess.ts` | utility | Download authorization | **active** | Download routes, signed-url | |
| `src/lib/reports/reportPdfDownloadRecovery.ts` | utility | Stream PDF or auto-rebuild | **active** | Download routes | |
| `src/lib/reports/reportPdfRebuildPreflight.ts` | utility | Attach patient-safe summary before PDF | **active** | render internal, rebuild | |
| `src/lib/reports/fetchReportPdfFromStorage.ts` | utility | Fetch stored PDF blob | **active** | Inngest, download recovery | |
| `src/lib/reports/legacyReportUsageLog.ts` | utility | Logs legacy route usage | **active (legacy instrumentation)** | `legacy-report/route.ts` | Retirement candidate |
| `src/lib/reports/forensicReportsFilter.ts` | utility | Filter forensic vs evidence-review rows | **active** | Case page, Inngest, status API | |
| `src/lib/reports/accessMode.ts` | utility | Resolve audit mode for HTML viewer | **active** | html page, legacy-report | |
| `src/lib/reports/reportSharingCopy.ts` | translation | Share button copy | **active** | `ReportShareButton` | |
| `src/lib/reports/postSurgeryAuditReport.ts` | data builder | Post-surgery report model + generator | **active** | Case page, print route, Inngest, shells | Uses `sanitizePatientReportText` |
| `src/lib/reports/preSurgeryPlanningReport.ts` | data builder | Pre-surgery report model + generator | **active** | Case page, print route, Inngest, shells | **Uses raw `clinicianNotes` fallback — risk** |
| `src/lib/reports/patientSafeSummary.ts` | data builder | Patient-safe summary structure | **active** | All pathways, elite HTML, preflight | English-only generated body |
| `src/lib/reports/patientSafeSummaryDisclosure.ts` | utility | Disclosure state for shells | **active** | Patient shells | |
| `src/lib/reports/patientSafeSummaryNarrativeTranslation.ts` | translation | Narrative translation presentation | **active** | Case page, auditor API | |
| `src/lib/reports/patientSafeSummaryTranslationQueue.ts` | translation | Auditor translation queue | **active** | Auditor dashboard | |
| `src/lib/reports/postSurgeryPatientText.ts` | translation / copy | Sanitization + image-limited notices | **active** | `postSurgeryAuditReport`, tests | Critical safety filter |
| `src/lib/reports/postSurgeryReportLabels.ts` | translation | EN labels for post HTML/PDF | **active** | Print route, tests | Hardcoded EN in PDF |
| `src/lib/reports/preSurgeryReportLabels.ts` | translation | EN labels for pre HTML/PDF | **active** | Print route, tests | Hardcoded EN in PDF |
| `src/lib/reports/PostSurgeryAuditReportHtml.tsx` | renderer | Post-surgery PDF/HTML template | **active** | `/api/print/report` | Duplicated sections with Pre |
| `src/lib/reports/PreSurgeryPlanningReportHtml.tsx` | renderer | Pre-surgery PDF/HTML template | **active** | `/api/print/report` | Duplicated sections with Post |
| `src/lib/reports/EliteReportHtml.tsx` | renderer | Universal/elite fallback template | **active** | `/api/print/report` (fallback) | `"Forensic evidence board"` in non-patient mode |
| `src/lib/reports/DemoReportHtml.tsx` | renderer | Marketing demo report | **active (demo)** | demo print/PDF routes | |
| `src/lib/reports/PatientLongTermGuideHtml.ts` | renderer | Long-term guide PDF HTML | **active** | guide print/PDF routes | Public |
| `src/lib/reports/demoReportData.ts` | data builder | Static demo data | **active (demo)** | DemoReportHtml | |
| `src/lib/reports/patientLongTermGuide.ts` | data builder | Guide content (EN/ES) | **active** | Guide routes, web page | |
| `src/lib/reports/patientLongTermHairEducation.ts` | data builder | Elite-only education blocks | **active** | EliteReportHtml | |
| `src/lib/reports/patientDomainAssessment.ts` | data builder | Domain score → patient labels | **active** | EliteReportHtml | |
| `src/lib/reports/patientNarrativeTemplates.ts` | data builder | Elite patient narratives | **active** | EliteReportHtml | |
| `src/lib/reports/patientConcernBands.ts` | data builder | Concern band logic | **active** | Summary, shells, elite | Shared — good |
| `src/lib/reports/patientPdfReviewAreas.ts` | data builder | PDF review risk areas | **active** | Print routes (both) | |
| `src/lib/reports/patientWhatHappensNext.ts` | data builder | Next-step copy | **active** | patientSafeSummary | |
| `src/lib/reports/patientWhatToMonitorOverTime.ts` | data builder | Monitoring copy (elite) | **active** | EliteReportHtml | |
| `src/lib/reports/clinicalEvidenceGallery.ts` | data builder + HTML | Photo gallery sections | **active** | Post/Pre HTML + React gallery | Duplicated in 2 renderers |
| `src/lib/reports/longTermHairPreservation.ts` | data builder + HTML | Preservation section | **active** | Post/Pre HTML + React | Duplicated |
| `src/lib/reports/futureHairLossProgressionRisk.ts` | data builder + HTML | Progression risk section | **active** | Post/Pre HTML + React | Duplicated |
| `src/lib/reports/reviewInputsProcessed.ts` | data builder + HTML | Inputs processed section | **active** | Post/Pre HTML + React | Duplicated |
| `src/lib/reports/assessmentConfidence.ts` | data builder + HTML | Confidence scoring | **active** | Post/Pre HTML + React | Uses imageLimited/documentAssisted |
| `src/lib/reports/assessmentImprovementRecommendations.ts` | data builder + HTML | Improvement recs | **active** | Post/Pre HTML + React | |
| `src/lib/reports/radarSvg.ts` | utility | Radar chart SVG | **active** | EliteReportHtml, DemoReportHtml | |
| `src/lib/reports/surgicalFingerprint.ts` | data builder | Elite fingerprint section | **active** | EliteReportHtml | |
| `src/lib/reports/surgeryUpload/buildSurgeryEvidenceReviewPdf.ts` | renderer | Surgery evidence PDF (PDFKit) | **active (separate product)** | Inngest stage 7b | Not patient audit report |
| `src/lib/reports/surgeryUpload/surgeryEvidenceReviewPdfModel.ts` | data builder | Evidence review model | **active** | buildSurgeryEvidenceReviewPdf | |
| `src/lib/pdf/generateReportPdf.ts` | utility / pipeline | Playwright PDF from print URL | **active** | render internal, demo, guide | URL allowlist guard |
| `src/lib/pdf/reportBuilder.ts` | data builder + PDFKit renderer | View model + PDFKit builder | **active** | Print routes, render internal | PDFKit omits radar |
| `src/lib/pdf/pdfEnvConfig.ts` | config | PDF env (renderer, timeouts) | **active** | Most pdf/* modules | |
| `src/lib/pdf/normalizeReportTemplateForPdf.ts` | utility | Template header validation | **active** | generateReportPdf, print/report | |
| `src/lib/pdf/maybePostProcessAuditPdf.ts` | utility | qpdf linearization | **active** | generateReportPdf | |
| `src/lib/pdf/qpdfReadiness.ts` | utility | qpdf availability check | **active** | generateReportPdf | |
| `src/lib/pdf/pdfGenerationMetrics.ts` | utility | PDF gen metrics | **active** | generateReportPdf | |
| `src/lib/pdf/elitePrintPhotoSignedUrlPipeline.ts` | utility | Signed URLs for print photos | **active** | print/report | |
| `src/lib/pdf/elitePrintPhotoPipeline.ts` | utility | Legacy photo pipeline | **legacy / unused** | None in src | Superseded |
| `src/lib/pdf/optimizeRasterForPrintPdf.ts` | utility | Raster optimization | **uncertain** | elitePrintPhotoPipeline, tests only | |
| `src/lib/pdf/renderRadarChart.ts` | utility | Radar chart (non-SVG) | **legacy / unused** | None | HTML uses radarSvg |
| `src/lib/pdf/README-PDF-ROLLOUT.md` | config | Ops doc | **active** | — | |
| `src/app/api/print/report/route.ts` | route + orchestrator | Primary print HTML | **active** | Playwright pipeline | Template router |
| `src/app/api/print/legacy-report/route.ts` | route + inline renderer | Legacy print HTML | **legacy** | No UI links | Retirement candidate |
| `src/app/api/print/demo-report/route.ts` | route | Demo HTML | **active (demo)** | Demo pages | Public |
| `src/app/api/print/patient-long-term-guide/route.ts` | route | Guide HTML | **active** | Guide PDF pipeline | Public |
| `src/app/api/reports/[reportId]/download/route.ts` | route | Primary PDF download | **active** | All patient download UX | |
| `src/app/api/reports/download/route.ts` | route | Legacy `?reportId=` download | **legacy** | No UI references | |
| `src/app/api/reports/signed-url/route.ts` | route | Storage signed URL | **active** | SurgeryUploadReviewPanel | |
| `src/app/api/reports/demo-pdf/route.ts` | route | Demo PDF bytes | **active (demo)** | Demo CTAs | Public |
| `src/app/api/reports/patient-long-term-guide/route.ts` | route | Guide PDF bytes | **active** | Rewrite + dashboard | Public |
| `src/app/api/internal/render-pdf/route.ts` | route | Internal PDF render | **active** | finalize, build-pdf | API key auth |
| `src/app/api/internal/build-pdf/route.ts` | route | Proxy to render-pdf | **uncertain** | Documented; Inngest uses lib directly | |
| `src/app/api/auditor/rebuild-pdf/route.ts` | route | Auditor manual rebuild | **active** | RebuildPdfPanel, auditor UI | |
| `src/app/api/debug/reports/route.ts` | route | Dev debug summary keys | **active (dev only)** | No UI | Dev guard |
| `src/app/api/auditor/report-status/route.ts` | route | Report review status | **active** | Auditor workflow | Not PDF gen |
| `src/app/reports/[caseId]/html/page.tsx` | route + viewer | Auditor HTML preview | **active** | AuditorReviewPanel | Uses scoreAudit, not pathway templates |
| `src/app/cases/[caseId]/download-report.tsx` | component | Download link | **active** | Case page, dashboards | |
| `src/app/cases/[caseId]/RebuildPdfPanel.tsx` | component | Auditor rebuild UI | **active** | Case page | |
| `src/app/cases/[caseId]/page.tsx` | page | Patient report shells + forensic UI | **active** | — | Dual pathway entry |
| `src/app/dashboard/patient/reports/page.tsx` | page | Patient reports list | **active** | — | |
| `src/app/post-op-hair-protection-guide/page.tsx` | page | Guide web view | **active** | — | Unlock-gated content |
| `src/app/demo-report/*` | page | Demo report marketing | **active (demo)** | — | |
| `src/components/patient/PostSurgeryAuditReportShell.tsx` | component | In-app post report | **active** | Case page | Mirrors Post HTML |
| `src/components/patient/PreSurgeryPlanningReportShell.tsx` | component | In-app pre report | **active** | Case page | Mirrors Pre HTML |
| `src/components/patient/PatientSafeSummaryShell.tsx` | component | Safe summary UI | **active** | Case page | |
| `src/components/patient/PatientConcernBandBanner.tsx` | component | Concern band banner | **active** | Shells | |
| `src/components/patient/PatientReportsCompletedCaseList.tsx` | component | Completed cases + download | **active** | Patient reports page | |
| `src/components/patient/PatientDashboardHliGuideCard.tsx` | component | Long-term guide unlock card | **active** | Patient dashboard | |
| `src/components/patient/PatientLongTermGuideSections.tsx` | component | Guide web sections | **active** | post-op guide page | |
| `src/components/patient/LongTermHairPreservationSection.tsx` | component | Preservation section (web) | **active** | Report shells | |
| `src/components/patient/AssessmentConfidenceSection.tsx` | component | Confidence (web) | **active** | Report shells | |
| `src/components/patient/AssessmentImprovementRecommendationsSection.tsx` | component | Improvement recs (web) | **active** | Report shells | |
| `src/components/reports/*` (18 files) | component | Auditor/clinic report UI | mostly **active** | Case page, auditor workflow | `DomainScoreCards`, `AuditScoreBadge` **orphan** |
| `src/lib/i18n/report.ts` | config | Report content locale policy | **active** | i18n system | Declares EN-only bodies |
| `src/lib/i18n/reportTerminology.ts` | translation | Glossary (not wired to PDF) | **active** | — | Not in PDF output |
| `src/lib/i18n/reportTranslationBlueprint.ts` | config | Future translation schema | **active** | — | Blueprint only |
| `src/lib/constants/patientGuide.ts` | config | Guide PDF paths | **active** | Dashboard, guide page | |
| `src/lib/hairaudit-intelligence/patient/patientIntelligenceTranslation.ts` | translation | Patient-safe intelligence bridge | **active** | Intelligence pipeline | Sanctioned bridge |
| `src/lib/hairaudit-intelligence/shadow/patientOutputSafety.ts` | utility | Leak assertion helpers | **active** | Tests, shadow pipeline | |
| `src/lib/hairaudit-intelligence/proceduralIntelligence.ts` | data builder | Engine (internal) | **active** | Intelligence bundle | Contains placeholder clinicianNotes |
| `src/lib/hairaudit-intelligence/hairLossClassification.ts` | data builder | Engine (internal) | **active** | Intelligence bundle | Contains placeholder clinicianNotes |
| `src/lib/hairaudit-intelligence/donorIntelligence.ts` | data builder | Engine (internal) | **active** | Intelligence bundle | |
| `src/lib/hairaudit-intelligence/repairSurgeryIntelligence.ts` | data builder | Engine (internal) | **active** | Intelligence bundle | |
| `src/lib/hairaudit-intelligence/shadow/*` | utility | Snapshot persistence/merge | **active** | Inngest, auditor | |
| `src/lib/auditos/reports/adaptLegacyReportModel.ts` | utility | Legacy → normalized adapter | **active** | AuditOS shadow | |
| `src/lib/auditos/reports/types.ts` | config | Normalized report types | **active** | AuditOS | |
| `src/lib/inngest/functions.ts` | utility | PDF gen on submit | **active** | Inngest | |
| `src/lib/inngest/functions/surgeryUploadEvidenceReviewReport.ts` | utility | Evidence PDF job | **active** | Inngest | Separate pipeline |
| `docs/hairaudit/legacy-report-retirement-runbook.md` | config | Legacy retirement ops | **active** | — | Route not retired |
| `docs/hairaudit/surgery-upload-stage-7b-evidence-review-report.md` | config | Evidence PDF doc | **active** | — | |
| `public/post-operative-hair-protection-guide.pdf` | config | Static fallback (excluded from trace) | **uncertain** | next.config excludes | Rewrite serves dynamic PDF |
| `scripts/lib/demoQaPdf.ts` | utility | QA PDF seeding | **active (dev)** | seed scripts | |
| `tests/*` (25+ report/PDF tests) | test | See Test Coverage section | **active** | — | |

---

## Active Report Routes

**Active API/page routes counted: 15** (13 API + 1 page viewer + 1 Next.js rewrite target)

| Route path | File | Methods | Input params | Report type | Renderer / builder | Data source | UI reachable? |
|------------|------|---------|--------------|-------------|-------------------|-------------|---------------|
| `/api/print/report` | `src/app/api/print/report/route.ts` | GET | `caseId`, `token`, `auditMode?`, `reportId?` | Clinical audit (post/pre/elite) | Post/Pre/Elite HTML renderers; `buildReportViewModel` | `reports.summary`, evidence manifest, intelligence snapshots, clinical history | Internal only (Playwright); not linked in UI |
| `/api/print/legacy-report` | `src/app/api/print/legacy-report/route.ts` | GET | `caseId`, `token?`, `auditMode?` | Legacy universal | Inline HTML + `scoreAudit` | Same DB sources | **No UI** — reachable via direct URL |
| `/api/print/demo-report` | `src/app/api/print/demo-report/route.ts` | GET | — | Demo | `DemoReportHtml` | Static `demoReportData` | Yes — demo-report page iframe |
| `/api/print/patient-long-term-guide` | `src/app/api/print/patient-long-term-guide/route.ts` | GET | `locale?` | Education guide | `PatientLongTermGuideHtml` | `patientLongTermGuide` | Yes — post-op guide page (preview link) |
| `/api/reports/[reportId]/download` | `src/app/api/reports/[reportId]/download/route.ts` | GET | path `reportId` | Stored clinical PDF | None (streams storage); recovery → `renderPdfInternal` | Supabase storage `pdf_path` | **Yes** — primary patient download |
| `/api/reports/download` | `src/app/api/reports/download/route.ts` | GET | `reportId` | Same as above | Same | Same | **No UI** — legacy URL shape |
| `/api/reports/signed-url` | `src/app/api/reports/signed-url/route.ts` | GET | `path` | Surgery evidence PDF | None | Storage path | Yes — surgery upload panel |
| `/api/reports/demo-pdf` | `src/app/api/reports/demo-pdf/route.ts` | GET | — | Demo PDF | Playwright → demo print | Static | Yes — demo CTAs |
| `/api/reports/patient-long-term-guide` | `src/app/api/reports/patient-long-term-guide/route.ts` | GET | `locale?` | Guide PDF | Playwright → guide print | `patientLongTermGuide` | Yes — dashboard + rewrite |
| `/post-operative-hair-protection-guide.pdf` | `next.config.ts` rewrite → above | GET | `locale?` | Guide PDF | Same | Same | Yes — `buildPatientLongTermGuidePdfHref` |
| `/api/internal/render-pdf` | `src/app/api/internal/render-pdf/route.ts` | POST | `{ caseId, auditMode?, version? }` | Clinical PDF upload | `renderAndUploadPdfForCase` | DB | No UI — internal/finalize |
| `/api/internal/build-pdf` | `src/app/api/internal/build-pdf/route.ts` | POST | JSON wrapper | Proxy | Proxies to render-pdf | — | No UI |
| `/api/auditor/rebuild-pdf` | `src/app/api/auditor/rebuild-pdf/route.ts` | POST | `{ caseId, reportId? }` | Clinical PDF rebuild | `rebuildReportPdfForReport` | DB | Yes — auditor panels |
| `/api/debug/reports` | `src/app/api/debug/reports/route.ts` | GET | `caseId` | Debug JSON | None | DB summary keys | Dev only |
| `/reports/[caseId]/html` | `src/app/reports/[caseId]/html/page.tsx` | GET | `token?`, `auditMode?` | Interactive HTML preview | React + `scoreAudit` | DB | Yes — auditor panel only |

**Dashboard/download links:**

- `/api/reports/{reportId}/download` — `download-report.tsx`, `LatestReportCard`, `VersionHistoryDrawer`, `PatientReportsCompletedCaseList`, `PatientNextActionPanel`
- `/post-operative-hair-protection-guide.pdf` — `PatientDashboardHliGuideCard` (when unlocked), `post-op-hair-protection-guide/page.tsx`
- `/api/print/demo-report`, `/api/reports/demo-pdf` — demo-report marketing

---

## Patient Flow Map

### Pre-surgery report — web view

| Step | Location |
|------|----------|
| Page/component | `src/app/cases/[caseId]/page.tsx` → `PreSurgeryPlanningReportShell.tsx` |
| Gate | `patient_review_pathway === "pre_surgery"` + `shouldUsePreSurgeryReportTemplate` + report resolved |
| Data builder | `resolvePreSurgeryPlanningReport()` in `preSurgeryPlanningReport.ts` |
| Renderer | React shell (not HTML renderer) |
| Intelligence | `patientSafeSummary` via `buildPatientSafeReportSummary`; intelligence via `patientSafeSummary` fields on bundle (**`clinicianNotes` used unsanitized for `future_progression` section — risk**) |
| Translation namespace | UI: `patient.reports.preSurgeryReport.*` (i18n). Report body: **hardcoded EN** in builder + `preSurgeryReportLabels.ts` |

### Pre-surgery report — PDF download

| Step | Location |
|------|----------|
| Download URL | `/api/reports/{reportId}/download` |
| Stored PDF source | Inngest/finalize → `renderAndUploadPdfForCase` |
| Print HTML | `/api/print/report?caseId&auditMode=patient&token` |
| Template | `renderPreSurgeryPlanningReportHtml` when pathway + patient mode |
| PDF generator | Playwright (`generateReportPdfFromUrl`) or PDFKit if env set |
| Translation | EN-only PDF labels via `buildPreSurgeryReportHtmlLabelsEn` |

### Post-surgery report — web view

| Step | Location |
|------|----------|
| Page/component | `src/app/cases/[caseId]/page.tsx` → `PostSurgeryAuditReportShell.tsx` |
| Gate | `patient_review_pathway === "post_surgery"` + `shouldUsePostSurgeryReportTemplate` |
| Data builder | `resolvePostSurgeryAuditReport()` in `postSurgeryAuditReport.ts` |
| Renderer | React shell |
| Sanitization | `sanitizePatientReportText` applied throughout post builder |
| Translation namespace | UI: `patient.reports.postSurgeryReport.*`; body EN in builder + `postSurgeryReportLabels.ts` |

### Post-surgery report — PDF download

| Step | Location |
|------|----------|
| Download URL | `/api/reports/{reportId}/download` |
| Print HTML | `/api/print/report` → `renderPostSurgeryAuditReportHtml` |
| PDF generator | Playwright / PDFKit |
| Image-limited | `imageLimitedAssessment` / `documentAssistedAssessment` from forensic summary → print route → HTML sections + `POST_SURGERY_IMAGE_LIMITED_NOTICE` |

### Long-term guide — unlock/download

| Step | Location |
|------|----------|
| Unlock logic | `patientHasUnlockedPostOpGuide()` in `src/lib/patient/caseSubmitStatus.ts` — true when any qualifying submitted case exists |
| Dashboard card | `PatientDashboardHliGuideCard` on `/dashboard/patient` — locked until unlock |
| Web view | `/post-op-hair-protection-guide` — also checks unlock |
| PDF download | `/post-operative-hair-protection-guide.pdf?locale=es` (rewrite) → `/api/reports/patient-long-term-guide` |
| HTML preview | `/api/print/patient-long-term-guide?locale=` |
| Data builder | `buildPatientLongTermGuideContent()` in `patientLongTermGuide.ts` |
| Renderer | `renderPatientLongTermGuideHtml` |
| Auth | **None on PDF route** — guide is public once URL is known; unlock is UI-only gating |
| Translation | Guide supports `locale` query (EN/ES content in builder); separate from main report i18n |

---

## Duplicate / Legacy Systems Found

### Duplicate renderers (same report type)

| Report type | Renderers | Notes |
|-------------|-----------|-------|
| Post-surgery patient | `PostSurgeryAuditReportHtml.tsx`, `PostSurgeryAuditReportShell.tsx`, elite fallback | Web shell ≈ HTML template; shared 6 section modules duplicated between Post and Pre |
| Pre-surgery patient | `PreSurgeryPlanningReportHtml.tsx`, `PreSurgeryPlanningReportShell.tsx`, elite fallback | Same duplication pattern |
| Universal/elite | `EliteReportHtml.tsx`, `reportBuilder.ts` (PDFKit), `legacy-report/route.ts` inline HTML, `/reports/[caseId]/html` React | **Four** universal-style paths |
| Long-term guide | `PatientLongTermGuideHtml.ts`, `PatientLongTermGuideSections.tsx` | Web + PDF |

### Duplicated section logic (Post + Pre HTML)

- `longTermHairPreservation.ts`
- `futureHairLossProgressionRisk.ts`
- `clinicalEvidenceGallery.ts`
- `reviewInputsProcessed.ts`
- `assessmentConfidence.ts`
- `assessmentImprovementRecommendations.ts`

### Legacy / orphan files

| File | Status |
|------|--------|
| `src/app/api/print/legacy-report/route.ts` | Legacy — instrumented, not retired |
| `src/app/api/reports/download/route.ts` | Legacy alias |
| `src/lib/pdf/elitePrintPhotoPipeline.ts` | Unused (superseded by signed-url pipeline) |
| `src/lib/pdf/renderRadarChart.ts` | Unused |
| `src/lib/pdf/optimizeRasterForPrintPdf.ts` | Only via unused pipeline |
| `src/components/reports/DomainScoreCards.tsx` | Orphan — no importers |
| `src/components/reports/AuditScoreBadge.tsx` | Orphan — no importers |
| `src/app/api/internal/build-pdf/route.ts` | Thin proxy — Inngest bypasses HTTP |

### Old universal report coexisting with pathway reports

- `shouldUsePostSurgeryReportTemplate` / `shouldUsePreSurgeryReportTemplate` gate pathway templates in print route.
- If gates fail (missing pathway, wrong mode), **`renderEliteReportHtml` fallback** still runs for patient PDFs.
- PDFKit path (`buildAuditReportPdf`) always uses universal layout — **does not use Post/Pre HTML templates** when `PDF_RENDERER=pdfkit`.

---

## Patient Safety / Wording Risks

| Location | Wording / issue | Patient reachable? |
|----------|-----------------|-------------------|
| `preSurgeryPlanningReport.ts:480-512` | Raw `hairLossClassification.clinicianNotes` as `progressionDefault` — can contain `"Forensic hair-loss classification (rule-based placeholder)."` | **Yes** — pre-surgery web + PDF |
| `hairLossClassification.ts:128` | Source string: `"Forensic hair-loss classification (rule-based placeholder)."` | Internal engine; **leaks via pre-surgery fallback** |
| `proceduralIntelligence.ts:151` | `"Procedural Intelligence (rule-based placeholder)."` | Blocked in post-surgery via `sanitizePatientReportText`; pre-surgery uses `patientSafeSummary` for most fields but not this fallback path |
| `shared.ts:381` | Prefixes `"This may suggest …"` | Sanitized in post PDF tests; pre-surgery partial coverage |
| `EliteReportHtml.tsx:904` | `"Forensic evidence board"` when not patient-facing | Auditor/clinic modes only — **not patient PDF if pathway templates apply** |
| `AuditorReviewPanel` / case workflow | `"Forensic AI"`, intelligence panels | Auditor-only — not patient report |
| `HairAuditIntelligencePanel.tsx` | Shows `clinicianNotes`, `"Procedural intelligence"` | Auditor-only |
| Patient shells / post builder | Sanitization via `postSurgeryPatientText.ts` | Post-surgery path **protected** (see `tests/postSurgeryAuditPdf.test.ts`) |
| SEO articles | `"failed grafts"`, `"bad crown result"` etc. | Public marketing/SEO — not audit PDF |
| Upload UI | `"Upload failed"` | Operational UI — not report body |

**Terms searched in patient report paths (`src/lib/reports/**`, patient components):**

- `"rule-based placeholder"` — **blocked in post-surgery**; **potential leak in pre-surgery** via clinicianNotes fallback
- `"Procedural Intelligence"` — blocked in post sanitizer; engine source strings exist
- `"clinicianNotes"` — **not rendered as key name**; **content may leak** in pre-surgery progression section
- `"malpractice"`, `"negligence"`, `"botched"` — not in patient report renderers; blocked in AI prompts (`audit.ts`, `graftIntegrity.ts`)

---

## Intelligence Rendering Risks

### Fields audited

| Field | Patient report usage | Raw leak risk |
|-------|---------------------|---------------|
| `patientSafeSummary` | Primary patient bridge on all engines | Low — intended patient copy |
| `clinicianNotes` | **Used directly in pre-surgery `future_progression` fallback** | **High** |
| Intelligence snapshots | Merged in preflight via `attachPatientSafeSummaryToReport` / shadow merge | Low if merge respects patient fields only |
| `imageLimitedAssessment` | Passed to print route + assessment confidence | Low — drives notices |
| `documentAssistedAssessment` | Same | Low |
| Clinical context | `knownClinicalContext` in patientSafeSummary | Medium — operator-entered; mapped via clinical history utils |
| Uploaded images | Clinical evidence gallery | Low — no internal metadata in captions |
| Procedural assessment scores | Post/pre scorecards (patient labels) | Low |
| Repair/refinement | Post-surgery repair section via `patientSafeSummary` + sanitization | Low on post path |

### Safety mechanisms (working)

- `patientIntelligenceTranslation.ts` — sanctioned patient bridge; tests enforce no engine IDs / clinicianNotes / AI language
- `postSurgeryPatientText.sanitizePatientReportText` — strips placeholder patterns
- `patientOutputSafety.ts` — forbidden term list for tests/shadow
- `tests/postSurgeryAuditPdf.test.ts` — explicit no-placeholder tests for post PDF
- `tests/hairAuditIntelligencePipeline.test.ts` — patient output must not expose clinicianNotes

### Gaps

- **No equivalent placeholder test file for pre-surgery PDF**
- Pre-surgery builder does not call `sanitizePatientReportText` on section findings
- Elite fallback path uses forensic findings directly through `buildReportViewModel` patient filtering — less intelligence-aware than pathway templates

---

## Translation / i18n Findings

### Policy

- `src/lib/i18n/report.ts`: **Generated report bodies remain English-only** until dedicated pipeline exists.
- `reportTranslationBlueprint.ts`: Future schema only — not wired to PDF.

### Active UI namespaces (patient reports)

- `patient.reports.preSurgeryReport.*` — EN + ES present
- `patient.reports.postSurgeryReport.*` — EN + ES present
- `patient.reports.patientSafeSummary.*` — EN + ES (partial via i18n tests)
- `patient.reports.report.longTermPreservation.*` — **EN only** (`en.json` ~L1044); **missing in `es.json`**
- `dashboard.patient.hliGuide.*` — guide card copy (EN + ES)
- Hardcoded EN in PDF: `postSurgeryReportLabels.ts`, `preSurgeryReportLabels.ts`, all HTML renderers

### Duplicated / unused

- `reportTerminology.ts` — glossary not wired to PDF/HTML output
- Pathway-specific labels duplicated between React shells (i18n) and PDF label builders (hardcoded EN)
- `patientSafeSummaryNarrativeTranslation` — auditor queue for narrative translation; generated PDF still English

### Hardcoded patient-facing copy in renderers

- All section titles, outcome labels, and gallery labels in `*ReportHtml.tsx` via `*ReportLabels.ts` (EN)
- `patientLongTermGuide.ts` — bilingual content inline (not i18n JSON)
- `postSurgeryPatientText.ts` — EN constant strings for image-limited notices

---

## Test Coverage Findings

### Existing tests (report/PDF related)

| Test file | Covers |
|-----------|--------|
| `tests/postSurgeryAuditPdf.test.ts` | Post PDF sanitization, no placeholder, no "this may suggest" |
| `tests/postSurgeryAuditReport.test.ts` | Post report builder |
| `tests/preSurgeryPlanningReport.test.ts` | Pre report builder |
| `tests/postSurgeryAuditReport.test.ts` | Post model |
| `tests/patientReportExperience.test.ts` | Elite HTML patient experience |
| `tests/patientReportConcerns.test.ts` | Concern bands + summary |
| `tests/patientLongTermGuide.test.ts` | Guide content + HTML |
| `tests/patientLongTermGuideSpanish.test.ts` | Guide ES locale |
| `tests/pdfReadiness.test.ts` | PDF readiness gates |
| `tests/pdfTemplateNormalization.test.ts` | Template header normalization |
| `tests/reportAccess.test.ts` | Download authorization |
| `tests/reportPdfDownloadRecovery.test.ts` | Download + auto-rebuild |
| `tests/reportPdfRebuildPreflight.test.ts` | Preflight + image-limited flags |
| `tests/imageLimitedAuditPdf.test.ts` | Image-limited PDF path |
| `tests/legacyReportUsageLog.test.ts` | Legacy route logging |
| `tests/hairAuditIntelligencePipeline.test.ts` | Patient output safety |
| `tests/hairAuditIntelligence.test.ts` | Engine outputs |
| `tests/e2e/hairaudit/pre-surgery-reports.spec.ts` | E2E pre reports |
| `tests/e2e/hairaudit/post-surgery-reports.spec.ts` | E2E post reports |
| `tests/e2e/hairaudit/pdf-routes.spec.ts` | E2E PDF download |
| `tests/e2e/hairaudit/mobile-reports.spec.ts` | Mobile report UX |
| `tests/elitePatientNarrativeRendering.test.ts` | Elite patient narratives |
| `tests/clinicalEvidenceGallery.test.ts` | Gallery rendering |
| `tests/assessmentConfidence.test.ts` | Confidence + image-limited |
| `tests/i18n/i18n.test.ts` | Patient safe summary i18n keys |

### Gaps

| Gap | Priority |
|-----|----------|
| **No pre-surgery PDF placeholder/safety test** (parity with `postSurgeryAuditPdf.test.ts`) | High |
| No test that `clinicianNotes` cannot appear in pre-surgery `future_progression` | High |
| No route integration test for `/api/print/legacy-report` retirement guard | Medium |
| No snapshot tests for Post/Pre HTML render output | Medium |
| No test for PDFKit path template parity with Playwright pathway templates | Medium |
| Missing i18n test for `longTermPreservation` ES keys | Medium |
| No smoke test for `/api/internal/build-pdf` proxy (if kept) | Low |
| Long-term guide unlock does not gate PDF URL server-side — no test for auth bypass | Medium |

---

## Recommended Cleanup Plan

### Phase 1: Safe no-behavior-change cleanup

- Document canonical production path in one README pointer (already partially in `README-PDF-ROLLOUT.md`).
- Mark orphan components (`DomainScoreCards`, `AuditScoreBadge`) with `@deprecated` comments — no deletion yet.
- Add observability dashboard query for `[legacy-report-usage]` per runbook.
- Inventory `PDF_RENDERER=pdfkit` production usage (if zero, document as dev-only).

### Phase 2: Route consolidation

- Retire `/api/print/legacy-report` after 30-day zero-traffic window (per runbook).
- Remove or 410 `/api/reports/download?reportId=` legacy alias.
- Evaluate removing `/api/internal/build-pdf` if Inngest never HTTP-calls it.
- Server-side gate for long-term guide PDF (optional auth or signed token) if product requires unlock enforcement.

### Phase 3: Renderer consolidation

- Extract shared Post/Pre section module into single orchestrator to eliminate duplicated HTML.
- Unify web shells to consume same section builders as PDF HTML (single source of truth).
- Ensure PDFKit path uses pathway templates or document PDFKit as auditor-only legacy.
- Remove unused `renderRadarChart.ts`, `elitePrintPhotoPipeline.ts` after confirmation.

### Phase 4: Translation cleanup

- Add missing `es.json` keys for `patient.reports.report.longTermPreservation`.
- Decide product policy: translate PDF bodies vs UI-only i18n.
- Wire `reportTerminology.ts` or remove if unused.

### Phase 5: Test hardening

- Add `preSurgeryAuditPdf.test.ts` mirroring post safety tests.
- Add intelligence leak test for pre-surgery progression section.
- Add HTML snapshot tests for print route template selection.
- E2E test for long-term guide unlock vs direct PDF URL.

---

## Files Recommended For Deprecation

| File | Recommendation |
|------|----------------|
| `src/app/api/print/legacy-report/route.ts` | **Safe to remove after confirmation** — zero UI links; runbook observability active |
| `src/lib/reports/legacyReportUsageLog.ts` | Remove with legacy route |
| `src/app/api/reports/download/route.ts` | **Safe to remove after confirmation** — no UI usage |
| `src/lib/pdf/renderRadarChart.ts` | **Safe to remove after confirmation** — zero importers |
| `src/lib/pdf/elitePrintPhotoPipeline.ts` | **Safe to remove after confirmation** — superseded |
| `src/lib/pdf/optimizeRasterForPrintPdf.ts` | **Uncertain** — confirm no external scripts |
| `src/components/reports/DomainScoreCards.tsx` | **Safe to remove after confirmation** — orphan |
| `src/components/reports/AuditScoreBadge.tsx` | **Safe to remove after confirmation** — orphan |
| `src/app/api/internal/build-pdf/route.ts` | **Uncertain** — verify no external callers |
| PDFKit renderer in `reportBuilder.ts` | **Needs replacement first** — must reach parity with pathway HTML or restrict to non-patient modes |

---

## Suggested Follow-up Tickets

### HA-PDF-CLEAN-1 — Orphan & legacy file retirement

Retire legacy print route, legacy download alias, unused pdf helpers, orphan components after traffic confirmation.

### HA-PDF-ROUTE-2 — Route consolidation & guide auth

Consolidate internal PDF entrypoints; evaluate server-side long-term guide unlock; remove build-pdf proxy if unused.

### HA-PDF-SAFETY-3 — Pre-surgery intelligence sanitization

Apply `sanitizePatientReportText` to all pre-surgery findings; remove `clinicianNotes` fallback; add parity tests with post-surgery.

### HA-PDF-I18N-4 — Report translation gap closure

Add missing ES keys; align PDF label strategy with UI i18n policy.

### HA-PDF-TEST-5 — PDF/HTML snapshot & pathway test hardening

Pre-surgery safety tests, template snapshot tests, PDFKit parity tests, guide unlock bypass test.

---

## Appendix: Production PDF Pipeline (reference)

```
Case submit / rebuild
  → renderAndUploadPdfForCase (renderPdfInternal.ts)
    → signRenderToken + buildPdfUrl
    → GET /api/print/report (HTML)
      → post | pre | elite template
    → generateReportPdfFromUrl (Playwright)
    → upload {caseId}/v{version}.pdf
Patient download
  → GET /api/reports/[reportId]/download
    → fetchReportPdfWithRecovery (auto-rebuild if missing)
```

---

## CI Check Results (audit run)

| Command | Result | Notes |
|---------|--------|-------|
| `pnpm typecheck` | **Pass** | No TypeScript errors |
| `pnpm lint` | **Fail (pre-existing)** | 569 problems (443 errors, 126 warnings) repo-wide; unrelated to this audit doc (markdown only). Sample categories: `react-hooks/set-state-in-effect` in `docs/EcosystemDiagramAnimated.tsx`, widespread `@typescript-eslint/no-explicit-any` in tests, unused vars. Not introduced by HA-PDF-AUDIT-1. |

---

*End of HA-PDF-AUDIT-1*
