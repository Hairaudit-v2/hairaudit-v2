# Patient Image Upload System Audit Report

**Date:** March 23, 2026  
**Auditor:** Code Analysis  
**Scope:** Upload failures, inconsistent UI behavior, drag-and-drop gaps

---

## 1. Upload Components Inventory

### Primary Upload Components

| Component | Location | Has Drag-and-Drop | Used By |
|-----------|----------|-------------------|---------|
| **PhotoUploader** | `src/components/photos/PhotoUploader.tsx` | ✅ YES (PhotoCategoryCard) | Doctor photos page, Patient photos (audit) page |
| **CategoryPhotoUpload** | `src/components/uploads/CategoryPhotoUpload.tsx` | ✅ YES | Clinic photos page |
| **ExtendedPatientPhotoUploadGroups** | `src/components/patient/ExtendedPatientPhotoUploadGroups.tsx` | ✅ YES (OptionalCategoryCard) | Patient photos (bottom extended section) |
| **PatientPhotoUpload (legacy)** | `src/app/cases/[caseId]/photos/PatientPhotoUpload.tsx` | ❌ NO | `/cases/[caseId]/photos` route |
| **PatientPhotoUpload (audit)** | `src/app/cases/[caseId]/audit/PatientPhotoUpload.tsx` | ❌ NO | `/cases/[caseId]/audit` route |
| **PhotoCategoryCard (inline)** | `src/app/cases/[caseId]/patient/photos/patient-photo-upload.tsx` | ✅ YES | Patient photos (main/legacy) |

### Summary
- **3 components have full drag-and-drop**
- **2 components have NO drag-and-drop** (legacy and audit patient uploaders)
- **1 component has drag-and-drop only in extended section** (patient-photo-upload.tsx)

---

## 2. Upload Limits Analysis

### Per-Category Limits

| Category Type | Source | Limit Field | Enforcement |
|--------------|--------|-------------|-------------|
| Patient (standard) | `PATIENT_PHOTO_CATEGORIES` in `photoCategories.ts` | `maxFiles` | Frontend slice + Backend schema lookup |
| Patient (extended) | `PATIENT_UPLOAD_CATEGORY_DEFS` in `patientPhotoCategoryConfig.ts` | `maxFiles` | Backend in `audit-photos/route.ts` |
| Doctor/Clinic | `DOCTOR_PHOTO_SCHEMA` / `CLINIC_PHOTO_CATEGORIES` | `max` / `maxFiles` | Frontend + Backend |

### Key Limit Values
```
Standard Patient Categories:  2-5 files per category
Extended Patient Categories: 4-8 files per category (Stage 2)
Doctor/Clinic Categories:      1-10 files per category
Default fallback:             6 files (audit-photos route)
```

### Limit Enforcement Points

1. **Frontend - PhotoUploader.tsx** (line 446, 469)
   ```javascript
   files.slice(0, max - existing.length)
   ```

2. **Frontend - CategoryPhotoUpload.tsx** (lines 106-107, 124-125)
   ```javascript
   const remaining = Math.max(0, cat.maxFiles - existingCount);
   files.slice(0, remaining)
   ```

3. **Backend - audit-photos/route.ts** (lines 127-131)
   ```javascript
   const maxFiles = getMaxForKey(st, category);
   const toUpload = files.slice(0, maxFiles);
   ```

4. **Backend - patient-photos/route.ts** (lines 101-114)
   - NO explicit limit enforcement - uploads ALL files in loop
   - Relies on storage path generation only

### ⚠️ CRITICAL: No Global Case-Level Limit
- **No total upload limit per case exists**
- Users can upload unlimited files across all categories
- Database table `uploads` has no quota enforcement

---

## 3. Upload State Management

### State Architecture

| Component | State Scope | Storage |
|-----------|-------------|---------|
| PhotoUploader | Per-category busy state, global uploads array | React useState |
| CategoryPhotoUpload | Per-category busy state, global uploads array | React useState |
| ExtendedPatientPhotoUploadGroups | Inherited from parent (PhotoUploader or patient-photo-upload) | React props |
| PatientPhotoUpload (legacy) | Per-category busy state, global byCategory | React useState |
| PatientPhotoUpload (audit) | Per-uploader files state (local only) | React useState |

### Root Cause: State Synchronization Issues

**Problem Pattern Found:**
1. Multiple uploaders on same page use **independent state**
2. Extended section (`ExtendedPatientPhotoUploadGroups`) receives `uploadsByCategory` via props
3. Parent components add new uploads via `setUploads((prev) => [...json.saved, ...prev])`
4. **No mechanism to prevent concurrent uploads across categories**

**Race Condition:**
```javascript
// PhotoUploader.tsx line 139
setUploads((prev) => [...json.saved, ...prev]);

// Multiple simultaneous uploads can overwrite state
// Category A and Category B uploads both read same prev state
// First to resolve wins, second overwrites
```

---

## 4. Error Handling Analysis

### Error Message Sources

| Location | Error Display | Swallowed Errors |
|----------|---------------|------------------|
| `PhotoUploader.tsx:142` | `alert((e as Error)?.message ?? "Upload failed")` | None (full error shown) |
| `CategoryPhotoUpload.tsx:70` | `alert((e as Error)?.message ?? "Upload failed")` | None (full error shown) |
| `patient-photo-upload.tsx:101` | `alert(e?.message ?? "Upload failed")` | None (full error shown) |
| `audit/PatientPhotoUpload.tsx:102` | `setMsg(Upload failed: ${data?.error})` | Backend error passed through |
| `photos/PatientPhotoUpload.tsx:111` | `setMsg(Upload failed (${cat}): ${data?.error})` | Backend error passed through |

### Error Source: Backend Routes

**patient-photos/route.ts** (lines 116-118, 141-143, 150-153)
```javascript
if (up.error) {
  return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
}
```
- Returns exact Supabase storage error
- Not wrapped or transformed

**audit-photos/route.ts** (lines 151-152, 172-173, 191-195)
```javascript
if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
```
- Same pattern - returns raw storage error

### Root Cause: Upload Failure After ~20 Images

**Likely Cause: Supabase Storage Rate Limiting or Connection Pool Exhaustion**

Evidence:
1. **Sequential upload loop** in patient-photos (lines 101-146):
   ```javascript
   for (const f of files) {
     // Upload each file synchronously in loop
     const up = await supabase.storage.from(bucket).upload(...);
   }
   ```

2. **No concurrency control** - Each file upload is independent network request

3. **No retry logic** - First failure aborts entire batch

4. **Extended section uploads** (`ExtendedPatientPhotoUploadGroups`) share same API route
   - Can trigger many concurrent requests if user opens multiple accordions

---

## 5. Storage Upload Logic Analysis

### Backend Upload Flow

**patient-photos/route.ts:**
```
1. Validate case exists and is not locked
2. Generate storage path: cases/{caseId}/patient/{category}/{timestamp}-{filename}
3. Convert file to buffer
4. Upload to Supabase Storage (upsert: false)
5. Insert metadata to uploads table
6. Return saved row
```

**audit-photos/route.ts:**
```
1. Validate category against schema
2. Get maxFiles limit from schema
3. Filter and slice files to maxFiles
4. For each file:
   a. Generate path: audit_photos/{caseId}/{type}/{category}/{uuid}.{ext}
   b. Upload buffer to storage
   c. Insert to uploads table
   d. Try insert to audit_photos table (may fail silently)
```

### ⚠️ Issue: No Transaction Safety
- If storage upload succeeds but DB insert fails, orphaned file exists
- No rollback mechanism
- `audit_photos` insert wrapped in try/catch (lines 177-186) - silently ignored

### Concurrency Concerns
- **No rate limiting** on API routes
- **No connection pooling** for Supabase client
- Each upload creates new storage upload request

---

## 6. Bottom Section Drag-and-Drop Investigation

### Components Without Drag-and-Drop

#### 1. `src/app/cases/[caseId]/audit/PatientPhotoUpload.tsx`
**Lines 63-189: `CategoryUploader` function**
```javascript
// NO drag handlers defined
// Only has: file input with onChange
<input
  id="audit-patient-photo-upload"
  type="file"
  accept="image/*"
  multiple
  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
/>
```
- Missing: `onDragOver`, `onDragLeave`, `onDrop`

#### 2. `src/app/cases/[caseId]/photos/PatientPhotoUpload.tsx`
**Lines 204-272: `Section` component**
```javascript
// NO drag handlers defined
// Uses inline styled div without drop zone
<div style={{...}}>
  <input type="file" ... />
</div>
```
- Missing: All drag-and-drop handlers
- Only file input-based upload

### Why Different Components?

| Route | Component Used | Drag-and-Drop Status |
|-------|---------------|---------------------|
| `/cases/[caseId]/patient/photos` | `patient-photo-upload.tsx` | ✅ Has DND (lines 247-264 in PhotoCategoryCard) |
| `/cases/[caseId]/photos` | `photos/PatientPhotoUpload.tsx` | ❌ NO DND (legacy/older page) |
| `/cases/[caseId]/audit` | `audit/PatientPhotoUpload.tsx` | ❌ NO DND (audit interface) |
| `/cases/[caseId]/doctor/photos` | `PhotoUploader.tsx` | ✅ Has DND |
| `/cases/[caseId]/clinic/photos` | `CategoryPhotoUpload.tsx` | ✅ Has DND |

### Root Cause of Inconsistency

**Legacy Code Divergence:**
1. `PhotoUploader.tsx` - Newer standardized component with full DND
2. `CategoryPhotoUpload.tsx` - Standardized for clinic (uses same pattern)
3. `ExtendedPatientPhotoUploadGroups` - Modern component with DND
4. `audit/PatientPhotoUpload.tsx` and `photos/PatientPhotoUpload.tsx` - **Legacy components never updated**

---

## 7. Upload Failure Root Cause Summary

### Primary Issue: "Upload failed" after ~20 images

**Root Cause:** Connection/Rate Limiting with State Race Conditions

```
User uploads 20+ images across multiple categories
        ↓
Multiple concurrent API requests to /api/uploads/patient-photos
        ↓
Sequential upload loop creates many Supabase storage connections
        ↓
Rate limiting or connection pool exhaustion
        ↓
Request fails with generic "Upload failed" message
```

**Contributing Factors:**
1. No global upload queue or concurrency limiting
2. No exponential backoff retry logic
3. State updates can race when multiple uploads complete simultaneously
4. Backend returns raw errors that aren't user-friendly

### Secondary Issue: Some sections accept, others reject

**Root Cause:** Different API Routes with Different Validation

| Route | File | Validation |
|-------|------|------------|
| Patient standard | `patient-photos/route.ts` | `normalizePatientPhotoCategory()` schema |
| Patient audit | `audit-photos/route.ts` | `VALID_KEYS[st]` schema lookup |
| Clinic | `clinic-photos/route.ts` | `VALID_CATEGORIES` Set |
| Doctor | `doctor-photos/route.ts` | `VALID_CATEGORIES` Set |

**Problem:** Extended categories (Stage 2) like `graft_tray_overview` may:
- Exist in `PATIENT_UPLOAD_CATEGORY_DEFS` (patient-photos route)
- NOT exist in `PATIENT_PHOTO_SCHEMA` (audit-photos route patient lookup)

**Evidence - audit-photos/route.ts lines 31-37:**
```javascript
if (st === "patient") {
  const fromSchema = PATIENT_PHOTO_SCHEMA.find((c) => c.key === key);
  if (fromSchema) return fromSchema.max;  // Only checks PATIENT_PHOTO_SCHEMA
  const fromUpload = PATIENT_UPLOAD_CATEGORY_DEFS.find((d) => d.key === key);
  if (fromUpload) return fromUpload.maxFiles;  // Falls back to extended
  return 6;  // Default
}
```

If a category is in `PATIENT_UPLOAD_CATEGORY_DEFS` but not in `PATIENT_PHOTO_SCHEMA`, the fallback works. But if the category isn't in either, it's rejected.

### Tertiary Issue: Bottom section no drag-and-drop

**Root Cause:** Legacy Components Not Updated

| Component | Status | Action Needed |
|-----------|--------|---------------|
| `audit/PatientPhotoUpload.tsx` | Legacy inline styles, no DND | Replace with `PhotoUploader` |
| `photos/PatientPhotoUpload.tsx` | Legacy inline styles, no DND | Replace with `PhotoUploader` or `patient-photo-upload.tsx` |

---

## 8. Exact Files/Functions Responsible

### Files with Issues

| File | Issue | Lines |
|------|-------|-------|
| `src/app/cases/[caseId]/audit/PatientPhotoUpload.tsx` | No DND; local state only | 63-189 (CategoryUploader) |
| `src/app/cases/[caseId]/photos/PatientPhotoUpload.tsx` | No DND; Section component | 204-272 (Section) |
| `src/app/api/uploads/patient-photos/route.ts` | No file limit; no concurrency control | 22-156 (POST handler) |
| `src/app/api/uploads/audit-photos/route.ts` | Schema validation may reject extended cats | 71-197 (POST handler) |

### Functions with Issues

| Function | File | Issue |
|----------|------|-------|
| `uploadFiles` | PhotoUploader.tsx | Race condition in state update (line 139) |
| `uploadFiles` | CategoryPhotoUpload.tsx | Race condition in state update (line 68) |
| `POST` | patient-photos/route.ts | No max file limit; sequential loop |
| `POST` | audit-photos/route.ts | Schema lookup may fail for extended cats |

---

## 9. Recommended Fix Strategy

### Phase 1: Immediate Fixes (No Schema Changes)

1. **Unify Upload Components**
   - Replace `audit/PatientPhotoUpload.tsx` with `PhotoUploader`
   - Replace `photos/PatientPhotoUpload.tsx` with `PhotoUploader` or `patient-photo-upload.tsx`
   - Single source of truth for upload UI

2. **Add Concurrency Control**
   - Add global upload queue in parent components
   - Limit concurrent uploads to 3-5 at a time
   - Add retry logic with exponential backoff

3. **Fix State Race Conditions**
   - Use functional state updates consistently
   - Consider React Query or SWR for server state

4. **Add File Count Limit to patient-photos**
   - Add `maxFiles` enforcement matching audit-photos

### Phase 2: API Improvements

5. **Batch Upload Endpoint**
   - Create batch upload API for multiple files
   - Single request = multiple files = less overhead

6. **Better Error Messages**
   - Map Supabase errors to user-friendly messages
   - Add specific error codes for debugging

7. **Transaction Safety**
   - Wrap storage + DB insert in transaction
   - Rollback storage on DB failure

### Phase 3: Legacy Cleanup

8. **Remove Legacy Components**
   - Delete `audit/PatientPhotoUpload.tsx`
   - Delete `photos/PatientPhotoUpload.tsx`
   - Route all to standardized `PhotoUploader`

---

## 10. Quick Wins

### 1. Add Drag-and-Drop to Legacy Components
Copy handlers from `PhotoCategoryCard` (patient-photo-upload.tsx lines 250-264) to:
- `audit/PatientPhotoUpload.tsx` CategoryUploader
- `photos/PatientPhotoUpload.tsx` Section

### 2. Add Max File Limit to patient-photos
```javascript
// Add to patient-photos/route.ts
const MAX_FILES_PER_UPLOAD = 10;
if (files.length > MAX_FILES_PER_UPLOAD) {
  return NextResponse.json({ 
    ok: false, 
    error: `Maximum ${MAX_FILES_PER_UPLOAD} files per upload` 
  }, { status: 400 });
}
```

### 3. Fix Schema Validation
```javascript
// audit-photos/route.ts - ensure extended categories are in PATIENT_AUDIT_PHOTO_KEYS
const PATIENT_AUDIT_PHOTO_KEYS = new Set([
  ...PATIENT_PHOTO_SCHEMA.map((c) => c.key),
  ...PATIENT_UPLOAD_CATEGORY_DEFS.map((d) => d.key),  // Ensure this is included
]);
```

---

**End of Audit Report**
