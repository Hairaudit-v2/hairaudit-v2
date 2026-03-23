# HairAudit Patient Image Upload Pipeline - End-to-End Audit Report

**Date:** March 23, 2026  
**Auditor:** AI Code Analysis  
**Scope:** Full end-to-end image upload pipeline analysis

---

## 1. Executive Summary

The HairAudit image upload pipeline is a sophisticated, multi-layered system supporting patient, doctor, and clinic photo submissions. After comprehensive analysis of 40+ source files, the system demonstrates **strong architectural foundations** with clear separation of concerns, but contains **several areas requiring attention** to ensure image classification integrity.

### Key Findings

1. **Patient Upload Taxonomy (74 categories)** - Well-defined in `patientPhotoCategoryConfig.ts` with explicit phase/region mappings
2. **Graft Tray Images** - Properly categorized as `graft_tray_overview` and `graft_tray_closeup` in patient config, mapped to `img_graft_tray_*` in doctor/clinic configs
3. **Legacy Mapping Risk** - `auditPhotoSchemas.ts` contains legacy mappings that could cause misclassification
4. **AI Evidence Groups** - Clear 5-group taxonomy for AI analysis (baseline, donor_monitoring, surgical, graft_handling, followup)
5. **Storage Path Integrity** - Consistent pattern: `cases/{caseId}/{userType}/{category}/{timestamp}-{filename}`

### Critical Gaps Identified

- **NO explicit `pre_surgery` bucket** - Patient uploads use `preop_*` categories mapped to `patient_current_*` audit buckets
- **NO explicit milestone buckets (1mo/3mo/6mo/12mo)** - System uses `postop_monthN_*` naming convention
- **Clinic/doctor uploads** use `img_*` prefix schema different from patient `*_photo:*` schema
- **Inferential classification risk** in `classification.ts` uses token matching that could misclassify

---

## 2. Canonical Upload Taxonomy Discovered

### 2.1 Patient Upload Types (74 Total Categories)

**Visible in UI (9 Required + 1 Optional):**
| Category Key | Phase | Maps to Audit Bucket | Required |
|--------------|-------|---------------------|----------|
| `preop_front` | preoperative | `patient_current_front` | Yes |
| `preop_left` | preoperative | `patient_current_left` | Yes |
| `preop_right` | preoperative | `patient_current_right` | Yes |
| `preop_top` | preoperative | `patient_current_top` | Yes |
| `preop_crown` | preoperative | `patient_current_crown` | Yes |
| `preop_donor_rear` | preoperative | `patient_current_donor_rear` | Yes |
| `day0_recipient` | day_of_surgery | `any_day0` | Yes |
| `day0_donor` | day_of_surgery | `any_day0` | Yes |
| `postop_day0` | early_postoperative | `any_early_postop_day0_3` | No |
| `intraop` | perioperative | `any_day0` | No |

**Stage 2 Hidden (Backend-Ready, UI=Hidden):**
- **Graft Tray Categories:** `graft_tray_overview`, `graft_tray_closeup`
- **Graft Handling:** `graft_sorting`, `graft_hydration_solution`, `graft_count_board`
- **Follow-up Milestones:** `postop_month3_*`, `postop_month6_*`, `postop_month9_*`, `postop_month12_*` (front/top/crown/donor)
- **Donor Tracking:** `postop_month3_donor` through `postop_month12_donor`
- **Intra-op Detail:** `intraop_extraction`, `intraop_donor_closeup`, `intraop_recipient_sites`, `intraop_implantation`

### 2.2 Doctor/Clinic Upload Types (25 Categories)

Uses `img_*` prefix schema:

**Required (7):**
- `img_preop_front`, `img_preop_left`, `img_preop_right`, `img_preop_top`, `img_preop_donor_rear`
- `img_immediate_postop_recipient`, `img_immediate_postop_donor`

**Optional (18):**
- **Graft Tray:** `img_graft_tray_overview`, `img_graft_tray_closeup`, `img_graft_inspection`, `img_graft_microscopy`
- **Follow-up:** `img_followup_front`, `img_followup_top`, `img_followup_crown`, `img_followup_donor`
- **Surgical:** `img_intraop_extraction`, `img_site_creation`, `img_implantation_stage`, `img_marking_design`
- **Documents:** `file_operative_notes`, `file_case_records`
- **Other:** `img_preop_crown`, `img_preop_donor_sides`, `img_trichoscopy`

### 2.3 Storage Type Prefixes

| Submitter | Type Prefix | Example |
|-----------|-------------|---------|
| Patient | `patient_photo:` | `patient_photo:graft_tray_overview` |
| Doctor | `doctor_photo:` | `doctor_photo:img_graft_tray_overview` |
| Clinic | `clinic_photo:` | `clinic_photo:img_graft_tray_overview` |

---

## 3. End-to-End Mapping Table

### 3.1 Graft Tray Images (Primary Concern)

| Stage | Patient Path | Doctor/Clinic Path |
|-------|-------------|-------------------|
| **UI Source** | `patientPhotoCategoryConfig.ts` (hidden: `graft_tray_overview`, `graft_tray_closeup`) | `clinicPhotoCategories.ts` / `doctorPhotoCategories.ts` |
| **API Validator** | `patient-photos/route.ts` → `normalizePatientPhotoCategory()` | `clinic-photos/route.ts` / `doctor-photos/route.ts` → VALID_CATEGORIES Set |
| **DB Type Value** | `patient_photo:graft_tray_overview` | `clinic_photo:img_graft_tray_overview` |
| **Storage Path** | `cases/{id}/patient/graft_tray_overview/{ts}-{file}` | `cases/{id}/clinic/img_graft_tray_overview/{ts}-{file}` |
| **Retrieval Selector** | `list/route.ts` → type.startsWith("patient_photo:") | Case page loads all uploads by case_id |
| **AI Selector** | `patientAiImageEvidence.ts` → `graft_handling_evidence` group | `prepareCaseEvidence.ts` → `inferCanonicalPhotoCategory()` |
| **Report Section** | EvidenceSummary.tsx (patient photos) | ReportBuilder → images array |

### 3.2 Pre-Surgery Images

| Stage | Patient Path | Doctor/Clinic Path |
|-------|-------------|-------------------|
| **UI Source** | `PATIENT_PHOTO_CATEGORIES` → preop_* | `CLINIC_PHOTO_CATEGORIES` → img_preop_* |
| **API Validator** | `PatientPhotoCategorySchema` Zod enum | VALID_CATEGORIES Set |
| **DB Type Value** | `patient_photo:preop_front` | `clinic_photo:img_preop_front` |
| **Storage Path** | `cases/{id}/patient/preop_front/{ts}-{file}` | `cases/{id}/clinic/img_preop_front/{ts}-{file}` |
| **Retrieval Selector** | `list/route.ts` + metadata.category | All uploads by case_id |
| **AI Selector** | `baseline_evidence` group | `inferCanonicalPhotoCategory()` → "preop_front" |
| **Report Section** | EvidenceSummary patient section | EvidenceSummary doctor section |

### 3.3 Day-0 Surgery Images

| Stage | Patient Path | Doctor/Clinic Path |
|-------|-------------|-------------------|
| **UI Source** | `day0_recipient`, `day0_donor` | `img_immediate_postop_recipient`, `img_immediate_postop_donor` |
| **API Validator** | `normalizePatientPhotoCategory()` | VALID_CATEGORIES Set |
| **DB Type Value** | `patient_photo:day0_recipient` | `doctor_photo:img_immediate_postop_recipient` |
| **Storage Path** | `cases/{id}/patient/day0_recipient/{ts}-{file}` | `cases/{id}/doctor/img_immediate_postop_recipient/{ts}-{file}` |
| **AI Selector** | `surgical_evidence` + `donor_monitoring_evidence` | `prepareCaseEvidence.ts` → "day0_recipient"/"day0_donor" |

### 3.4 Milestone Follow-up Images (3mo/6mo/12mo)

**Patient uploads:**
- `postop_month3_front`, `postop_month3_top`, `postop_month3_crown`, `postop_month3_donor`
- `postop_month6_front`, `postop_month6_top`, `postop_month6_crown`, `postop_month6_donor`
- `postop_month9_front`, `postop_month9_top`, `postop_month9_crown`, `postop_month9_donor`
- `postop_month12_front`, `postop_month12_top`, `postop_month12_crown`, `postop_month12_donor`

**Doctor/Clinic uploads:**
- `img_followup_front`, `img_followup_top`, `img_followup_crown`, `img_followup_donor`

| Stage | Implementation |
|-------|---------------|
| **AI Evidence Group** | `followup_outcome_evidence` (patientAiImageEvidence.ts:143-161) |
| **Classification** | `inferCanonicalPhotoCategory()` handles month patterns explicitly (lines 101-122) |
| **Scoring Priority** | `scorePhotoForAudit()` = 72 for all milestone categories |

---

## 4. Mismatches and Risks

### 4.1 Risk Map

| Issue | Impact | Where Found | Severity | Recommended Fix |
|-------|--------|-------------|----------|-----------------|
| **Legacy alias mapping `img_graft_tray` → `img_graft_tray_closeup`** | Could cause graft tray uploads to be misclassified as closeup only | `auditPhotoSchemas.ts:126` | Medium | Remove or audit legacy mapping usage |
| **Doctor legacy mapping `intraop` → `img_intraop_extraction`** | Broad category collapsed to extraction only | `auditPhotoSchemas.ts:129` | Low | Verify all intraop uploads are correctly categorized |
| **Token-based inference in classification.ts** | Risk of misclassification if filenames contain misleading tokens | `classification.ts:32-69` | Medium | Prioritize DB-backed category over heuristic inference |
| **Patient `any_day0` mapped to both surgical AND donor groups** | Day0 images may appear in multiple AI evidence groups | `patientAiImageEvidence.ts:86` | Low | Document intentional multi-group membership |
| **Doctor/clinic use `img_*` prefix, patients use flat keys** | Schema drift between submitter types | Throughout codebase | Low | Document as intentional design choice |
| **Milestone months (3mo/6mo/9mo/12mo) use different conventions** | Patient: explicit month3/month6/month9/month12; Doctor: generic `img_followup_*` | Multiple files | Medium | Align naming or document mapping |
| **No explicit `pre_surgery` bucket exists** - uses `preop_*` | User request mentions `pre_surgery` which doesn't exist as canonical type | N/A | Low | Document that `preop_*` IS pre_surgery equivalent |
| **`donor_pre_surgery` and `recipient_pre_surgery` don't exist** | User request mentions these specific buckets which aren't defined | N/A | Low | Document that `preop_donor_rear` covers donor baseline |

### 4.2 AI Image Selection Logic Analysis

**File:** `classification.ts:137-187` (`buildAuditImageSelection`)

The AI pipeline selects images using this priority order:
```javascript
const categoryPriority = [
  "day0_donor",
  "day0_recipient", 
  "preop_donor_rear",
  "preop_front",
  "preop_top",
  "preop_crown",
  "preop_left",
  "preop_right",
  "intraop",
  "postop_healed",
  "postop_month12_front",  // Month 12 prioritized over earlier milestones
  "postop_month12_top",
  "postop_month12_crown",
  "postop_month6_front",   // Then month 6
  "postop_month6_top",
  "postop_month6_crown",
  "postop_month3_front",   // Then month 3
  "postop_month3_top",
  "postop_month3_crown",
  // ... etc
];
```

**Risk Assessment:**
- Selection is **NOT** "all images" - it's category-bucketed with priority
- Latest milestones (12mo) are prioritized over earlier ones (3mo)
- Graft tray images are NOT in this priority list - they rely on "remaining" fallback

### 4.3 Category Collapse Points

| Location | Collapse Behavior |
|----------|------------------|
| `auditPhotoSchemas.ts:106-113` | `normalizeToPatientKey()` - accepts `any_*` and `patient_current_*` prefixes as valid |
| `patientAiImageEvidence.ts:75-88` | Multiple raw keys map to same AI evidence groups (e.g., day0_recipient + intraop → surgical_evidence) |
| `classification.ts:48-52` | Token matching collapses postop_day0, postop_day1, postop_week1 to "postop_healed" |

---

## 5. Recommended Fix Order

### Immediate (Before Next Release)

1. **Verify graft tray category integrity**
   - Test upload of `graft_tray_overview` and `graft_tray_closeup`
   - Confirm they appear in `graft_handling_evidence` AI group
   - Confirm they appear correctly in reports

2. **Audit `PATIENT_PHOTO_CATEGORY_ALIASES` usage**
   - Check if legacy aliases are still being actively used
   - Consider deprecating if no longer needed

### Short-term (Next Sprint)

3. **Document schema differences**
   - Create explicit mapping table between patient and doctor/clinic category names
   - Document that `preop_*` = pre_surgery equivalent

4. **Review `inferCanonicalPhotoCategory` fallback logic**
   - Ensure DB-backed category is ALWAYS preferred over heuristic inference
   - Add telemetry to track inference accuracy

### Medium-term (Next Quarter)

5. **Consider unifying category naming**
   - Align patient `postop_monthN_*` with doctor `img_followup_*`
   - Or document explicit mapping between them

6. **Add graft tray to priority selection**
   - Currently graft tray images rely on fallback selection
   - Consider adding to `categoryPriority` in `buildAuditImageSelection`

---

## 6. Minimal Safe Remediation Plan

### Phase 1: Verification (Read-Only)

```sql
-- Query to verify graft tray uploads are correctly categorized
SELECT 
  type,
  metadata->>'category' as meta_category,
  storage_path,
  created_at
FROM uploads
WHERE type LIKE '%graft_tray%'
  OR metadata->>'category' LIKE '%graft_tray%'
ORDER BY created_at DESC
LIMIT 100;
```

### Phase 2: Integrity Check

Run integrity validation on recent uploads:
```typescript
import { summarizePatientPhotoCategoryIntegrity } from "@/lib/uploads/patientPhotoCategoryIntegrity";

// Check last 1000 uploads for type/metadata drift
const integrity = summarizePatientPhotoCategoryIntegrity(uploads, 50);
console.log(`${integrity.rowsNeedingAttention} of ${integrity.patientPhotoCount} uploads need attention`);
```

### Phase 3: Safe Additions (No Breaking Changes)

1. Add graft tray to AI selection priority (additive, won't affect existing)
2. Add explicit `preop_*` → `pre_surgery` documentation
3. Add telemetry on `inferCanonicalPhotoCategory` accuracy

---

## 7. Verification Checklist

### Graft Tray Verification
- [ ] Upload `graft_tray_overview` via patient portal → Verify DB type = `patient_photo:graft_tray_overview`
- [ ] Upload `img_graft_tray_overview` via clinic portal → Verify DB type = `clinic_photo:img_graft_tray_overview`
- [ ] Run AI audit → Verify graft tray images appear in `graft_handling_evidence` group
- [ ] Generate PDF report → Verify graft tray images appear in evidence section
- [ ] Check storage paths → Confirm format: `cases/{id}/{type}/{category}/{ts}-{file}`

### Pre-Surgery Verification
- [ ] Upload `preop_front` → Verify maps to `patient_current_front` audit bucket
- [ ] Upload `preop_donor_rear` → Verify maps to `patient_current_donor_rear`
- [ ] Verify `preop_*` images appear in `baseline_evidence` AI group

### Milestone Follow-up Verification
- [ ] Upload `postop_month3_front`, `postop_month6_front`, `postop_month12_front`
- [ ] Verify all three are distinct categories in DB (not collapsed)
- [ ] Verify all appear in `followup_outcome_evidence` AI group
- [ ] Verify PDF report shows all milestone photos separately

### AI Selection Verification
- [ ] Upload 15+ images across different categories
- [ ] Verify AI selection picks max 10 using category priority
- [ ] Verify graft tray images are included in selection (if present)
- [ ] Verify no "all images" selector is used anywhere

---

## 8. File Reference Index

### Upload Pipeline
| File | Purpose |
|------|---------|
| `src/app/api/uploads/patient-photos/route.ts` | Patient upload endpoint |
| `src/app/api/uploads/clinic-photos/route.ts` | Clinic upload endpoint |
| `src/app/api/uploads/doctor-photos/route.ts` | Doctor upload endpoint (legacy) |
| `src/app/api/uploads/list/route.ts` | List uploads for case |
| `src/app/api/uploads/signed-url/route.ts` | Generate signed URLs |

### Configuration & Schemas
| File | Purpose |
|------|---------|
| `src/lib/patientPhotoCategoryConfig.ts` | Patient category definitions (74 categories) |
| `src/lib/clinicPhotoCategories.ts` | Clinic category definitions |
| `src/lib/photoCategories.ts` | Patient category validation + aliases |
| `src/lib/photoSchemas.ts` | Schema copy for doctor/clinic |
| `src/lib/auditPhotoSchemas.ts` | Evidence scoring schemas + legacy mappings |

### AI Pipeline
| File | Purpose |
|------|---------|
| `src/lib/ai/audit.ts` | Main AI audit runner |
| `src/lib/audit/patientAiImageEvidence.ts` | Patient image grouping for AI |
| `src/lib/evidence/prepareCaseEvidence.ts` | Image preparation pipeline |
| `src/lib/photos/classification.ts` | Category inference logic |

### Integrity & Validation
| File | Purpose |
|------|---------|
| `src/lib/uploads/patientPhotoCategoryIntegrity.ts` | Type/metadata alignment validation |
| `src/lib/uploads/patientPhotoAuditMeta.ts` | Audit exclusion + metadata helpers |
| `src/lib/auditor/auditorPatientPhotoCategories.ts` | Auditor reassignment keys |

### Report/PDF
| File | Purpose |
|------|---------|
| `src/lib/pdf/reportBuilder.ts` | PDF content builder |
| `src/components/reports/EvidenceSummary.tsx` | Evidence display component |
| `src/lib/inngest/functions.ts` | Pipeline orchestration |

---

## 9. Appendix: Category Mapping Diagram

```
USER REQUEST BUCKET              ACTUAL IMPLEMENTATION
─────────────────────────────────────────────────────────────────
pre_surgery                      →  preop_front
                                 →  preop_left  
                                 →  preop_right
                                 →  preop_top
                                 →  preop_crown
                                 →  preop_donor_rear
                                 
donor_pre_surgery               →  preop_donor_rear
                                 →  preop_donor_left (hidden)
                                 →  preop_donor_right (hidden)
                                 →  preop_donor_closeup (hidden)

recipient_pre_surgery           →  preop_front
                                 →  preop_top
                                 →  preop_crown
                                 →  preop_left
                                 →  preop_right

graft_tray / graft_trays        →  graft_tray_overview (patient)
                                 →  graft_tray_closeup (patient)
                                 →  img_graft_tray_overview (clinic/doctor)
                                 →  img_graft_tray_closeup (clinic/doctor)
                                 →  img_graft_inspection (clinic/doctor)
                                 →  img_graft_microscopy (clinic/doctor)

post_op_immediate               →  day0_recipient
                                 →  day0_donor
                                 →  intraop
                                 →  img_immediate_postop_recipient (clinic/doctor)
                                 →  img_immediate_postop_donor (clinic/doctor)

followup_1_month                →  postop_month3_* (3mo is first milestone)
                                 (NO explicit 1mo category exists)

followup_3_month                →  postop_month3_front
                                 →  postop_month3_top
                                 →  postop_month3_crown
                                 →  postop_month3_donor

followup_6_month                →  postop_month6_front
                                 →  postop_month6_top
                                 →  postop_month6_crown
                                 →  postop_month6_donor

followup_12_month               →  postop_month12_front
                                 →  postop_month12_top
                                 →  postop_month12_crown
                                 →  postop_month12_donor
```

---

**End of Audit Report**

*This document provides a comprehensive analysis of the HairAudit image upload pipeline. All findings are based on static code analysis performed on March 23, 2026.*
