# Audit Master Schema (Doctor + Clinic)

This schema update targets **doctor** and **clinic** intake only.  
Patient intake remains unchanged.

The model stays two-tier:

1. **Basic Audit Questions** (fast, practical completion)
2. **Advanced / Forensic Audit Questions** (deeper forensic/training metadata)

Machine-readable config source:

- `src/lib/audit/masterSurgicalMetadata.ts`
- `src/config/auditSchema.ts` (workflow metadata, copy-forward/default/follow-up grouping)

Form field-set sources:

- Doctor: `src/lib/doctorAuditForm.ts`, validation: `src/lib/doctorAuditSchema.ts`
- Clinic: `src/lib/clinicAuditForm.ts`, validation: `src/lib/clinicAuditSchema.ts`

---

## Stable fields that should auto-carry forward on follow-up audits

Exported as `caseStableFields` in `src/config/auditSchema.ts`.

These fields are treated as stable surgical context and inherited from the original surgery record:

- case identity/context: `submission_type`, `audit_type`, `case_id`, `clinic_name`, `clinic_branch`, `doctor_name`, `country_jurisdiction`, `surgery_date`, `multi_day_flag`, `procedure_day_breakdown`
- baseline and diagnosis context: `patient_age_bracket`, `patient_sex`, `ethnicity_hair_background`, `hair_type_curl_pattern`, `hair_calibre_category`, `primary_diagnosis`, `secondary_diagnosis`, `hair_loss_scale_used`, `hair_loss_grade`, `hair_loss_stability`
- planning and donor baseline: `planned_graft_count`, `actual_graft_count`, `zones_planned`, `donor_quality_rating`, `donor_density_rating`, `safe_donor_zone_assessed`, `estimated_donor_capacity`, `donor_density_per_cm2`, `avg_hairs_per_graft`
- extraction/recipient/implantation protocol: `extraction_method`, `extraction_devices_used`, `extraction_technique`, `punch_sizes_used`, `punch_types_used`, `holding_solutions_used`, `recipient_sites_created_by`, `site_creation_method`, `implantation_method`, `implantation_devices_used`, `implanted_by`
- intra-op/post-op protocol defaults captured on initial surgery: `intraoperative_adjuncts_used`, `intraop_prp_used`, `intraop_exosomes_used`, `exosome_type`, `partial_transection_used`, `postoperative_treatments_included`, `postoperative_treatments_recommended`, `follow_up_plan_documented`

For this group, schema metadata flags are set to:

- `isCaseStable: true`
- `canInheritFromOriginalCase: true`
- `lockAfterInitialSurgerySave: true`

---

## Doctor/Clinic default fields that should prefill automatically

Exported as:

- `doctorDefaultFields` (doctor default surgical profile)
- `clinicDefaultFields` (clinic default protocol profile)

Both groups are editable per case and support exception-based entry:

- “Use saved defaults”
- “Only update what changed”

Common defaultable examples:

- operational intent: `requested_by`, `review_purpose`, `additional_operators`
- extraction protocol: `extraction_method`, `extraction_devices_used`, `primary_extraction_device`, `extraction_technique`, `punch_sizes_used`, `punch_types_used`, `punch_manufacturers_used`, `punch_motion`, `motor_speed_rpm`
- graft handling/implant protocol: `holding_solutions_used`, `primary_holding_solution`, `temperature_controlled_storage`, `sorting_performed`, `recipient_sites_created_by`, `site_creation_method`, `implantation_method`, `implantation_devices_used`, `primary_implantation_device`, `implanted_by`
- adjunctive and aftercare protocol: `intraoperative_adjuncts_used`, `intraop_prp_used`, `intraop_exosomes_used`, `postoperative_treatments_included`, `postoperative_treatments_recommended`, `finasteride_recommended`, `minoxidil_recommended`, `donor_recovery_protocol_included`, `postoperative_protocol_notes`

For this group, schema metadata flags are set to:

- `isDefaultable: true`
- `canPrefillFromDoctorDefault: true` (doctor defaults)
- `canPrefillFromClinicDefault: true` (clinic defaults)

---

## Follow-up-only fields that must be updated each review

Exported as `followupOnlyFields` in `src/config/auditSchema.ts`.

These are explicitly fresh-entry fields for every follow-up audit:

- review-stage outcomes: `outcome_audit_stage`, `growth_outcome_category`, `donor_healing_category`, `patient_satisfaction_category`, `corrective_surgery_likely`, `outcome_notes`
- forensic review deltas: `review_concern_categories`, `claimed_evidenced_discrepancy`, `incomplete_records_flag`, `case_complexity_rating`, `auditor_confidence_level`, `forensic_notes`
- follow-up evidence uploads: `img_followup_front`, `img_followup_top`, `img_followup_crown`, `img_followup_donor`, `img_trichoscopy`

For this group, schema metadata flags are set to:

- `isFollowupOnly: true`
- `canInheritFromOriginalCase: false`

Recommended follow-up UX framing:

- “Copy from previous case”
- “Inherited from original surgery record”
- “Add advanced data to improve confidence and benchmarking”

---

## Doctor Basic Fields

Required for basic completion:

- `submission_type` (single select)
- `audit_type` (single select)
- `case_id` (text)
- `clinic_name` (text/searchable select)
- `doctor_name` (text/searchable select)
- `country_jurisdiction` (single select)
- `surgery_date` (date)
- `multi_day_flag` (yes/no)
- `requested_by` (single select)
- `review_purpose` (multi-select)
- `previous_surgery_history` (yes/no)
- `repair_case_flag` (yes/no)
- `procedure_type` (multi-select)
- `primary_procedure_type` (single select)
- `areas_treated` (multi-select)
- `primary_area_treated` (single select, optional)
- `hairline_lowering_flag` (yes/no, optional)
- `crown_included_flag` (yes/no, optional)
- `patient_age_bracket` (single select)
- `patient_sex` (single select)
- `hair_type_curl_pattern` (single select)
- `hair_calibre_category` (single select)
- `ethnicity_hair_background` (multi-select, optional)
- `primary_diagnosis` (single select)
- `hair_loss_scale_used` (single select)
- `hair_loss_grade` (text/single value)
- `hair_loss_stability` (single select)
- `miniaturisation_present` (yes/no)
- `planned_graft_count` (number, integer)
- `actual_graft_count` (number, integer)
- `zones_planned` (multi-select)
- `future_loss_planning` (yes/no, optional)
- `donor_quality_rating` (single select)
- `donor_density_rating` (single select)
- `safe_donor_zone_assessed` (yes/no)
- `estimated_donor_capacity` (single select/number, optional)
- `donor_scarring_present` (yes/no, optional)
- `overharvesting_risk_flag` (yes/no, optional)
- `extraction_method` (multi-select)
- `extraction_technique` (multi-select)
- `extraction_operator` (single select)
- `transection_category` (single select, optional)
- `recipient_sites_created_by` (single select)
- `site_creation_method` (multi-select)
- `dense_packing_attempted` (yes/no, optional)
- `extraction_devices_used` (multi-select)
- `punch_sizes_used` (multi-select)
- `punch_types_used` (multi-select)
- `holding_solutions_used` (multi-select)
- `grafts_kept_hydrated` (yes/no)
- `sorting_performed` (yes/no, optional)
- `implantation_method` (multi-select)
- `implantation_devices_used` (multi-select)
- `implanted_by` (single select)
- `intraoperative_adjuncts_used` (multi-select, optional)
- `postoperative_treatments_included` (multi-select)
- `postoperative_treatments_recommended` (multi-select)
- `follow_up_plan_documented` (yes/no)
- `outcome_audit_stage` (single select, optional)
- `growth_outcome_category` (single select, optional)
- `donor_healing_category` (single select, optional)

Basic-required fields are enforced in schema; fields marked optional remain optional.

## Doctor Advanced Fields

Optional advanced/forensic fields:

- `clinic_branch` (text)
- `additional_operators` (multi-select)
- `additional_operators_details` (textarea)
- `procedure_day_breakdown` (textarea)
- `previous_surgery_details` (textarea)
- `beard_donor_used` (yes/no)
- `body_donor_used` (yes/no)
- `hair_shaft_diameter_microns` (number)
- `hair_colour` (single select)
- `skin_hair_contrast` (single select)
- `secondary_diagnosis` (multi-select)
- `miniaturisation_regions` (multi-select)
- `dupa_retrograde_flag` (yes/no)
- `scalp_condition_flags` (multi-select)
- `estimated_hair_count` (number, integer)
- `density_goal_by_zone` (structured textarea / repeater)
- `hairline_design_strategy` (textarea)
- `risk_counselling_documented` (yes/no)
- `candidate_suitability_rating` (single select)
- `donor_density_per_cm2` (number)
- `avg_hairs_per_graft` (number/decimal)
- `overharvesting_signs` (multi-select)
- `donor_mapping_notes` (textarea)
- `primary_extraction_device` (single select)
- `extraction_experience_years` (number)
- `punch_motion` (multi-select)
- `motor_speed_rpm` (number)
- `extraction_device_change_notes` (textarea)
- `punch_size_change_notes` (textarea)
- `punch_type_change_notes` (textarea)
- `reason_for_intraoperative_changes` (textarea)
- `transection_rate_percent` (number)
- `buried_graft_rate_percent` (number)
- `extraction_time_minutes` (number)
- `slit_orientation` (single select)
- `site_instrument_sizes_used` (multi-select)
- `hairline_direction_quality` (single select)
- `angle_direction_notes` (textarea)
- `native_hair_protection_strategy` (textarea)
- `primary_punch_size` (single select)
- `primary_punch_type` (single select)
- `punch_manufacturers_used` (multi-select)
- `primary_holding_solution` (single select)
- `primary_implantation_device` (single select)
- `implantation_time_minutes` (number)
- `singles_reserved_for_hairline` (yes/no)
- `intraop_prp_used` (yes/no)
- `intraop_exosomes_used` (yes/no)
- `exosome_type` (single select / text)
- `partial_transection_used` (yes/no)
- `intraop_adjunct_notes` (textarea)
- `extraction_device_change_notes` (textarea)
- `punch_size_change_notes` (textarea)
- `punch_type_change_notes` (textarea)
- `holding_solution_notes` (textarea)
- `graft_handling_team_notes` (textarea)
- `microscopic_inspection_used` (yes/no)
- `graft_composition_available` (yes/no)
- `graft_tray_quality_rating` (single select)
- `graft_sorting_method` (multi-select)
- `visible_transection_on_tray` (single select)
- `graft_tissue_quality_concern` (multi-select)
- `microscopic_graft_review_available` (yes/no)
- `implantation_device_notes` (textarea)
- `popping_issues_observed` (yes/no)
- `implant_depth_consistency` (single select)
- `postoperative_protocol_notes` (textarea)
- `finasteride_recommended` (yes/no)
- `minoxidil_recommended` (yes/no)
- `donor_recovery_protocol_included` (yes/no)
- `patient_satisfaction_category` (single select)
- `corrective_surgery_likely` (yes/no)
- `outcome_notes` (textarea)
- `review_concern_categories` (multi-select)
- `claimed_evidenced_discrepancy` (yes/no)
- `incomplete_records_flag` (yes/no)
- `case_complexity_rating` (single select)
- `auditor_confidence_level` (single select)
- `forensic_notes` (textarea)
- `reason_for_intraoperative_changes` (textarea)
- `motor_speed_rpm` (number)
- `punch_motion` (multi-select)
- `transection_rate_percent` (number)
- `buried_graft_rate_percent` (number)
- `out_of_body_time_category` (single select)
- `temperature_controlled_storage` (single select)
- `surgeon_vs_technician_split_notes` (textarea)

---

## Clinic Basic Fields

Required for basic completion:

- `submission_type` (single select)
- `audit_type` (single select)
- `case_id` (text)
- `clinic_name` (text/searchable select)
- `doctor_name` (text/searchable select)
- `country_jurisdiction` (single select)
- `surgery_date` (date)
- `multi_day_flag` (yes/no)
- `requested_by` (single select)
- `review_purpose` (multi-select)
- `previous_surgery_history` (yes/no)
- `repair_case_flag` (yes/no)
- `procedure_type` (multi-select)
- `primary_procedure_type` (single select)
- `areas_treated` (multi-select)
- `primary_area_treated` (single select, optional)
- `hairline_lowering_flag` (yes/no, optional)
- `crown_included_flag` (yes/no, optional)
- `patient_age_bracket` (single select)
- `patient_sex` (single select)
- `hair_type_curl_pattern` (single select)
- `hair_calibre_category` (single select)
- `ethnicity_hair_background` (multi-select, optional)
- `primary_diagnosis` (single select)
- `hair_loss_scale_used` (single select)
- `hair_loss_grade` (text/single value)
- `hair_loss_stability` (single select)
- `miniaturisation_present` (yes/no)
- `planned_graft_count` (number, integer)
- `actual_graft_count` (number, integer)
- `zones_planned` (multi-select)
- `future_loss_planning` (yes/no, optional)
- `donor_quality_rating` (single select)
- `donor_density_rating` (single select)
- `safe_donor_zone_assessed` (yes/no)
- `estimated_donor_capacity` (single select/number, optional)
- `donor_scarring_present` (yes/no, optional)
- `overharvesting_risk_flag` (yes/no, optional)
- `extraction_method` (multi-select)
- `extraction_technique` (multi-select)
- `extraction_operator` (single select)
- `transection_category` (single select, optional)
- `recipient_sites_created_by` (single select)
- `site_creation_method` (multi-select)
- `dense_packing_attempted` (yes/no, optional)
- `extraction_devices_used` (multi-select)
- `punch_sizes_used` (multi-select)
- `punch_types_used` (multi-select)
- `holding_solutions_used` (multi-select)
- `grafts_kept_hydrated` (yes/no)
- `sorting_performed` (yes/no, optional)
- `implantation_method` (multi-select)
- `implantation_devices_used` (multi-select)
- `implanted_by` (single select)
- `intraoperative_adjuncts_used` (multi-select, optional)
- `postoperative_treatments_included` (multi-select)
- `postoperative_treatments_recommended` (multi-select)
- `follow_up_plan_documented` (yes/no)
- `outcome_audit_stage` (single select, optional)
- `growth_outcome_category` (single select, optional)
- `donor_healing_category` (single select, optional)

Basic-required fields are enforced in schema; fields marked optional remain optional.

## Clinic Advanced Fields

Optional advanced/forensic fields:

- `clinic_branch` (text)
- `additional_operators` (multi-select)
- `additional_operators_details` (textarea)
- `procedure_day_breakdown` (textarea)
- `previous_surgery_details` (textarea)
- `beard_donor_used` (yes/no)
- `body_donor_used` (yes/no)
- `hair_shaft_diameter_microns` (number)
- `hair_colour` (single select)
- `skin_hair_contrast` (single select)
- `secondary_diagnosis` (multi-select)
- `miniaturisation_regions` (multi-select)
- `dupa_retrograde_flag` (yes/no)
- `scalp_condition_flags` (multi-select)
- `estimated_hair_count` (number, integer)
- `density_goal_by_zone` (structured textarea / repeater)
- `hairline_design_strategy` (textarea)
- `risk_counselling_documented` (yes/no)
- `candidate_suitability_rating` (single select)
- `donor_density_per_cm2` (number)
- `avg_hairs_per_graft` (number/decimal)
- `overharvesting_signs` (multi-select)
- `donor_mapping_notes` (textarea)
- `primary_extraction_device` (single select)
- `extraction_experience_years` (number)
- `punch_motion` (multi-select)
- `motor_speed_rpm` (number)
- `extraction_device_change_notes` (textarea)
- `punch_size_change_notes` (textarea)
- `punch_type_change_notes` (textarea)
- `reason_for_intraoperative_changes` (textarea)
- `transection_rate_percent` (number)
- `buried_graft_rate_percent` (number)
- `extraction_time_minutes` (number)
- `slit_orientation` (single select)
- `site_instrument_sizes_used` (multi-select)
- `hairline_direction_quality` (single select)
- `angle_direction_notes` (textarea)
- `native_hair_protection_strategy` (textarea)
- `primary_punch_size` (single select)
- `primary_punch_type` (single select)
- `punch_manufacturers_used` (multi-select)
- `primary_holding_solution` (single select)
- `primary_implantation_device` (single select)
- `implantation_time_minutes` (number)
- `singles_reserved_for_hairline` (yes/no)
- `intraop_prp_used` (yes/no)
- `intraop_exosomes_used` (yes/no)
- `exosome_type` (single select / text)
- `partial_transection_used` (yes/no)
- `intraop_adjunct_notes` (textarea)
- `extraction_device_change_notes` (textarea)
- `punch_size_change_notes` (textarea)
- `punch_type_change_notes` (textarea)
- `holding_solution_notes` (textarea)
- `graft_handling_team_notes` (textarea)
- `microscopic_inspection_used` (yes/no)
- `graft_composition_available` (yes/no)
- `graft_tray_quality_rating` (single select)
- `graft_sorting_method` (multi-select)
- `visible_transection_on_tray` (single select)
- `graft_tissue_quality_concern` (multi-select)
- `microscopic_graft_review_available` (yes/no)
- `implantation_device_notes` (textarea)
- `popping_issues_observed` (yes/no)
- `implant_depth_consistency` (single select)
- `postoperative_protocol_notes` (textarea)
- `finasteride_recommended` (yes/no)
- `minoxidil_recommended` (yes/no)
- `donor_recovery_protocol_included` (yes/no)
- `patient_satisfaction_category` (single select)
- `corrective_surgery_likely` (yes/no)
- `outcome_notes` (textarea)
- `review_concern_categories` (multi-select)
- `claimed_evidenced_discrepancy` (yes/no)
- `incomplete_records_flag` (yes/no)
- `case_complexity_rating` (single select)
- `auditor_confidence_level` (single select)
- `forensic_notes` (textarea)
- `reason_for_intraoperative_changes` (textarea)
- `motor_speed_rpm` (number)
- `punch_motion` (single select)
- `transection_rate_percent` (number)
- `buried_graft_rate_percent` (number)
- `out_of_body_time_category` (single select)
- `temperature_controlled_storage` (single select)
- `surgeon_vs_technician_split_notes` (textarea)

---

## Multi-Select vs Single-Select

### Multi-select fields

- `extraction_devices_used`
- `punch_sizes_used`
- `punch_types_used`
- `punch_manufacturers_used`
- `holding_solutions_used`
- `implantation_devices_used`
- `implantation_method`
- `intraoperative_adjuncts_used`
- `postoperative_treatments_included`
- `postoperative_treatments_recommended`
- `review_purpose`
- `additional_operators`
- `procedure_type`
- `areas_treated`
- `ethnicity_hair_background`
- `secondary_diagnosis`
- `miniaturisation_regions`
- `scalp_condition_flags`
- `zones_planned`
- `overharvesting_signs`
- `extraction_method`
- `extraction_technique`
- `punch_motion`
- `site_creation_method`
- `site_instrument_sizes_used`
- `review_concern_categories`
- `graft_sorting_method`
- `graft_tissue_quality_concern`

### Single-select fields

- `primary_extraction_device`
- `primary_punch_size`
- `primary_punch_type`
- `primary_holding_solution`
- `primary_implantation_device`
- `out_of_body_time_category`
- `temperature_controlled_storage`
- `recipient_sites_created_by`
- `slit_orientation`
- `hairline_direction_quality`
- `graft_tray_quality_rating`
- `visible_transection_on_tray`
- `submission_type`
- `audit_type`
- `country_jurisdiction`
- `requested_by`
- `previous_surgery_history`
- `repair_case_flag`
- `multi_day_flag`
- `primary_procedure_type`
- `primary_area_treated`
- `hairline_lowering_flag`
- `crown_included_flag`
- `beard_donor_used`
- `body_donor_used`
- `patient_age_bracket`
- `patient_sex`
- `hair_type_curl_pattern`
- `hair_calibre_category`
- `hair_colour`
- `skin_hair_contrast`
- `primary_diagnosis`
- `hair_loss_scale_used`
- `hair_loss_stability`
- `miniaturisation_present`
- `dupa_retrograde_flag`
- `future_loss_planning`
- `risk_counselling_documented`
- `candidate_suitability_rating`
- `donor_quality_rating`
- `donor_density_rating`
- `safe_donor_zone_assessed`
- `donor_scarring_present`
- `overharvesting_risk_flag`
- `estimated_donor_capacity`
- `extraction_operator`
- `transection_category`
- `grafts_kept_hydrated`
- `sorting_performed`
- `microscopic_inspection_used`
- `graft_composition_available`
- `dense_packing_attempted`
- `follow_up_plan_documented`
- `implanted_by`
- `exosome_type`
- `implant_depth_consistency`
- `finasteride_recommended`
- `minoxidil_recommended`
- `donor_recovery_protocol_included`
- `outcome_audit_stage`
- `growth_outcome_category`
- `donor_healing_category`
- `patient_satisfaction_category`
- `corrective_surgery_likely`
- `claimed_evidenced_discrepancy`
- `incomplete_records_flag`
- `case_complexity_rating`
- `auditor_confidence_level`

---

## Required for Basic Audit Completion

For both doctor and clinic:

- `submission_type`
- `audit_type`
- `case_id`
- `clinic_name`
- `doctor_name`
- `country_jurisdiction`
- `surgery_date`
- `multi_day_flag`
- `requested_by`
- `review_purpose`
- `previous_surgery_history`
- `repair_case_flag`
- `procedure_type`
- `primary_procedure_type`
- `areas_treated`
- `patient_age_bracket`
- `patient_sex`
- `hair_type_curl_pattern`
- `hair_calibre_category`
- `primary_diagnosis`
- `hair_loss_scale_used`
- `hair_loss_grade`
- `hair_loss_stability`
- `miniaturisation_present`
- `planned_graft_count`
- `actual_graft_count`
- `zones_planned`
- `donor_quality_rating`
- `donor_density_rating`
- `safe_donor_zone_assessed`
- `extraction_method`
- `extraction_technique`
- `extraction_operator`
- `recipient_sites_created_by`
- `site_creation_method`
- `extraction_devices_used`
- `punch_sizes_used`
- `punch_types_used`
- `holding_solutions_used`
- `implantation_method`
- `grafts_kept_hydrated`
- `implantation_devices_used`
- `implanted_by`
- `postoperative_treatments_included`
- `postoperative_treatments_recommended`
- `follow_up_plan_documented`

Enforced by:

- Doctor validation: `src/lib/doctorAuditSchema.ts`
- Clinic validation: `src/lib/clinicAuditSchema.ts`

---

## Why these fields are multi-select

These fields are multi-select because one surgery can involve multiple tools/protocols in a single case:

- Surgeons may swap from **sharp** to **serrated** punch during extraction.
- Multiple punch diameters can be used in one surgery for zone-specific extraction strategy.
- Storage can involve a base medium plus additives (for example saline + ATP-enhanced support).
- Implantation can be mixed (for example implanter + forceps).
- Multiple post-op treatments may be both included in package and recommended for maintenance.
- Review purpose is often mixed (for example QA + Training + Certification for one submission).
- Additional operators can include multiple surgeon/technician roles in a single case.
- Procedure type is often mixed (for example FUE + Repair + Scar Revision in one case).
- Areas treated commonly span multiple zones in a single surgery (for example hairline + temples + crown).
- Ethnicity / hair background can be mixed and affects hairline/curl interpretation in forensic review.
- Secondary diagnoses and scalp condition flags are often mixed contributors, not single-cause patterns.
- Planned zones are often multi-area and must be captured as multi-select for plan-vs-result variance review.
- Overharvesting signs may co-occur (for example patchiness + visible thinning), so these are modeled as multi-select.
- Extraction methods/techniques are frequently mixed in one case and should be modeled as multi-select.
- Recipient site creation can be mixed in one session (for example blade + needle), so site creation method is multi-select.

---

## Image & Evidence Upload Definitions

Applied for both doctor and clinic evidence uploads:

- `img_preop_front` (basic, required, image upload, `1-3`)
- `img_preop_left` (basic, required, image upload, `1-2`)
- `img_preop_right` (basic, required, image upload, `1-2`)
- `img_preop_top` (basic, required, image upload, `1-3`)
- `img_preop_crown` (basic, conditional, image upload, `1-3`)
- `img_preop_donor_rear` (basic, required, image upload, `1-3`)
- `img_preop_donor_sides` (advanced, optional, image upload, `1-4`)
- `img_marking_design` (advanced, optional, image upload, `1-4`)
- `img_immediate_postop_recipient` (basic, required, image upload, `1-4`)
- `img_immediate_postop_donor` (basic, required, image upload, `1-4`)
- `img_intraop_extraction` (advanced, optional, image upload, `1-6`)
- `img_graft_inspection` (advanced, optional, image upload, `1-6`)
- `img_graft_tray_overview` (advanced, optional, image upload, `1-4`)
- `img_graft_tray_closeup` (advanced, optional, image upload, `2-8`)
- `img_graft_microscopy` (advanced, optional, image upload, `1-10`)
- `img_site_creation` (advanced, optional, image upload, `1-6`)
- `img_implantation_stage` (advanced, optional, image upload, `1-6`)
- `img_followup_front` (basic, conditional, image upload, `1-3`)
- `img_followup_top` (basic, conditional, image upload, `1-3`)
- `img_followup_crown` (basic, conditional, image upload, `1-3`)
- `img_followup_donor` (basic, conditional, image upload, `1-3`)
- `img_trichoscopy` (advanced, optional, image upload, `1-10`)
- `file_operative_notes` (advanced, optional, file upload, `1`, accepts PDF/DOC/DOCX)
- `file_case_records` (advanced, optional, file upload, `1`, accepts PDF/DOC/DOCX)

Implemented in:

- Doctor upload schema: `src/lib/photoSchemas.ts` (`DOCTOR_PHOTO_SCHEMA`)
- Doctor scoring/completeness: `src/lib/auditPhotoSchemas.ts`
- Clinic category definitions: `src/lib/clinicPhotoCategories.ts`
- Doctor category definitions: `src/lib/doctorPhotoCategories.ts`
