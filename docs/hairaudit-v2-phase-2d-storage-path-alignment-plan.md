# HairAudit V2 — Phase 2D: Storage Path Alignment Plan

**Date:** 2026-06-17  
**Scope:** Document path conventions, alignment strategy, backfill risks, and RLS implications  
**Prerequisite:** [Phase 2A Upload Architecture Map](./hairaudit-v2-phase-2a-upload-architecture-map.md), Phase 2B–2C bucket guardrails  
**Status:** Planning document — **no backfill executed in Phase 2D**

---

## Executive Summary

HairAudit stores forensic evidence in the **`case-files`** Supabase bucket using **multiple coexisting path layouts**. Phase 2D standardized **bucket resolution** across routes and infra; **path layout unification** remains a Phase 2E+ concern with explicit backfill planning.

| Priority | Action | Phase |
|----------|--------|-------|
| P0 | Centralize bucket env resolution | ✅ 2B–2D |
| P0 | Path gate on upload write/sign/list/delete | ✅ 2B–2D |
| P1 | Document canonical vs legacy layouts | ✅ 2D (this doc) |
| P2 | Optional surgery → forensic path alignment | 2E |
| P3 | `audit_photos/` vs `cases/…/patient/` convergence | 2E+ |
| P4 | Storage object backfill / copy | 2E+ (after RLS design) |

---

## Current Path Conventions

### Forensic pipeline (case-scoped — gated by `gateUploadCaseStoragePath`)

| Convention | Pattern | Write routes | DB table |
|------------|---------|--------------|----------|
| **forensic_patient** | `cases/{caseId}/patient/{category}/{stamp}_{file}` | `/api/uploads/patient-photos` | `uploads` |
| **forensic_clinic** | `cases/{caseId}/clinic/{category}/{stamp}_{file}` | `/api/uploads/clinic-photos` | `uploads` |
| **forensic_doctor** (legacy) | `cases/{caseId}/doctor/{category}/{stamp}_{file}` | ~~doctor-photos~~ (410 prod) | `uploads` |
| **surgery_slot** | `cases/{caseId}/surgery/{slot}/{stamp}_{file}` | `/api/surgery-upload/photos` | `uploads` |
| **audit_canonical** | `audit_photos/{caseId}/{submitter}/{category}/{uuid}.{ext}` | `/api/uploads/audit-photos` | `uploads` + `audit_photos` |
| **prepared evidence** | `cases/{caseId}/prepared/{category}_{n}.jpg` | Inngest `prepareCaseEvidence` | `case_evidence_manifests` |
| **report PDFs** | `cases/{caseId}/reports/v{n}.pdf` (and variants) | PDF render pipeline | `reports.pdf_path` |

### Isolated / staging (not gated by forensic path helper today)

| Convention | Pattern | Routes | Notes |
|------------|---------|--------|-------|
| **bulk_staging** | `cases/bulk/{batchId}/…` | Bulk admin upload | Staging → sync to `uploads` |
| **academy_isolated** | `academy/training-cases/{caseId}/…` | Academy upload | Separate `training_case_uploads` table |
| **doctor_portal** | `doctor_cases/{caseId}/…` | Doctor portal v2 | Parallel product surface |

### Deprecated (reject on new writes)

| Convention | Pattern | Status |
|------------|---------|--------|
| **legacy_orphan** | `{userId}/{caseId}/…` | Rejected by path gate; upload-panel removed 2B |

---

## Supported Canonical Future Convention

**Target for new forensic patient/clinic evidence (post-alignment):**

```
audit_photos/{caseId}/{actor}/{category}/{uuid}.{ext}
```

Where `{actor}` ∈ `patient`, `clinic`, `doctor`, `auditor`.

**Rationale:**
- Matches dual-write path used by `/api/uploads/audit-photos`
- Single namespace for evidence manifest prep and AI audit
- `audit_photos` table already references these paths as canonical

**Interim:** Patient and clinic dedicated routes continue writing `cases/{caseId}/patient|clinic/…` until a coordinated migration. Both layouts are **readable** by evidence prep (manifest + uploads fallback).

---

## Legacy Conventions That Must Remain Readable

| Layout | Why readable | Consumers |
|--------|--------------|-----------|
| `cases/{caseId}/patient/…` | Historical patient uploads | List, signed-url, PDF fallback, Inngest prep |
| `cases/{caseId}/clinic/…` | Active clinic portal | Clinic photos page, list, delete |
| `cases/{caseId}/doctor/…` | Pre-410 doctor route files | List, signed-url, delete |
| `cases/{caseId}/surgery/…` | Surgery portal | Surgery export, evidence review PDF |
| `cases/{caseId}/prepared/…` | Derived evidence | AI audit, report render |
| `audit_photos/{caseId}/…` | Canonical audit API | audit_photos table, auditor tooling |
| `cases/bulk/…` | Admin staging | Bulk wizard only |
| `academy/training-cases/…` | Academy domain | Training reviews |

**Do not delete or rename storage objects** until backfill completes and all readers are verified.

---

## Surgery Path Alignment Options

Surgery uploads use `cases/{caseId}/surgery/{slot}/…` while forensic patient uploads use `cases/{caseId}/patient/{category}/…`.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A — Keep parallel (recommended short-term)** | No object move; gate both under `cases/{caseId}/` | Zero backfill risk; surgery slot semantics preserved | Two forensic layouts |
| **B — Symlink-style DB only** | Keep objects; add manifest entries mapping slot → category | No storage copy | Complex manifest logic |
| **C — Copy to unified tree** | Copy surgery objects to `audit_photos/…` or `cases/…/patient/…` on handoff | Single evidence tree | Storage duplication, backfill job |
| **D — Slot-as-category** | New uploads use `cases/{caseId}/patient/{slot}/…` | One tree under `cases/` | Breaks slot naming; confuses anatomical categories |

**Phase 2D decision:** **Option A** — surgery layout unchanged; bucket helpers only. Revisit in 2E when consolidating upload components.

---

## `audit_photos` Path Handling

| Concern | Current behavior | Future |
|---------|------------------|--------|
| **Write** | `/api/uploads/audit-photos` dual-writes `uploads` + `audit_photos` | Primary write path for consolidated UI |
| **Read** | List/signed-url accept `audit_photos/{caseId}/…` via path gate | Unchanged |
| **Clinic/patient parallel routes** | Write `cases/…` only (no audit_photos dual-write) | Migrate to audit-photos or add dual-write in 2E |
| **Evidence prep** | Prefers prepared manifest; falls back to `uploads.storage_path` | Should prefer `audit_photos.storage_path` when present |

**Risk:** Same logical photo may exist under both trees if users switch between routes. Dedup strategy deferred to 2E (metadata hash / manifest reconciliation).

---

## Backfill Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Broken signed URLs / PDF images | High | Dual-read period; never delete source until verified |
| `uploads.storage_path` drift from object location | High | Transactional copy + DB update in single job |
| RLS policies referencing old prefixes | High | Apply RLS only after path inventory frozen |
| Inngest re-processing old cases | Medium | Idempotent manifest writes; version manifest rows |
| Academy/bulk cross-contamination | Medium | Keep isolated prefixes out of forensic gate |
| Storage cost duplication | Low | Copy only when necessary; prefer metadata pointers |

---

## Migration / Backfill Plan (Phase 2E+ — not executed)

1. **Inventory** — Export `(uploads.id, storage_path, type, created_at)` and `audit_photos` paths per case.
2. **Classify** — Tag each row with `path_convention` (see `uploadContract.ts`).
3. **Pilot** — Select N submitted cases; copy (not move) clinic/patient paths → `audit_photos/…`; update `audit_photos` rows only.
4. **Verify** — Report PDF, list gallery, Inngest prep, delete route on pilot cases.
5. **Rollout** — Batch job with checkpoint; feature flag `HA_PATH_ALIGN_READ_NEW=1`.
6. **Cutover** — Redirect writes to audit-photos; deprecate clinic-photos route (410 like doctor-photos).
7. **Cleanup** — Optional object delete after retention window (≥90 days).

---

## RLS Implications

From [Phase 0B RLS inventory](./hairaudit-v2-phase-0b-rls-access-inventory.md):

- **RLS on `uploads` is blocked** until all write/read/delete paths use consistent bucket + path validation.
- Phase 2D completes **bucket centralization** for production `src/`; path gates cover forensic namespaces.
- **Storage RLS** (Supabase storage policies) must allow:
  - `cases/{caseId}/…` for case members
  - `audit_photos/{caseId}/…` for case members + auditors
  - Deny `cases/bulk/…` to non-admin roles
  - Deny `academy/…` except training roles
- **Do not enable storage RLS** until Phase 2E confirms no service-role bypass regressions in Inngest/PDF pipelines.

---

## Phase 2D Completed Work

| Item | Status |
|------|--------|
| `/api/uploads/clinic-photos` → `uploadStorage` | ✅ |
| Infra inline `CASE_FILES_BUCKET \|\| "case-files"` in `src/` | ✅ Eliminated |
| Server job / report helpers in `uploadStorage.ts` | ✅ |
| Approved exceptions: bucket-as-parameter libs | ✅ Documented in `APPROVED_INLINE_BUCKET_SRC_EXCEPTIONS` |
| This alignment plan | ✅ |

---

## Recommended Phase 2E

| Work | Scope |
|------|-------|
| Consolidate clinic/patient → audit-photos UI | Frontend only; route deprecation |
| Surgery path decision (A vs C) | Product + eng sign-off |
| Bulk/academy dedicated bucket helpers | Optional `resolveAcademyAssetsBucket()` if bucket splits |
| Path backfill pilot | Ops job + monitoring |
| `hairaudit.upload.created` events | FI integration |
| Storage RLS draft + staging test | After path inventory |

---

## References

| Document / module | Purpose |
|-------------------|---------|
| `uploadStorage.ts` | Bucket + path gates |
| `uploadContract.ts` | Path convention taxonomy |
| `caseFilesPath.ts` | Forensic namespace parser |
| `uploadRouteRegistry.ts` | Route inventory |
