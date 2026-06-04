# Surgery Upload Report Pipeline — Stage 7A (Design + Safe Trigger Plan)

**Status:** Design document only. No report generation, no Inngest, no `/api/submit`, no `cases.status` mutations are introduced in Stage 7A.

**Related code:** Stage 6C audit intake (`surgery_upload_audit_intake`), mobile portal (`surgery_upload_details`, evidence events). Optional stub labels: `src/lib/surgeryUpload/surgeryUploadReportPipelineStage7a.ts`.

---

## 1. Pipeline inspection findings

### 1.1 What triggers report generation today

| Path | Trigger | Downstream |
|------|---------|------------|
| **`POST /api/submit`** (`src/app/api/submit/route.ts`) | Authenticated **case member** (patient/doctor/clinic on the case). **Auditors are explicitly forbidden** (`!isCaseMember \|\| role === "auditor"` → 403). | Updates `cases` to `status: "submitted"`, sets `submitted_at`, `submission_channel`, evidence scores on case, then **`inngest.send({ name: "case/submitted", data: { caseId, userId } })`**. |
| **Inngest `runAudit`** (`src/lib/inngest/functions.ts`) | Registered for **`case/submitted`** and **`case/audit-only-requested`** (`src/app/api/inngest/route.ts` serves `runAudit`, not `caseSubmitted`). | Evidence prep → AI audit (`runAIAudit`) → report row versioning → PDF phase → mutates **`cases.status`** through `setCasePipelineStatus` (e.g. `processing`, `evidence_*`, `complete`, `audit_failed`). |
| **Inngest `runGraftIntegrityEstimate`** | Same **`case/submitted`** (+ graft-only event). | Uses `prepareCaseEvidenceManifest` + patient-answer graft metadata; persists `graft_integrity_estimates`. |
| **`caseSubmitted`** (`src/lib/inngest/functions/caseSubmitted.ts`) | **`case/submitted`** | **Not registered** in `src/app/api/inngest/route.ts` today (see `docs/REPORT_READY_NOTIFICATION.md`). If enabled, it validates `data.user_id === cases.user_id` (submitter-only), generates a **placeholder PDFKit PDF**, uploads to storage, marks report complete, sets **`cases.status` = `complete`**, emails patient. |

### 1.2 Data the main pipeline expects

- **`/api/submit`:** Loads `cases` (`audit_type`, members, status). Classifies submitter as **patient / doctor / clinic** from `audit_type`. Validates uploads with **`canSubmit("doctor"|"clinic"|…)`** on **`patient_photo:` / `doctor_photo:` / `clinic_photo:`** style types and patient photo readiness gates — **not** `surgery_photo:*` slots.
- **`runAudit`:** Loads uploads; **requires patient photo submit gate** unless auditor rerun bypass applies — surgery-only cases without standard patient front/top/donor can fail or force `cases` back to **`draft`**. Loads **`reports.summary`** for `patient_answers`, `doctor_answers`, `clinic_answers` (intake-style JSON). Runs **`prepareCaseEvidenceManifest`** which classifies images into **canonical audit categories** (`preop_front`, `day0_recipient`, …) via `inferCanonicalPhotoCategory` — tuned for **legacy patient/doctor/clinic** evidence, not surgery slot keys.
- **`runAIAudit`:** Expects structured answers + prepared image inputs; **`auditMode`** is **`patient` | `full`** derived from presence of doctor/clinic answers/photos — again **not** a “surgery upload” mode.

### 1.3 Statuses mutated

- **`cases.status`:** `/api/submit` sets **`submitted`**. `runAudit` drives **`processing`**, granular pipeline strings where supported, then **`complete`** or **`audit_failed`** / revert to **`draft`** on missing patient photos.
- **`reports`:** Inserts/updates rows with `status`, `version`, `pdf_path`, `summary`, failure fields, auditor review columns, etc.

### 1.4 Ownership and permission assumptions

- **`/api/submit`:** Only **non-auditor case members** may submit.
- **`runAudit`:** Event carries `userId`; code **warns** if `userId` no longer matches case members but **continues** (rerun flexibility). Failure handler notifies **patient** email from `userId` and auditors.
- **Signed URLs:** `GET /api/reports/signed-url` uses **`canAccessCase`** on the case derived from PDF path — reasonable for any report stored under that case, but **visibility policy** for a new report type should still be explicitly designed (see §8).

### 1.5 Image / evidence assumptions

- Upload **`type`** prefixes and metadata categories assumed by scoring (`auditPhotoSchemas`), evidence prep (`REQUIRED_EVIDENCE_CATEGORIES`), and AI audit are **patient/doctor/clinic forensic** oriented.
- **Surgery uploads** use **`surgery_photo:<slot>`** (see checklist / portal). These are **not** first-class inputs to `prepareCaseEvidence`’s required-category matrix or to `/api/submit`’s `canSubmit` gates.

### 1.6 Report output today

- **Production path:** Forensic AI JSON in `reports.summary`, versioning, Playwright/internal PDF pipeline, PDF in `case-files` bucket under paths consumed by `signed-url` and case UI.
- **Legacy `caseSubmitted`:** Simple PDF list of upload rows — still wrong fit for surgery workflow and still couples to **`cases.user_id`**.

### 1.7 Safely reusable pieces (with caveats)

| Component | Reuse for surgery report? |
|-----------|---------------------------|
| **Supabase admin client + `uploads` table** | Yes — read `surgery_photo:*` rows, `storage_path`, `metadata` (quality flags). |
| **`canAccessCase` / RLS patterns** | Yes — for download/auth of any new artifact tied to `case_id`. |
| **Signed URL route pattern** | Yes — same bucket/path discipline; may need path convention or report-type guard. |
| **`prepareCaseEvidenceManifest`** | **Not** as-is without a **parallel manifest profile** or surgery-specific prep: category inference and required slots target **audit** photos, not surgery slots. |
| **`runAIAudit` / full forensic pipeline** | **Not** for Stage 7B “evidence review report” unless explicitly scoped; **high risk** of wrong prompts, missing inputs, and cost. |
| **PDFKit placeholder style** (`caseSubmitted`) | Possible for a **minimal** internal PDF, but prefer **dedicated template** so content matches surgery sections (see §7). |

---

## 2. Surgery-upload report input requirements

A **Surgery Upload Evidence Review Report** (recommended first deliverable) should be assembled from **authoritative DB rows** the portal already maintains:

**Identity & linkage**

- `case_id`
- `surgery_upload_details` row (all structured fields)
- `surgery_upload_audit_intake` row (`id`, `status`, `priority`, `assigned_to`, `metadata` snapshot, timestamps, notes)
- Optional: `clinic_profile_id` and linked `clinic_profiles` row for display names (filtering only; not access)

**Clinical / procedure snapshot**

- `procedure_type`, `surgery_date`, `surgeon_name`, `clinic_name` (snapshots on details)
- Preferences: extraction machine, punch size/type, implantation method, PRP/exosomes, storage solution, graft counts, timing fields, notes/complications

**Evidence structure**

- Resolved **photo checklist** (`photo_checklist_config` → effective required/optional/hidden slots)
- **Uploads** filtered to `surgery_photo:*`, grouped by slot key
- **Required evidence completion** summary (satisfied vs total; missing slot list)
- **Low-resolution / quality warnings** from upload `metadata` (as already surfaced in review UI)

**Reviewer workflow**

- `evidence_review_status` and related timestamps/notes on `surgery_upload_details`
- Per-slot **`surgery_upload_slot_reviews`** (status, reviewer_notes, reviewed_at/by)
- Overall request/history from evidence events (sanitized summaries only in UI; report may include bounded text fields)

**Intake & audit trail**

- Intake record fields + **append-only** `surgery_upload_evidence_events` (handoff, intake created/updated/status) for appendix narrative

**Explicit non-assumptions**

- Do **not** require `patient_photo:*` / `doctor_photo:*` categories for this report type.
- Do **not** assume `reports.summary.patient_answers` exists or is complete for surgery-dominant cases.

---

## 3. Safe pipeline options (comparison)

### Option A — Adapt existing `case/submitted` + `runAudit`

| Pros | Cons / risks |
|------|----------------|
| Single event name; less ops surface. | **`runAudit`** hard-codes patient photo gate and **mutates `cases.status`**; AI path expects forensic answers + patient-centric manifest. |
| | **Auditors cannot use `/api/submit`** anyway; would require **dangerous** API exceptions. |
| | Merging surgery logic into `runAudit` increases **blast radius** and regression risk for all audits. |

**Required changes (if ever pursued):** Early branch on “surgery-only case” with divergent steps; disable patient gate; new manifest profile; new PDF builder; strict feature flags. **Not recommended** as first step.

### Option B — Dedicated Inngest event + function (recommended)

**Suggested event names:** `surgery-upload/report-requested` or `surgery-upload/audit-intake-processing`.

| Pros | Cons / risks |
|------|----------------|
| **Isolates** surgery report jobs from `runAudit` / GII fan-out on `case/submitted`. | New function registration, monitoring, idempotency keys. |
| Clear **auditor-triggered** semantics; payload can include `intakeId`, `caseId`, `requestedBy`. | Still need guardrails: only emit after **DB row transition** proves eligibility. |
| Can ship **PDF-only evidence review** first without touching AI audit. | |

**Required changes:** New `inngest.createFunction({ id: "…" }, { event: "surgery-upload/report-requested" }, …)`; handler loads intake + details + uploads + reviews + events; writes a **dedicated** report row or artifact; updates **intake** columns (see §6); **never** calls existing `runAudit` internals unless later explicitly composed.

### Option C — Synchronous API route (no Inngest)

| Pros | Simple mental model; easy to debug locally. | Cons / risks |
|------|----------------|
| | Long-running PDF + storage in **HTTP request** risks timeouts and partial writes. |
| | Harder retries; need **idempotent** design in one transaction. |

**Use:** Optional **secondary** path for “regenerate PDF from last snapshot” behind low timeout budget, or strictly **enqueue** from route body without doing work inline.

### Recommendation

**Prefer Option B** unless product demands immediate synchronous PDF for tiny payloads. It matches Stage 6C’s “queue as middle layer,” keeps `case/submitted` semantics stable, and allows **progressive enhancement** (evidence PDF → later optional AI section).

### Why `/api/submit` must not be reused directly

1. **403 for auditors** — intake actions are auditor-driven.
2. **`cases.status` + `submitted_at` + submission_channel** — conflates “mobile surgery upload submitted” (already `surgery_upload_details.status`) with **forensic audit pipeline** submission; would double-book state machines.
3. **Photo validation** — `canSubmit` / patient gates are **wrong categories** for surgery photos.
4. **`case/submitted`** — fans out **`runAudit` + `runGraftIntegrityEstimate`**, both assume **patient-centric** evidence prep and **mutate case/report** in ways inappropriate for “evidence review PDF only.”

---

## 4. Proposed status lifecycle (intake ↔ report job)

**Intake statuses today:** `pending` | `processing` | `completed` | `failed` | `cancelled`.

**Problem:** `processing`/`completed` already mean “auditor triage” in Stage 6C, while Stage 7 also wants “report running / done.”

**Recommended approach:**

1. **Keep intake `status` as triage/workflow** for the *auditor queue* (unchanged semantics where possible), **or** narrow intake `processing` to mean “report job active” only if product agrees to rename triage states (breaking change — avoid in 7B without UX pass).

2. **Preferred (additive):** Add a **separate report pipeline field** on intake (or sibling table) — see §6 — e.g. `report_pipeline_status`: `not_started` | `queued` | `running` | `succeeded` | `failed` | `cancelled`. Map UI badges from **this** field for report generation, not from intake `status` alone.

3. **`cases.status`:** **Do not change** for Stage 7B evidence-review report. The surgery case may remain `draft` or whatever legacy state it has while **`surgery_upload_details.status === submitted`**. Only consider `cases.status` updates **if** a future “full clinical audit” product requires the main case shell to enter `submitted`/`processing` — and then only behind an explicit migration + UX review.

---

## 5. Duplicate prevention and idempotency

**Rules (proposed for Stage 7B):**

1. **At most one active report job per intake row** (`UNIQUE(case_id)` already on intake).
2. **Transition gate:** Only allow enqueue when `intake.report_pipeline_status` is in `{ not_started, failed }` **and** `audit_handoff_status === 'sent'` **and** surgery upload still `submitted` + evidence `ready_for_audit` (re-validate server-side).
3. **Atomic claim:** `UPDATE surgery_upload_audit_intake SET report_pipeline_status = 'queued', report_requested_at = now(), … WHERE id = $1 AND report_pipeline_status IN ('not_started','failed')` returning row; if zero rows updated → return **409** “already queued or running.”
4. **Job identity:** Inngest `step.run` ids + optional **`idempotency-key`** in event data `{ intakeId, reportKind: 'evidence_review_v1' }`. If Inngest dedupe is used, align key with intake id + report version.
5. **Output pointer:** On success, set `report_id` (FK to `reports.id` or a new `surgery_upload_reports` row) + `report_completed_at`; on failure set `report_failed_at` + bounded `report_error`.
6. **Retries:** Failed → allow retry only from `failed` → `queued` with same idempotency rules; append timeline event `report_generation_failed` / `report_generation_retried` (new event types in Stage 7B).

---

## 6. Data model recommendations

**Option 1 — Extend `surgery_upload_audit_intake` (preferred for smallest surface)**

Add nullable columns (Stage **7B** migration, not 7A):

- `report_id` UUID NULL REFERENCES `reports(id)` ON DELETE SET NULL  
- `report_requested_at`, `report_requested_by`  
- `report_completed_at`, `report_failed_at`  
- `report_error` TEXT (bounded)  
- `report_pipeline_status` TEXT CHECK (…)  
- `report_pipeline_job_id` TEXT NULL (Inngest run id / external ref)  
- Optional: `report_kind` TEXT DEFAULT `'evidence_review_v1'`

**Option 2 — `surgery_upload_report_jobs` child table**

| Pros | Cons |
|------|------|
| Multiple report generations / versions per case over time. | More joins; need RLS mirroring intake. |

**Recommendation:** Start with **Option 1** for **7B** (one evidence-review report pointer per intake). If versioning becomes first-class, migrate to **Option 2** or reuse **`reports.version`** with a `report_kind` / `source` discriminator on `reports` without overloading forensic summaries.

**Discriminator on `reports` (optional):** Add `submission_source` or `report_kind` column to distinguish **`forensic_ai_audit`** vs **`surgery_upload_evidence_review`** so dashboards and signed-url policies can branch safely.

---

## 7. Report output design (first version)

**Stage 7B target:** **“Surgery Upload Evidence Review Report”** — structured, human-readable, suitable for auditor + clinic alignment — **not** a full forensic AI clinical audit.

**Suggested sections:**

1. Case / patient reference header  
2. Clinic & surgeon (snapshots + linked profile note if any)  
3. Procedure summary  
4. Checklist completion table  
5. Photo evidence by slot (thumbnails or paths; signed URLs generated at render time or embedded as links)  
6. Surgical detail fields  
7. Graft handling / preservation  
8. Timing notes  
9. Per-slot reviewer decisions + overall evidence status  
10. Quality / low-resolution warnings aggregate  
11. Reviewer / intake notes (role-gated in PDF if needed)  
12. **Audit readiness conclusion** (non-scoring, declarative)  
13. Appendix: timeline of key events (no raw JSON dumps)

**Not in 7B:** Domain scores, benchmark eligibility, `forensic_audit` v1 structure — unless later explicitly extended.

---

## 8. Permissions and visibility

| Actor | View generated PDF | Trigger generation |
|-------|-------------------|-------------------|
| **Auditor / admin** | Yes | Yes (only actors who already pass `surgery_upload_is_auditor` / server routes) |
| **Clinic / doctor** | **Only if** `canAccessCase` **and** artifact flagged **`shareable_with_case_participants`** (new column or report metadata) | **No** (Stage 7B) |
| **Patient** | **Default off** unless case has patient participant **and** product explicitly enables sharing | **No** |

**Risks:** Reusing generic `reports` rows may surface surgery PDFs on case pages meant for forensic reports — mitigate with **`report_kind`** filtering in UI + API.

---

## 9. UI plan (Stage 7B)

| Surface | Change |
|---------|--------|
| **Audit intake queue** | Primary CTA: “Generate evidence review report” / “Start report generation”; badges for `report_pipeline_status`; retry on failed; link to download when succeeded. |
| **Surgery upload review panel** | Read-only report status + download (if shareable) for clinic; full controls for auditor. |
| **Case page** | Optional card “Surgery upload evidence report” when `report_kind` present — **do not** merge into main “Latest report” card without explicit design sign-off. |
| **Evidence timeline** | New sanitized event types: `report_generation_requested`, `report_generation_completed`, `report_generation_failed`. |

**Confirmation modal:** Warn that generation is asynchronous, does not change case forensic status, and may take minutes.

---

## 10. Error handling plan

| Failure | System state | User-facing message |
|---------|--------------|----------------------|
| Missing uploads after queue | `report_pipeline_status = failed` | “Required photos missing or removed; refresh and retry.” |
| Missing storage object | Failed + short error | “A photo could not be loaded from storage.” |
| Signed URL / read failure during PDF | Failed | “Could not access one or more images for the report.” |
| PDF render exception | Failed | “Report rendering failed. Support has been notified.” |
| DB insert report failure | Failed | “Could not save the report record.” |
| Inngest failure / timeout | Failed + allow retry | “Background job failed. Retry or contact support.” |
| Duplicate enqueue | 409, no second job | “A report is already generating or queued.” |
| Permission denied | 403 | “You are not allowed to generate this report.” |

All errors: **bounded** `report_error` string; no stack traces to clients.

---

## 11. Stage 7B implementation plan (ordered)

1. **Migration:** Add report pipeline columns to `surgery_upload_audit_intake` (and optional `reports.report_kind` or separate table — decide in PR).  
2. **Server validation module:** Pure functions re-checking eligibility (handoff sent, evidence ready, required photos complete).  
3. **API route (auditor-only):** `POST /api/surgery-upload/audit-intake/[intakeId]/request-evidence-report` — atomic claim row, `inngest.send` with new event (Option B).  
4. **Inngest function:** Load inputs → build PDF (new builder under `src/lib/reports/surgeryUpload/` or similar) → upload to `case-files` with deterministic path → insert/update `reports` row → set intake `report_*` fields → timeline events.  
5. **Download:** Extend signed-url or add `GET /api/surgery-upload/reports/[reportId]/signed-url` with `canAccessCase` + shareable flag.  
6. **UI:** Intake queue + review panel + timeline.  
7. **Tests:** Idempotency + forbidden roles + missing evidence.

---

## 12. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Accidental fan-out to `runAudit` | **Never** emit `case/submitted` from surgery paths; code review checklist. |
| Wrong PDF on wrong surface | `report_kind` + UI filters. |
| PII leakage in PDF | Reuse only fields already visible to target role; redact internal auditor emails if needed. |
| Long job blocking UX | Async only (Option B); optimistic `queued` state. |

---

## 13. Manual validation (Stage 7A)

- [ ] Repo grep: no new `inngest.send` / `case/submitted` from surgery-upload paths.  
- [ ] No changes to `/api/submit` behavior.  
- [ ] No migration altering `cases` / `reports` in Stage 7A (doc-only + optional stub file).  
- [ ] `npx tsc --noEmit` passes.  
- [ ] ESLint clean on touched files.

---

## 14. Next prompt for Stage 7B (suggested)

> Implement Stage 7B: Surgery Upload Evidence Review Report. Follow `docs/hairaudit/surgery-upload-report-pipeline-stage-7a.md`. Add migration for intake report columns (and optional `reports.report_kind`). Add auditor-only `POST …/request-evidence-report` that atomically claims intake and emits `surgery-upload/report-requested`. Register a new Inngest function that builds a PDF from surgery_upload_details + slot-grouped surgery_photo uploads + reviews + bounded timeline text, writes a `reports` row with `report_kind = surgery_upload_evidence_review_v1`, updates intake pointers, logs timeline events. Add intake queue UI + download link. Do not call `/api/submit`, do not emit `case/submitted`, do not change `cases.status`, do not run `runAIAudit` unless explicitly scoped later.
