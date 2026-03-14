# Re-Audit: Doctor & Clinic Portals (Post–Hardening)

**Date:** Post production-hardening pass  
**Scope:** Doctor portal, Clinic portal, uploads, validation, auditor surfaces, legacy/schema consistency

---

## 1. Passed Items

| # | Area | Check | Result |
|---|------|--------|--------|
| 1 | Doctor dashboard | Overview page uses real cases from DB (`DoctorDashboardProduction`), not demo | **PASS** |
| 2 | Doctor nav | Upload, Defaults, Reports removed from nav; redirect to `/dashboard/doctor` | **PASS** |
| 3 | Doctor upload/page | `/cases/[caseId]/doctor/photos` uses `PhotoUploader` → `/api/uploads/audit-photos` only | **PASS** |
| 4 | Doctor upload API | No app code calls `/api/uploads/doctor-photos`; audit-photos is sole path in UI | **PASS** |
| 5 | Doctor-photos route | Marked legacy, `X-Deprecated` header, same img_* categories | **PASS** |
| 6 | Procedure type form | FUE/FUT sections use `showWhen: { questionId: "primary_procedure_type", oneOf: [...] }` | **PASS** |
| 7 | Procedure type schema | Refine uses `primary_procedure_type ?? procedureType` for FUE/FUT | **PASS** |
| 8 | Clinic answers API | `POST /api/clinic-answers` calls `validateClinicAnswers(incomingRecord)` before merge | **PASS** |
| 9 | Clinic schema | `validateClinicAnswers` uses `clinicAuditSchema.safeParse(data)` | **PASS** |
| 10 | Auditor missing evidence | Dashboard evidence cell has `title` with `Missing: ${missing_categories.join(", ")}` on hover | **PASS** |
| 11 | Case readiness card | Renders on case page with form presence, missing required categories, provenance summary | **PASS** |
| 12 | Doctor answers summary | Provenance summary + default-vs-override line when `field_provenance` present | **PASS** |
| 13 | Doctor answers validation | POST validates with `validateDoctorAnswers`, normalizes to snake_case for storage | **PASS** |
| 14 | Doctor GET | Returns merged legacy + `mapStoredDoctorAnswersToForm` for form keys | **PASS** (with one bug; see issues) |

---

## 2. Remaining Issues

### 2.1 Demo components still in production nav (High)

- **Where:** `/dashboard/doctor/training`, `/dashboard/doctor/public-profile`
- **What:** Both pages still render components from `DoctorPortalDemo` and (Training) `trainingModulesDemo` from `demoData.ts`.
- **Why it matters:** Users can see demo-only content as if it were production (e.g. fake training modules, profile settings).
- **Risk:** **High** — Misleading UX and possible confusion that “Training” or “Public Profile” are real features.

**Recommendation:** Redirect both to `/dashboard/doctor` until wired to real data, or replace with “Coming soon” / real Training and Public Profile backends.

---

### 2.2 GET doctor-answers: `primary_procedure_type` not exposed for conditionals (High)

- **Where:** `src/app/api/doctor-answers/route.ts` GET; `mapStoredDoctorAnswersToForm` in `doctorAuditSchema.ts`
- **What:** Stored payload uses `primary_procedure_type` (snake). `mapStoredDoctorAnswersToForm` maps it to `procedureType` (camel) via `SNAKE_TO_CAMEL_FOR_FORM`. Form section visibility uses `answers[sec.showWhen.questionId]` with `questionId: "primary_procedure_type"`. So after load, `answers.primary_procedure_type` can be missing and `answers.procedureType` set; FUE/FUT sections then stay hidden.
- **Why it matters:** Returning users with saved (normalized) data may not see FUE/FUT sections.
- **Risk:** **High** — Conditional form behavior is wrong for existing cases.

**Recommendation:** In GET, after building `forForm`, set `forForm.primary_procedure_type = forForm.primary_procedure_type ?? forForm.procedureType` so the form always has `primary_procedure_type` for showWhen.

---

### 2.3 Scoring reads `procedureType`; storage is `primary_procedure_type` (High)

- **Where:** `src/lib/benchmarks/domainScoring.ts` (e.g. lines 217, 322, 602)
- **What:** Code uses `(answers as any).procedureType` for FUE/FUT and technique-block logic. Stored doctor_answers are normalized to snake_case (`primary_procedure_type`). `mapLegacyDoctorAnswers` does not add `procedureType` from `primary_procedure_type`.
- **Why it matters:** Completeness and technique-critical scoring can treat procedure type as missing and undercount readiness/score.
- **Risk:** **High** — Scoring/benchmark logic is driven by an alias that no longer exists in stored data.

**Recommendation:** In `domainScoring`, resolve procedure type once (e.g. `const procedureType = String((answers as any).primary_procedure_type ?? (answers as any).procedureType ?? "");`) and use that everywhere, or ensure any code that passes doctor_answers into domainScoring supplies `procedureType` when `primary_procedure_type` is set.

---

### 2.4 Duplicate procedure type in form and schema (Medium)

- **Where:** `doctorAuditForm.ts` section 15 “Procedure Overview” still has `id: "procedureType"`; `doctorAuditSchema` still has `procedureType` in the schema.
- **What:** Two sources of “primary” procedure type (section 4: `primary_procedure_type`; section 15: `procedureType`). Conditionals and validation prefer `primary_procedure_type`, but form can still submit `procedureType` and it is normalized to `primary_procedure_type` on save.
- **Why it matters:** Redundant field and possible user confusion; normalization keeps storage consistent but logic is split.
- **Risk:** **Medium** — Works today due to normalization and refine fallback; cleanup would reduce drift.

**Recommendation:** Remove the `procedureType` question from section 15 and rely only on section 4 (`procedure_type` + `primary_procedure_type`). Then remove `procedureType` from the schema once no clients send it.

---

### 2.5 Case readiness: which “required” set is shown (Low)

- **Where:** `src/app/cases/[caseId]/page.tsx` — `missingRequiredPhotoCategories` logic
- **What:** If `showDoctorFlow` and any upload is `doctor_photo:*`, doctor required set is used; else patient set. So for a doctor case with no doctor uploads yet, the card shows patient missing categories.
- **Why it matters:** Slightly confusing for doctor-only cases before any doctor uploads.
- **Risk:** **Low** — Edge case; fallback to doctor missing when no doctor uploads would align with “doctor flow” intent.

**Recommendation:** Optional: when `showDoctorFlow` and audit_type or submission path is doctor, always use doctor required set for the card, regardless of current uploads.

---

### 2.6 Evidence manifest vs readiness card category names (Low)

- **Where:** `prepareCaseEvidence.ts` uses `REQUIRED_EVIDENCE_CATEGORIES` (e.g. `preop_front`, `day0_recipient`); case page and `CaseReadinessCard` use `getRequiredKeys("doctor")` (img_* from auditPhotoSchemas).
- **What:** Auditor dashboard tooltip shows `missing_categories` from case_evidence_manifests (pipeline); case page readiness card shows missing from auditPhotoSchemas. Naming differs (e.g. preop_front vs img_preop_front).
- **Why it matters:** Two different category models for “missing”; auditors may see different labels in tooltip vs case page.
- **Risk:** **Low** — Both reflect “missing required evidence”; alignment would improve consistency.

**Recommendation:** Document or align category naming between evidence pipeline and auditPhotoSchemas (e.g. same keys or a single mapping layer).

---

### 2.7 Legacy map still outputs `procedureType` (Medium)

- **Where:** `mapLegacyDoctorAnswers` maps `technique` → `procedureType`. Used by GET (legacy branch) and by `domainScoring` when it calls `mapLegacyDoctorAnswers(doctorAnswersRaw)`.
- **What:** For old data, legacy map fills `procedureType`. For new (normalized) data, stored has `primary_procedure_type` and no `procedureType`; domainScoring then sees no procedure type unless it also reads `primary_procedure_type`.
- **Why it matters:** Reinforces that scoring must accept both keys (see 2.3).
- **Risk:** **Medium** — Addressed by fixing 2.2 and 2.3; then legacy map can stay for old data only.

---

## 3. Risk Level by Issue

| Issue | Risk | Reason |
|-------|------|--------|
| 2.1 Demo in production nav | **High** | Demo content presented as production |
| 2.2 GET missing primary_procedure_type for form | **High** | FUE/FUT sections hidden after load |
| 2.3 Scoring uses procedureType only | **High** | Scores/readiness wrong on normalized data |
| 2.4 Duplicate procedureType in form/schema | **Medium** | Drift and redundancy |
| 2.5 Readiness card set for doctor vs patient | **Low** | Edge-case UX |
| 2.6 Evidence manifest vs img_* naming | **Low** | Label consistency |
| 2.7 Legacy map procedureType | **Medium** | Resolved by 2.2 + 2.3 |

---

## 4. Production Readiness Assessment

### Doctor flow

- **Case-based flow (create case → form → photos → submit):** **Production-ready**  
  - Overview lists real cases, upload uses audit-photos only, form saves and validates, conditionals use `primary_procedure_type` in the form definition.

- **Remaining blockers for “full” production readiness:**
  1. **Demo in nav:** Training and Public Profile still render demo components; should be redirected or replaced so no demo is shown as production.
  2. **Form load:** GET must ensure `primary_procedure_type` is present for the form (e.g. from `procedureType`) so FUE/FUT sections show after load.
  3. **Scoring:** domainScoring (and any other reader of doctor_answers) must use `primary_procedure_type` when `procedureType` is absent so completeness and technique logic are correct for normalized data.

**Verdict:** Doctor flow is **suitable for production for the case-based path** once 2.2 and 2.3 are fixed. Fix 2.1 so no demo surfaces are in production nav.

---

### Clinic flow

- **Clinic dashboard, workspaces, submit-case, form, photos:** **Production-ready**  
  - Clinic answers are schema-validated server-side; no demo in clinic nav; clinic upload and forms are consistent.

- **No outstanding high-risk issues** in the audited areas for clinic.

**Verdict:** Clinic flow is **production-ready** from a validation, upload, and nav perspective.

---

## 5. Summary Table

| Check | Doctor | Clinic |
|-------|--------|--------|
| No demo-only surfaces in production | ❌ Training + Public Profile still demo | ✅ |
| Procedure type canonical + conditionals | ⚠️ Form conditionals OK; GET/scoring need primary_procedure_type | ✅ N/A (clinic uses procedure_type + primary only) |
| One canonical upload path + category model | ✅ audit-photos + img_* | ✅ |
| Schema validation server-side | ✅ Doctor answers validated + normalized | ✅ Clinic answers validated |
| Auditor readiness / missing / provenance | ✅ Card + tooltip + provenance summary | ✅ Same case page |
| No legacy labels/route/schema driving logic silently | ❌ procedureType in scoring + GET form key | ✅ |

**Overall:** Clinic flow is production-ready. Doctor flow is production-ready for the case-based journey after addressing GET form key (2.2) and scoring procedure type (2.3), and after removing or replacing demo Training/Public Profile (2.1).
