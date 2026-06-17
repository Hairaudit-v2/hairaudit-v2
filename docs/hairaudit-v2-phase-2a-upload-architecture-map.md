# HairAudit V2 — Phase 2A: Upload Architecture Map

**Date:** 2026-06-17  
**Scope:** Document every upload path across the HairAudit application  
**Purpose:** Enable FI-compatible upload contract design and future consolidation  
**Phase 1A/B Reference:** [hairaudit-v2-phase-1a-schema-foundation.md](./hairaudit-v2-phase-1a-schema-foundation.md), [hairaudit-v2-phase-1b-baseline-schema-capture.md](./hairaudit-v2-phase-1b-baseline-schema-capture.md)  
**Ecosystem Audit:** [hairaudit-ecosystem-convergence-audit.md](./hairaudit-ecosystem-convergence-audit.md) § 1.3 Upload Pipeline  

---

## Executive Summary

HairAudit has **7 distinct upload paths** with different conventions:

| Priority | Upload Surface | Components | API Routes | Storage Convention | Status |
|----------|---------------|------------|------------|-------------------|--------|
| P0 | **Patient forensic audit** | `UnifiedPatientUploader`, `PhotoUploader` | `/api/uploads/patient-photos`, `/api/uploads/audit-photos` | `cases/{caseId}/patient/{category}/` | KEEP (consolidate) |
| P1 | **Surgery evidence** | `SurgeryUploadFlowClient` | `/api/surgery-upload/photos` | `cases/{caseId}/surgery/{slot}/` | KEEP (align) |
| P2 | **Auditor/admin corrections** | `PhotoUploader` | `/api/uploads/audit-photos` | `audit_photos/{caseId}/auditor/` | KEEP |
| P3 | **Doctor portal v2** | (doctor portal components) | (via doctor portal APIs) | `doctor_cases/{caseId}/` | KEEP (isolated) |
| P4 | **Community cases** | Community upload | `/api/community-cases` (indirect) | Community paths | KEEP (isolated) |
| P5 | **Academy training** | `AcademyCasePhotosPanel` | `/api/academy/uploads` | `academy/training-cases/{caseId}/` | KEEP (isolated) |
| P6 | **Bulk admin intake** | `BulkUploadWizardClient` | `/api/admin/hair-audit/bulk-upload/images` | `cases/bulk/{batchId}/` | KEEP |
| — | **Legacy upload-panel** | ~~`UploadPanel`~~ | ~~Direct Supabase client~~ | `{userId}/{caseId}/` | **REMOVED (2B)** |

**Key findings:**
- Three parallel upload components (`PhotoUploader`, `UnifiedPatientUploader`, `CategoryPhotoUpload`)
- Two storage path conventions (`cases/{caseId}/…` vs `audit_photos/{caseId}/…`)
- Orphaned `upload-panel.tsx` removed in Phase 2B (was bypassing server validation)
- All write to `uploads` table except academy/bulk/doctor portal
- Client compression only in surgery flow

---

## Upload Path Inventory

### Path 1: Patient Forensic Audit Upload

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 — Core production path |
| **Status** | KEEP (refactor to unified contract) |
| **Actor type** | `patient` |
| **Upload surface** | `forensic_audit` |
| **Source case table** | `cases` |

#### Frontend Components

| Component | Path | API Used | Notes |
|-----------|------|----------|-------|
| `UnifiedPatientUploader` | `src/components/patient/UnifiedPatientUploader.tsx` | `/api/uploads/patient-photos` | Primary patient upload |
| `PhotoUploader` | `src/components/photos/PhotoUploader.tsx` | `/api/uploads/audit-photos` | Generic photo upload |
| `CategoryPhotoUpload` | `src/components/uploads/CategoryPhotoUpload.tsx` | Configurable | Reusable category input |

#### API Routes

| Route | Method | Auth | Validation | Database |
|-------|--------|------|------------|----------|
| `/api/uploads/patient-photos` | POST | Session + case access | `validateCaseFilesRouteImage` | `uploads` |
| `/api/uploads/audit-photos` | POST | Session + case access | Same + dual-write `audit_photos` | `uploads` + `audit_photos` |

#### Storage Convention

```
cases/{caseId}/patient/{category}/{timestamp}_{filename}.jpg
```

| Segment | Values |
|---------|--------|
| `caseId` | UUID from `cases.id` |
| `category` | `front`, `top`, `crown`, `left`, `right`, `donor`, `recipient`, `other` |

#### Database Writes

| Table | Columns | Notes |
|-------|---------|-------|
| `uploads` | `id`, `case_id`, `user_id`, `type`, `storage_path`, `metadata`, `created_at` | `type` = `patient_photo:{category}` |
| `audit_photos` (audit route only) | `id`, `case_id`, `submitter_type`, `photo_key`, `storage_path`, `public_url`, `created_at` | Canonical evidence path |

#### Metadata Fields

```json
{
  "category": "front",
  "original_name": "hair_front.jpg",
  "mime": "image/jpeg",
  "size": 1024567,
  "width": 2048,
  "height": 1536
}
```

#### Downstream Workflow

1. Upload → `uploads` table insert
2. Post-submit → Inngest `prepareCaseEvidenceManifest`
3. Evidence prep → `cases/{caseId}/prepared/*.jpg`
4. `case_evidence_manifests` row created
5. AI audit uses prepared derivatives

---

### Path 2: Surgery Evidence Upload

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 — Mobile pre-audit evidence |
| **Status** | KEEP (align with forensic contract) |
| **Actor type** | `patient` (via surgery portal), `clinic`, `doctor` |
| **Upload surface** | `surgery_evidence` |
| **Source case table** | `cases` (with `surgery_upload_details` extension) |

#### Frontend Components

| Component | Path | API Used | Notes |
|-----------|------|----------|-------|
| `SurgeryUploadFlowClient` | `src/app/dashboard/surgery-upload/[caseId]/` | `/api/surgery-upload/photos` | Mobile-optimized flow |

#### API Routes

| Route | Method | Auth | Validation | Notes |
|-------|--------|------|------------|-------|
| `/api/surgery-upload/photos` | POST | Session + surgery actor check | `validateCaseFilesRouteImage` + client compression meta | Only surgery flow has client compression |

#### Storage Convention

```
cases/{caseId}/surgery/{slot}/{timestamp}_{filename}.jpg
```

| Segment | Values |
|---------|--------|
| `slot` | `pre-op`, `post-op-immediate`, `post-op-6mo`, `post-op-12mo`, etc. |

#### Database Writes

| Table | Columns | Notes |
|-------|---------|-------|
| `uploads` | Same as patient | `type` = `surgery_photo:{slot}:{category}` |
| `surgery_upload_details` | Parallel status columns | Extension table for surgery workflow |

#### Key Differences from Patient Path

| Aspect | Patient | Surgery |
|--------|---------|---------|
| Client compression | No | Yes (2400px max edge, JPEG q0.85) |
| Path structure | `patient/{category}` | `surgery/{slot}` |
| Type prefix | `patient_photo:` | `surgery_photo:` |
| Workflow trigger | Post-submit audit | Evidence review → handoff to audit |

---

### Path 3: Auditor/Admin Corrections Upload

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 — Auditor tooling |
| **Status** | KEEP |
| **Actor type** | `auditor` |
| **Upload surface** | `forensic_audit` (corrections) |
| **Source case table** | `cases` |

#### Frontend Components

| Component | Path | API Used | Notes |
|-----------|------|----------|-------|
| `PhotoUploader` | `src/components/photos/PhotoUploader.tsx` | `/api/uploads/audit-photos` | Reused with `submitterType=auditor` |

#### API Routes

Same as Path 1 (`/api/uploads/audit-photos`), but:
- `submitter_type` = `auditor`
- Dual-write to `audit_photos` table

#### Storage Convention

```
audit_photos/{caseId}/auditor/{category}/{timestamp}_{filename}.jpg
```

#### Database Writes

| Table | Purpose |
|-------|---------|
| `uploads` | Standard upload metadata |
| `audit_photos` | Canonical evidence reference |
| `upload_audit_corrections` | Correction trail (action: reassign/rename/exclude/restore) |

---

### Path 4: Doctor Portal V2 Upload

| Attribute | Value |
|-----------|-------|
| **Priority** | P3 — Isolated parallel model |
| **Status** | KEEP (document boundary) |
| **Actor type** | `doctor` |
| **Upload surface** | `doctor_portal` |
| **Source case table** | `doctor_cases` |

#### Architecture Note

Doctor portal v2 uses **separate tables** (`doctor_cases`, `doctor_case_uploads`) not connected to the main forensic audit pipeline. This is intentional isolation for doctor-owned case management.

| Table | Relationship |
|-------|--------------|
| `doctor_cases` | Parallel to `cases`, no FK |
| `doctor_case_uploads` | Child of `doctor_cases` |

---

### Path 5: Community Cases Upload

| Attribute | Value |
|-----------|-------|
| **Priority** | P4 — Public rating feature |
| **Status** | KEEP (isolated) |
| **Actor type** | `community` (unauthenticated) |
| **Upload surface** | `community` |
| **Source case table** | `community_cases` |

#### Architecture Note

Community cases are separate from forensic audit. Uploads are indirect via `community_cases` creation with image data URLs (payload guards in Phase 0B).

---

### Path 6: Academy Training Upload

| Attribute | Value |
|-----------|-------|
| **Priority** | P5 — Training competency system |
| **Status** | KEEP (isolated) |
| **Actor type** | `training_doctor`, `faculty` |
| **Upload surface** | `academy` |
| **Source case table** | `training_cases` |

#### Frontend Components

| Component | Path | API Used |
|-----------|------|----------|
| `AcademyCasePhotosPanel` | `src/components/academy/AcademyCasePhotosPanel.tsx` | `/api/academy/uploads` |

#### Storage Convention

```
academy/training-cases/{caseId}/{category}/{timestamp}_{filename}.jpg
```

#### Database Writes

| Table | Notes |
|-------|-------|
| `training_case_uploads` | Separate from main `uploads` table |

---

### Path 7: Bulk Admin Intake Upload

| Attribute | Value |
|-----------|-------|
| **Priority** | P6 — Admin batch operations |
| **Status** | KEEP |
| **Actor type** | `system` (admin-initiated) |
| **Upload surface** | `bulk_admin` |
| **Source case table** | `cases` (via `hair_audit_case_images` staging) |

#### Frontend Components

| Component | Path | API Used |
|-----------|------|----------|
| `BulkUploadWizardClient` | `src/components/admin/hair-audit/bulk-upload/` | `/api/admin/hair-audit/bulk-upload/images` |

#### Storage Convention

```
cases/bulk/{batchId}/{timestamp}_{filename}.jpg
```

#### Database Writes

| Table | Purpose |
|-------|---------|
| `hair_audit_case_images` | Staging table before sync to `uploads` |

---

### Path 8: Legacy Upload Panel (REMOVED)

| Attribute | Value |
|-----------|-------|
| **Priority** | — |
| **Status** | **REMOVED (Phase 2B)** |
| **Former path** | `src/app/cases/[caseId]/upload-panel.tsx` |

This component was deleted in Phase 2B. It previously bypassed server validation via direct browser→Supabase uploads and used the legacy `{userId}/{caseId}/` path layout.

**Replacement:** `UnifiedPatientUploader` / `PhotoUploader` with `/api/uploads/patient-photos` or `/api/uploads/audit-photos`.

---

## Component Consolidation Matrix

| Component | Used By | Surface | Status |
|-----------|---------|---------|--------|
| `UnifiedPatientUploader` | Patient dashboard | forensic_audit | KEEP — primary |
| `PhotoUploader` | Auditor, generic | forensic_audit | KEEP — auditor tooling |
| `CategoryPhotoUpload` | Reusable | forensic_audit | KEEP — design system |
| `SurgeryUploadFlowClient` | Surgery portal | surgery_evidence | KEEP — mobile optimized |
| `AcademyCasePhotosPanel` | Academy | academy | KEEP — isolated domain |
| `BulkUploadWizardClient` | Admin | bulk_admin | KEEP — batch operations |
| ~~`UploadPanel`~~ | — | legacy | **Removed Phase 2B** |

**Consolidation opportunity (Phase 2C):** `UnifiedPatientUploader` + `PhotoUploader` + `CategoryPhotoUpload` → single configurable `PhotoUploadSurface` component.

---

## Storage Path Conventions Summary

| Convention | Pattern | Used By | Future |
|------------|---------|---------|--------|
| Forensic patient | `cases/{caseId}/patient/{category}/` | Patient uploads | **Standardize to this** |
| Surgery evidence | `cases/{caseId}/surgery/{slot}/` | Surgery portal | Align with forensic |
| Audit canonical | `audit_photos/{caseId}/{submitter}/{category}/` | Auditor corrections | Keep for evidence |
| Bulk staging | `cases/bulk/{batchId}/` | Admin bulk | Keep |
| Academy isolated | `academy/training-cases/{caseId}/` | Academy | Keep isolated |
| Doctor portal | `doctor_cases/{caseId}/` | Doctor v2 | Keep isolated |
| Legacy orphan | `{userId}/{caseId}/` | ~~upload-panel~~ | **Removed (2B)** |

---

## Database Table Mapping

| Upload Surface | Primary Table | Secondary Tables | FK to Cases |
|----------------|---------------|-------------------|-------------|
| forensic_audit | `uploads` | `audit_photos`, `upload_audit_corrections` | `cases.id` |
| surgery_evidence | `uploads` | `surgery_upload_details` | `cases.id` |
| doctor_portal | `doctor_case_uploads` | — | `doctor_cases.id` |
| academy | `training_case_uploads` | — | `training_cases.id` |
| bulk_admin | `hair_audit_case_images` (staging) | → `uploads` | `cases.id` |
| community | `community_cases` (inline) | — | N/A |

---

## Metadata Contract Gaps

Current `uploads.metadata` JSON is inconsistent across surfaces:

| Field | Patient | Surgery | Audit | Academy | Bulk |
|-------|---------|---------|-------|---------|------|
| `category` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `original_name` | ✓ | ✓ | ✓ | ? | ? |
| `mime` | ✓ | ✓ | ✓ | ? | ? |
| `size` | ✓ | ✓ | ✓ | ? | ? |
| `width` | ✗ | ✗ | ✗ | ? | ? |
| `height` | ✗ | ✗ | ✗ | ? | ? |
| `compression_ratio` | ✗ | ✓ | ✗ | ? | ? |
| `client_compressed` | ✗ | ✓ | ✗ | ? | ? |

**Phase 2B contract:** See `src/lib/hairaudit/uploadContract.ts` for unified schema.

---

## FI OS Compatibility Notes

For future FI OS image intelligence delegation:

| Current | FI OS Future |
|---------|--------------|
| Heuristic category inference | FI classification API |
| Sharp metadata extraction | FI image metadata service |
| Manual quality scores | FI photo protocol engine |
| `uploads.metadata` JSON | FI image schema (mapped) |
| Evidence manifest prep | FI evidence manifest service |

The upload contract in Phase 2B includes placeholder fields for FI-compatible metadata.

---

## Phase 2B Status (2026-06-17)

| Item | Status |
|------|--------|
| `upload-panel.tsx` | **Removed** — orphan deleted; no imports found |
| `/api/uploads/delete` | **Hardened** — env bucket, case access, path gate via `uploadStorage.ts` |
| `uploadStorage.ts` | **Added** — shared bucket/path helpers for delete + future consolidation |
| Component consolidation | **Deferred** — not in Phase 2C scope |

---

## Phase 2C Status (2026-06-17)

**Scope:** Route/storage guardrail pass — migrate remaining upload routes to `uploadStorage.ts`; no frontend consolidation, no RLS, no FI OS wiring.

| Item | Status |
|------|--------|
| `/api/uploads/patient-photos` | **Migrated** — `resolveCaseFilesBucketForRoute` + `gateUploadCaseStoragePath` on write |
| `/api/uploads/audit-photos` | **Migrated** — same |
| `/api/uploads/list` | **Hardened** — bucket helper, path gate before sign, generic errors |
| `/api/uploads/signed-url` | **Hardened** — bucket helper, generic errors (auth + case access unchanged) |
| `/api/surgery-upload/photos` | **Migrated** — bucket helper + path gate; path layout unchanged |
| `/api/uploads/doctor-photos` | **410 in production** — no app callers; dev/test hardened handler retained |
| `/api/uploads/delete` | **Already 2B** — uses `resolveCaseFilesBucket` (unchanged) |

### Exceptions (not migrated in 2C — resolved in 2D)

| Route / area | Reason |
|--------------|--------|
| `/api/uploads/clinic-photos` | ✅ Migrated in 2D |
| `/api/academy/uploads`, bulk admin | ✅ Bucket helpers in 2D; isolated path contracts remain |
| Inngest, PDF, report signed-url helpers | ✅ Bucket helpers in 2D |
| Frontend upload components | Explicit non-goal for 2C/2D |

### Deprecated route decision

`/api/uploads/doctor-photos` returns **410 Gone** in production with migration text pointing to `POST /api/uploads/audit-photos` + `submitterType=doctor`. No production UI or API imports reference this route (see `docs/RE-AUDIT-DOCTOR-CLINIC-PORTALS.md`).

### Remaining Phase 2D tasks

| Work | Scope |
|------|-------|
| Migrate `/api/uploads/clinic-photos` | Same uploadStorage pattern as 2C |
| Align surgery storage layout with forensic convention | Optional path migration + backfill plan |
| Consolidate frontend upload components | `UnifiedPatientUploader` + `PhotoUploader` → configurable surface |
| Unify client compression | Cross-flow compression policy |
| Remaining inline `CASE_FILES_BUCKET \|\| "case-files"` | Inngest, reports, bulk, academy |
| Emit `hairaudit.upload.created` events | FI integration hook |
| RLS on `uploads` | After all write/read/delete paths consistent |

---

## Phase 2D Status (2026-06-17)

**Scope:** Finish upload storage standardisation — clinic route, infra bucket audit, path-alignment plan. No frontend consolidation, no RLS, no backfill.

| Item | Status |
|------|--------|
| `/api/uploads/clinic-photos` | **Migrated** — `resolveCaseFilesBucketForRoute` + `gateUploadCaseStoragePath`; active route used by clinic photos page |
| Infra inline bucket in `src/` | **Eliminated** — Inngest, PDF/report, academy, bulk, surgery export use `uploadStorage` helpers |
| Server job / report helpers | **Added** — `resolveCaseFilesBucketForServerJob`, `resolveCaseFilesBucketForReportRender`, `getCaseFilesBucketNameForReadOnlyUse` |
| Path alignment plan | **Added** — [hairaudit-v2-phase-2d-storage-path-alignment-plan.md](./hairaudit-v2-phase-2d-storage-path-alignment-plan.md) |
| Phase 2D tests | **Added** — `tests/uploadPhase2d.test.ts` |

### Clinic-photos decision

**KEEP (active)** — `/cases/[caseId]/clinic/photos` uses `CategoryPhotoUpload` → `POST /api/uploads/clinic-photos`. Not deprecated (unlike doctor-photos 410). Consolidation with `audit-photos` deferred to Phase 2E.

### Infra exceptions (approved)

| Area | Reason |
|------|--------|
| `prepareCaseEvidence.ts`, `reportBuilder.ts`, `elitePrintPhotoPipeline.ts`, `buildSurgeryEvidenceReviewPdf.ts` | Bucket passed as function argument from callers that use helpers |
| `tests/audit-harness/*`, `scripts/*` | Test harness / ops scripts — inline fallback acceptable |

### Remaining Phase 2E tasks (superseded — completed in 2E)

| Work | Scope |
|------|-------|
| Consolidate clinic/patient upload UI → audit-photos | Deferred to 2F (frontend) |
| Surgery path alignment (Option A vs C) | Deferred to 2F — see path alignment plan |
| Path backfill pilot | Deferred to 2F |
| Frontend upload component consolidation | Deferred to 2F |
| Unify client compression | Deferred to 2F |
| Emit `hairaudit.upload.created` events | ✅ [Phase 2E doc](./hairaudit-v2-phase-2e-upload-events-manifest-parity.md) |
| Storage RLS | After path inventory frozen |

---

## Phase 2E Status (2026-06-17)

**Scope:** Upload event contract, no-op dispatcher, route hooks after DB success, evidence manifest parity helpers. No FI OS network calls, no RLS, no backfill, no UI changes.

| Item | Status |
|------|--------|
| `uploadEvents.ts` | **Added** — `hairaudit.upload.created` / `.deleted` contract, `buildHairAuditUploadCreatedEvent` |
| `uploadEventDispatcher.ts` | **Added** — non-blocking; `HAIRAUDIT_UPLOAD_EVENTS_ENABLED` (default off) |
| Route emission | **Added** — patient-photos, audit-photos, clinic-photos, surgery-upload, academy, bulk (after uploads sync) |
| `evidenceManifestParity.ts` | **Added** — legacy vs contract comparison helpers |
| Phase 2E tests | **Added** — `tests/uploadPhase2e.test.ts` |
| Phase 2E doc | **Added** — [hairaudit-v2-phase-2e-upload-events-manifest-parity.md](./hairaudit-v2-phase-2e-upload-events-manifest-parity.md) |

### Remaining Phase 2F tasks

| Work | Scope |
|------|-------|
| FI OS event sink wiring (staging) | Enable flags + real HTTP/queue adapter |
| `hairaudit.upload.deleted` | Delete route hook |
| Dual-write audit_photos consistency | patient/clinic routes |
| Surgery path alignment execution | 2D plan Option A/C |
| Frontend upload consolidation | Deferred |
| Storage RLS | After path inventory frozen |

### Superseded Phase 2D task list (completed above)

| Work | Scope |
|------|-------|
| Migrate `/api/uploads/clinic-photos` | ✅ Done |
| Remaining inline `CASE_FILES_BUCKET \|\| "case-files"` in production src | ✅ Done |
| Align surgery storage layout | Documented — deferred execution to 2E |

---

## Recommended Phase 2C (completed)

| Work | Scope |
|------|-------|
| Migrate remaining routes to `uploadStorage.ts` | ✅ patient-photos, audit-photos, list, signed-url, surgery-upload |
| Standardize path validation on write/sign/list | ✅ `gateUploadCaseStoragePath` / existing signed-url gate |
| Deprecated doctor-photos decision | ✅ 410 production / hardened dev |
| Add Phase 2C tests | ✅ `tests/uploadPhase2c.test.ts` |

---

## Recommended Phase 2C (superseded — component work deferred)

| Work | Scope |
|------|-------|
| Consolidate `UnifiedPatientUploader` + `PhotoUploader` + `CategoryPhotoUpload` | Deferred to Phase 2D |
| Align surgery path convention with forensic | Deferred to Phase 2D |
| Unify client compression | Deferred to Phase 2D |
| Migrate remaining routes to `uploadStorage.ts` | ✅ Done in guardrail pass above |
| Emit `hairaudit.upload.created` events | Deferred — no FI OS migration in 2C |

---

## Recommended Phase 2B (completed)

| Work | Scope |
|------|-------|
| Delete `upload-panel.tsx` | ✅ Removed |
| Implement `uploadContract.ts` types | ✅ Phase 2A |
| Harden `/api/uploads/delete` | ✅ Phase 2B |
| Add `uploadStorage.ts` | ✅ Phase 2B |

---

## References

| Document | Section |
|----------|---------|
| `hairaudit-ecosystem-convergence-audit.md` | § 1.3 Upload Pipeline, § 2.2 Upload Legacy |
| `hairaudit-v2-phase-0b-rls-access-inventory.md` | Upload signed URL & storage guardrails |
| `src/lib/hairaudit/uploadContract.ts` | FI-compatible contract (Phase 2A) |
| `src/lib/hairaudit/uploadRouteRegistry.ts` | Route inventory |
| `src/lib/hairaudit/uploadStorage.ts` | Bucket/path helpers (Phase 2B) |
| `src/lib/hairaudit/uploadEvents.ts` | Upload event contract (Phase 2E) |
| `docs/hairaudit-v2-phase-2e-upload-events-manifest-parity.md` | Phase 2E events + manifest parity |
