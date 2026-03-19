# HairAudit Form Architecture Refactor Plan

**Scope:** Clinic profile setup, clinic saved defaults, and doctor/clinic case submission flow only. Patient audit intake remains functionally unchanged.

**Constraints:** No schema-breaking changes unless necessary; preserve scoring compatibility; preserve current patient audit flow; implementation additive and backward-compatible.

---

## 1. Current Architecture Summary

| Asset | Purpose |
|-------|--------|
| `src/lib/clinicAuditForm.ts` | Clinic audit form sections (clinic profile + full case audit in one long form) |
| `src/lib/doctorAuditForm.ts` | Doctor/clinic case submission form (6–8 min target, FUE/FUT conditional) |
| `src/lib/patientAuditForm.ts` | Patient intake (out of scope for redesign) |
| `src/lib/audit/masterSurgicalMetadata.ts` | Shared option registries + BASIC/ADVANCED key arrays for scoring |
| `src/config/auditSchema.ts` | `caseStableFields`, `doctorDefaultFields`, `clinicDefaultFields`, `followupOnlyFields` |
| `src/lib/audit/fieldProvenance.ts` | Provenance values and merge logic for prefill/edit tracking |
| `src/lib/doctorAuditSchema.ts` | Zod validation + legacy key mapping for doctor answers |
| `src/lib/clinicAuditSchema.ts` | Zod validation for clinic answers |
| `src/lib/intake/normalizeIntakeFormData.ts` | Patient intake flattening only (do not change) |

**Defaults today:** Doctor/clinic “saved defaults” are stored in **localStorage** (`hairaudit:doctor:defaults:v1`, `hairaudit:clinic:defaults:v1`). On new case load, `AuditFormClient` prefills from these for fields listed in `doctorDefaultFields` / `clinicDefaultFields`. “Save as my defaults” writes `pickFields(answers, defaultFieldKeys)` to the same key. “Copy from previous case” uses `hairaudit:doctor:last-case:v1` / `hairaudit:clinic:last-case:v1`.

**Clinic profile vs case form:**  
- **Clinic profile** (ClinicProfileBuilder): `tagline`, `primary_country`, `primary_city`, `year_established`, `lead_doctor`, `contact_email`, `website`, plus advanced (e.g. `surgical_team_size`, `qa_protocol`). Stored via `/api/clinic-portal/profile`. Not the same as “clinic audit form” below.  
- **Clinic audit form** (CLINIC_AUDIT_SECTIONS): Used when a clinic fills the **case-level** audit (e.g. invited contribution or clinic-submitted case). It mixes clinic-level info (e.g. `clinic_name`, `operating_rooms`) with full case audit (identity, procedure, patient baseline, surgical metadata, etc.).  
- **Doctor audit form** (DOCTOR_AUDIT_SECTIONS): Used for doctor/clinic case submission; has doctor profile block then same case-audit structure.

---

## 2. Field-by-Field Mapping (4 Buckets)

### 2.1 Clinic default

**Definition:** Stored once at clinic (or doctor) level and prefilled for every new case; user can override per case. Already partially implemented via `clinicDefaultFields` / `doctorDefaultFields` in `config/auditSchema.ts`.

**Existing IDs to keep:** All IDs below must remain unchanged for compatibility with scoring, APIs, and `field_provenance`.

| Field ID | Notes |
|----------|--------|
| `requested_by` | Keep in clinic/doctor defaults |
| `review_purpose` | Keep |
| `clinic_branch` | Clinic only (doctor default set has no clinic_branch) |
| `additional_operators` | Keep |
| `additional_operators_details` | Keep |
| `future_loss_planning` | Keep |
| `risk_counselling_documented` | Keep |
| `candidate_suitability_rating` | Keep |
| `extraction_method` | Keep |
| `extraction_devices_used` | Keep |
| `primary_extraction_device` | Keep |
| `extraction_technique` | Keep |
| `extraction_operator` | Keep |
| `punch_sizes_used` | Keep |
| `primary_punch_size` | Keep |
| `punch_types_used` | Keep |
| `primary_punch_type` | Keep |
| `punch_manufacturers_used` | Keep |
| `punch_motion` | Keep |
| `motor_speed_rpm` | Keep |
| `holding_solutions_used` | Keep |
| `primary_holding_solution` | Keep |
| `temperature_controlled_storage` | Keep |
| `grafts_kept_hydrated` | Keep |
| `sorting_performed` | Keep |
| `holding_solution_notes` | Keep |
| `recipient_sites_created_by` | Keep |
| `site_creation_method` | Keep |
| `slit_orientation` | Keep |
| `site_instrument_sizes_used` | Keep |
| `dense_packing_attempted` | Keep |
| `implantation_method` | Keep |
| `implantation_devices_used` | Keep |
| `primary_implantation_device` | Keep |
| `implanted_by` | Keep |
| `singles_reserved_for_hairline` | Keep |
| `implantation_device_notes` | Keep |
| `intraoperative_adjuncts_used` | Keep |
| `intraop_prp_used` | Keep |
| `intraop_exosomes_used` | Keep |
| `exosome_type` | Keep |
| `partial_transection_used` | Keep |
| `intraop_adjunct_notes` | Keep |
| `postoperative_treatments_included` | Keep |
| `postoperative_treatments_recommended` | Keep |
| `finasteride_recommended` | Keep |
| `minoxidil_recommended` | Keep |
| `follow_up_plan_documented` | Keep |
| `donor_recovery_protocol_included` | Keep |
| `postoperative_protocol_notes` | Keep |

**Recommendation:** No ID renames. Optionally persist clinic defaults server-side (e.g. `clinic_profiles.audit_defaults` or linked table) later; for this refactor keep localStorage behavior and only adjust which fields are in the defaultable set if needed.

---

### 2.2 Procedure template default

**Definition:** Optional future concept: per–procedure-type templates (e.g. “FUE default” vs “FUT default”) for technique-specific fields. **Not currently implemented.**

**Candidate fields (for a future phase):**  
- FUE: `fuePunchType`, `fuePunchDiameterRangeMm`, `fuePunchMovement`, `fueDepthControl`, extraction device/punch defaults.  
- FUT: `futBladeType`, `futClosureTechnique`, `futMicroscopicDissectionUsed`.

**Refactor plan:** No code change in this pass. Only document that these doctor-form-only fields are good candidates for procedure templates when/if templates are added. No new IDs; use existing doctor form IDs.

---

### 2.3 Case-level field

**Definition:** Must be entered or confirmed per case; never defaulted from clinic/doctor defaults (may still be “inherited from original case” in follow-up audits).

**Existing IDs to keep:** All of these are used in scoring, reports, or APIs; do not rename.

**Case identity & context**  
`submission_type`, `audit_type`, `case_id`, `clinic_name`, `doctor_name`, `country_jurisdiction`, `surgery_date`, `multi_day_flag`, `procedure_day_breakdown`, `previous_surgery_history`, `previous_surgery_details`, `repair_case_flag`.

**Procedure & areas**  
`procedure_type`, `primary_procedure_type`, `areas_treated`, `primary_area_treated`, `hairline_lowering_flag`, `crown_included_flag`, `beard_donor_used`, `body_donor_used`.

**Patient baseline**  
`patient_age_bracket`, `patient_sex`, `ethnicity_hair_background`, `hair_type_curl_pattern`, `hair_calibre_category`, `hair_shaft_diameter_microns`, `hair_colour`, `skin_hair_contrast`.

**Diagnosis & pattern**  
`primary_diagnosis`, `secondary_diagnosis`, `hair_loss_scale_used`, `hair_loss_grade`, `hair_loss_stability`, `miniaturisation_present`, `miniaturisation_regions`, `dupa_retrograde_flag`, `scalp_condition_flags`.

**Preop planning**  
`planned_graft_count`, `actual_graft_count`, `estimated_hair_count`, `zones_planned`, `density_goal_by_zone`, `hairline_design_strategy`, `candidate_suitability_rating` (can stay defaultable for workflow; scoring uses it as case-level).

**Donor assessment**  
`donor_quality_rating`, `donor_density_rating`, `estimated_donor_capacity`, `estimated_donor_capacity_numeric`, `safe_donor_zone_assessed`, `donor_scarring_present`, `donor_density_per_cm2`, `avg_hairs_per_graft`, `overharvesting_risk_flag`, `overharvesting_signs`, `donor_mapping_notes`.

**Outcome / follow-up only (case-specific per review)**  
`outcome_audit_stage`, `growth_outcome_category`, `donor_healing_category`, `patient_satisfaction_category`, `corrective_surgery_likely`, `outcome_notes`, `review_concern_categories`, `claimed_evidenced_discrepancy`, `incomplete_records_flag`, `case_complexity_rating`, `auditor_confidence_level`, `forensic_notes`.

**Doctor form–specific (camelCase) — keep for backward compat**  
`doctorName`, `clinicName`, `clinicLocation`, `medicalDegree`, `yearsPerformingHairTransplants`, `percentPracticeHairTransplant`, `memberships`, `otherMembershipText`, `patientAge`, `patientGender`, `hairLossClassification`, `hairLossOtherText`, `donorDensityMeasuredPreOp`, `preOpDensityFuPerCm2`, `totalGraftsExtracted`, `totalGraftsImplanted`, `extractionPerformedBy`, `implantationPerformedBy`, `fuePunchType`, `fuePunchDiameterRangeMm`, `fuePunchMovement`, `fueDepthControl`, `fueDocumentedTransectionRatePercent`, `futBladeType`, `futClosureTechnique`, `futMicroscopicDissectionUsed`, `holdingSolution`, `holdingSolutionOtherText`, `temperatureControlled`, `outOfBodyTimeLogged`, `avgOutOfBodyTimeHours`, `microscopeStationsUsed`, `microscopeType`, `recipientTool`, `implantationMethod`, `implanterType`, `implanterOtherText`, `donorMappingMethod`, `percentExtractionPerZoneControlled`, `postOpDonorDensityMeasured`, `sterilizationProtocol`, `graftCountDoubleVerified`, `intraOpComplications`, `complicationsOtherText`, `totalProcedureCostUsd`, `costModel`, `includedInCost`, `dhtManagementRecommended`, `prpPostOpUsed`, `followUpScheduleStandardized`, `photoDocumentationRequired12Month`, `estimatedGraftSurvivalPercent`, `overallCaseSuccessRating`, `notesOptional`.

**“Same as clinic default” UX:** For any field that is **both** in `clinicDefaultFields` (or `doctorDefaultFields`) and displayed on the case form, the UI can show a checkbox “Same as clinic default” that hides the control and writes the default value into the case payload. That is an additive UX on top of current prefill; no ID changes.

---

### 2.4 Advanced / forensic-only field

**Definition:** Shown only in “Advanced” or “Forensic” sections; optional for basic audit; already present in form definitions.

**Existing section/IDs:**  
- **Clinic form:** `case_identity_submission_context_advanced`, `procedure_type_areas_treated_advanced`, `patient_baseline_advanced`, `diagnosis_pattern_advanced`, `preoperative_planning_advanced`, `donor_assessment_advanced`, `surgical_metadata_advanced`.  
- **Doctor form:** `case_identity_submission_context_advanced`, `procedure_type_areas_treated_advanced`, `patient_baseline_advanced`, `diagnosis_pattern_advanced`, `preoperative_planning_advanced`, `donor_assessment_advanced`, `advanced_forensic_metadata`.

All question IDs inside those sections remain **advanced-only** (e.g. `secondary_diagnosis`, `miniaturisation_regions`, `dupa_retrograde_flag`, `scalp_condition_flags`, `hair_shaft_diameter_microns`, `primary_extraction_device`, `transection_rate_percent`, `forensic_notes`, etc.). No ID renames; `masterSurgicalMetadata.ts` and scoring already treat them as optional/advanced.

**Patient audit:** Advanced sections under `patientAuditForm` (e.g. `adv_basics`, `adv_hair_biology`, `enhanced_patient_answers.*`) stay as-is; out of scope.

---

## 3. IDs That Must Remain Unchanged

- **Doctor answers:** All keys in `doctorAuditSchema` (camelCase and snake_case) and any key read by `mapLegacyDoctorAnswers` in `src/lib/benchmarks/domainScoring.ts` and print/report routes.  
- **Clinic answers:** All question `id`s in `CLINIC_AUDIT_SECTIONS`.  
- **Patient answers:** All question `id`s and `enhanced_patient_answers.*` paths used by `normalizeIntakeFormData` and patient summary/API.  
- **Provenance:** `field_provenance` and values in `FIELD_PROVENANCE_VALUES` (`prefilled_from_doctor_default`, `prefilled_from_clinic_default`, etc.).  
- **Option values:** All `value` strings in `masterSurgicalMetadata.ts` option arrays (used in validation and scoring).

---

## 4. Fields to Hide Behind “Same as clinic default”

**Recommendation (additive UX):** For fields in `clinicDefaultFields` / `doctorDefaultFields`, add an optional per-field or per-section “Use clinic/doctor default” that:

- When checked: hide the input, store the default value in the case payload, and set `field_provenance[id] = 'prefilled_from_clinic_default'` or `'prefilled_from_doctor_default'`.  
- When unchecked: show the input and allow edit (provenance can become `edited_after_prefill` or `entered_manually`).

No new field IDs; same keys as today. Implementation: extend `AuditFormClient` / `DoctorAuditFormClient` to (1) read defaults from existing localStorage keys, (2) for each defaultable field, optionally render a “Same as default” checkbox and conditionally show/hide the control.

---

## 5. Fields to Move Into Reusable Clinic Defaults

**Already in clinic/doctor defaults:** The lists in `config/auditSchema.ts` (`doctorDefaultFields`, `clinicDefaultFields`) already define the intended set. No field “move” is required for the refactor; the refactor is to **align** form sections and validation with this list and to avoid duplicating defaultable fields in the clinic form as if they were case-only.

**Optional addition:** If the clinic **profile** (ClinicProfileBuilder) is later given a “Surgical protocol defaults” block, it could persist the same set as `clinicDefaultFields` server-side (e.g. `clinic_profiles.audit_defaults`). Then the clinic case form would load defaults from API when available and fall back to localStorage. That is a future step; for this plan, keep using existing localStorage defaults and the existing default field lists.

---

## 6. Fields That Remain Case-Specific

All fields listed in **§2.3 Case-level field** remain case-specific. In particular:

- Case identity and submission context (except `requested_by`, `review_purpose`, `clinic_branch`, `additional_operators*`, `procedure_day_breakdown`, `previous_surgery_details`, which are defaultable or conditional).  
- Procedure type and areas (all).  
- Patient baseline (all).  
- Diagnosis and pattern (all).  
- Preop planning (graft counts, zones, etc.).  
- Donor assessment (all).  
- Outcome/forensic fields that are “followup only” or per-review.  
- Doctor-form-specific camelCase fields (doctor/clinic profile block, patient profile, procedure overview, FUE/FUT details, graft handling, cost, postop protocol, self-assessment).

None of these should be prefilled from clinic/doctor defaults; “copy from previous case” and follow-up “inherit from original” remain the only reuse for them.

---

## 7. Fields That Remain Advanced-Only

All questions in:

- Clinic: `*_advanced` sections and `surgical_metadata_advanced`.  
- Doctor: `*_advanced` sections and `advanced_forensic_metadata`.  
- Patient: sections with `advanced: true` and `enhanced_patient_answers.*`.

No promotion of these to “basic” in this refactor; no ID changes.

---

## 8. Safe Migration Strategy for Existing Clinics

1. **No schema or ID changes**  
   - Do not rename any field ID in forms, APIs, or DB.  
   - Do not change `reports.summary.doctor_answers` / `clinic_answers` shape or keys.  
   - Keep `field_provenance` keys and values as-is.

2. **Defaults**  
   - Keep localStorage keys `hairaudit:doctor:defaults:v1` and `hairaudit:clinic:defaults:v1`.  
   - If later adding server-side clinic defaults, add new columns/tables and dual-read (API first, then localStorage); do not remove localStorage until migration is done and documented.

3. **Validation**  
   - Keep `validateClinicAnswers` and doctor schema validation; at most extend to allow new optional fields.  
   - Keep `mapLegacyDoctorAnswers` and any mapping used by domain scoring and print routes.

4. **Backward compatibility**  
   - Existing cases with old payloads must still load and display (and score) correctly.  
   - New UI (e.g. “Same as clinic default”) must only add behavior; missing values for new checkboxes must behave as today (no value or prefill).

5. **Rollout**  
   - Deploy form/UX changes behind existing feature paths.  
   - No one-time data migration required if no DB shape change.  
   - If server-side clinic defaults are added later, run a one-time job to populate from first saved case or leave null and keep using localStorage until user saves defaults to server.

---

## 9. Files to Change (Recommended Order)

| Order | File | Change |
|-------|------|--------|
| 1 | `docs/FORM_ARCHITECTURE_REFACTOR_PLAN.md` | This plan (done). |
| 2 | `src/config/auditSchema.ts` | No ID changes; optionally add comments or a small constant listing “case-only” vs “defaultable” for clarity. Optionally add procedure-template candidate list (comment only). |
| 3 | `src/lib/audit/masterSurgicalMetadata.ts` | No structural change; ensure any new form field reusing options imports from here. |
| 4 | `src/lib/clinicAuditForm.ts` | Optional: add `defaultable: true` (or similar) on questions whose `id` is in `clinicDefaultFields` so UI can show “Same as default” without duplicating the list. Do not rename any `id`. |
| 5 | `src/lib/doctorAuditForm.ts` | Same as above for `doctorDefaultFields`; keep all existing `id`s (camelCase and snake_case). |
| 6 | `src/components/audit-form/AuditFormClient.tsx` | Optional: add “Same as clinic/doctor default” checkbox for defaultable fields; keep existing prefill and save logic. |
| 7 | `src/components/audit-form/DoctorAuditFormClient.tsx` | Same as AuditFormClient for doctor flow; ensure defaults and provenance logic stay in sync. |
| 8 | `src/lib/doctorAuditSchema.ts` | No breaking changes; only extend with optional fields if new ones are added. |
| 9 | `src/lib/clinicAuditSchema.ts` | No breaking changes; only extend with optional fields if new ones are added. |
| 10 | `src/lib/benchmarks/domainScoring.ts` | Do not change key names or scoring logic; any new field used in scoring must be wired with existing IDs. |
| 11 | `src/lib/audit/fieldProvenance.ts` | No change unless adding a new provenance value (not required for this refactor). |
| 12 | `src/app/api/doctor-answers/route.ts` | No payload key renames; accept same `doctorAnswers` shape. |
| 13 | `src/app/api/clinic-answers/route.ts` | No payload key renames; accept same `clinicAnswers` shape. |

**Do not change (patient audit):**  
- `src/lib/patientAuditForm.ts`  
- `src/lib/intake/normalizeIntakeFormData.ts`  
- Patient-specific components and API routes (except for non-invasive fixes).

**Do not change (scoring/reports):**  
- `domainScoring.ts` key expectations and `mapLegacyDoctorAnswers`.  
- Print/report routes’ use of `doctor_answers` / `clinic_answers` keys.

---

## 10. Summary

| Bucket | Action |
|--------|--------|
| **Clinic default** | Keep existing `clinicDefaultFields` / `doctorDefaultFields`; no ID renames; optionally add “Same as default” UX. |
| **Procedure template default** | Document only; no code change this pass. |
| **Case-level** | Keep all listed IDs case-specific; no promotion to defaults. |
| **Advanced/forensic-only** | Keep current sections and IDs; no promotion to basic. |

**Existing IDs:** All remain unchanged.  
**“Same as clinic default”:** Additive UI for existing defaultable fields.  
**Reusable clinic defaults:** Already defined; optionally persist server-side later.  
**Case-specific:** As in §2.3; no change to semantics.  
**Advanced-only:** As in §2.4; no change.  
**Migration:** No schema break; backward-compatible; optional server-side defaults later with dual-read and no forced migration.
