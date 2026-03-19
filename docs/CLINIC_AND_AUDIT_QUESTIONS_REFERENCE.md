# Full List: Clinic Questions & Audit Questions

Reference list of all question IDs and prompts for **Clinic**, **Doctor Audit**, and **Patient Audit** forms. Use this to streamline data uploads, CSV mapping, or bulk imports.

---

## 1. CLINIC AUDIT FORM (`src/lib/clinicAuditForm.ts`)

*Clinic performance, facilities, pricing — ~15–20 min.*

### 1.1 Clinic Information (`clinic_info`)
| ID | Prompt |
|----|--------|
| clinic_name | Clinic Name |
| clinic_location | Clinic Location(s) |
| phone | Phone Number |
| email | Email Address |
| website | Website |
| years_operation | Years in Operation |

### 1.2 Clinic Facilities (`facilities`)
| ID | Prompt |
|----|--------|
| operating_rooms | Number of Operating Rooms |
| recovery_areas | Recovery Areas |
| waiting_rooms | Waiting Rooms |
| sterilization | Sterilization and Hygiene Protocols |
| emergency_equipment | Emergency Equipment (checkbox: defibrillator, oxygen, emergency_meds, backup_power, other) |

### 1.3 Case Identity & Submission Context (`case_identity_submission_context`)
| ID | Prompt |
|----|--------|
| submission_type | Audit Submission Type |
| audit_type | Audit Type |
| case_id | Case ID |
| clinic_name | Clinic Name |
| clinic_branch | Clinic Branch / Location |
| doctor_name | Doctor Name |
| country_jurisdiction | Country / Jurisdiction |
| surgery_date | Surgery Date |
| multi_day_flag | Multi-Day Procedure |
| requested_by | Requested By |
| review_purpose | Review Purpose (checkbox) |
| previous_surgery_history | Previous Surgery History |
| repair_case_flag | Corrective / Repair Case |

### 1.4 Advanced / Forensic Case Context (`case_identity_submission_context_advanced`)
| ID | Prompt | Depends on |
|----|--------|------------|
| additional_operators | Additional Surgeons / Operators | — |
| additional_operators_details | Additional Operators (Names / Roles) | — |
| procedure_day_breakdown | Procedure Day Breakdown | multi_day_flag = yes |
| previous_surgery_details | Previous Surgery Details | previous_surgery_history = yes |

### 1.5 Basic — Procedure Type & Areas Treated (`procedure_type_areas_treated_basic`)
| ID | Prompt |
|----|--------|
| procedure_type | Procedure Type (checkbox) |
| primary_procedure_type | Primary Procedure Type |
| areas_treated | Areas Treated (checkbox) |
| primary_area_treated | Primary Area Treated |
| hairline_lowering_flag | Hairline Lowering Performed |
| crown_included_flag | Crown Work Included |

### 1.6 Advanced — Procedure Type & Areas Treated (`procedure_type_areas_treated_advanced`)
| ID | Prompt |
|----|--------|
| beard_donor_used | Beard Donor Used |
| body_donor_used | Body Donor Used |

### 1.7 Basic — Patient Baseline (`patient_baseline_basic`)
| ID | Prompt |
|----|--------|
| patient_age_bracket | Patient Age Bracket |
| patient_sex | Sex |
| ethnicity_hair_background | Ethnicity / Hair Background (checkbox) |
| hair_type_curl_pattern | Hair Type / Curl Pattern |
| hair_calibre_category | Hair Calibre Category |

### 1.8 Advanced — Patient Baseline (`patient_baseline_advanced`)
| ID | Prompt |
|----|--------|
| hair_shaft_diameter_microns | Exact Hair Shaft Diameter (microns) |
| hair_colour | Hair Colour |
| skin_hair_contrast | Skin / Hair Contrast |

### 1.9 Basic — Diagnosis & Hair Loss Pattern (`diagnosis_pattern_basic`)
| ID | Prompt |
|----|--------|
| primary_diagnosis | Primary Diagnosis |
| hair_loss_scale_used | Hair Loss Scale Used |
| hair_loss_grade | Hair Loss Grade |
| hair_loss_stability | Hair Loss Stability |
| miniaturisation_present | Miniaturisation Present |

### 1.10 Advanced — Diagnosis & Hair Loss Pattern (`diagnosis_pattern_advanced`)
| ID | Prompt |
|----|--------|
| secondary_diagnosis | Secondary Diagnosis / Contributors (checkbox) |
| miniaturisation_regions | Miniaturisation Regions (checkbox) |
| dupa_retrograde_flag | DUPA / Retrograde Concern |
| scalp_condition_flags | Scalp Condition Flags (checkbox) |

### 1.11 Basic — Pre-Operative Planning (`preoperative_planning_basic`)
| ID | Prompt |
|----|--------|
| planned_graft_count | Planned Graft Count |
| actual_graft_count | Actual Graft Count |
| zones_planned | Zones Planned (checkbox) |
| future_loss_planning | Future Loss Planning Considered |

### 1.12 Advanced — Pre-Operative Planning (`preoperative_planning_advanced`)
| ID | Prompt |
|----|--------|
| estimated_hair_count | Estimated Hair Count |
| density_goal_by_zone | Density Goal by Zone |
| hairline_design_strategy | Hairline Design Strategy |
| risk_counselling_documented | Risk Counselling Documented |
| candidate_suitability_rating | Candidate Suitability Rating |

### 1.13 Basic — Donor Assessment (`donor_assessment_basic`)
| ID | Prompt |
|----|--------|
| donor_quality_rating | Donor Quality Rating |
| donor_density_rating | Donor Density Rating |
| estimated_donor_capacity | Estimated Donor Capacity |
| estimated_donor_capacity_numeric | Estimated Donor Capacity (numeric) |
| safe_donor_zone_assessed | Safe Donor Zone Assessed |
| donor_scarring_present | Scarring Present in Donor |
| overharvesting_risk_flag | Overharvesting Risk Flag |

### 1.14 Advanced — Donor Assessment (`donor_assessment_advanced`)
| ID | Prompt |
|----|--------|
| donor_density_per_cm2 | Donor Density per cm² |
| avg_hairs_per_graft | Average Hairs per Graft |
| overharvesting_signs | Overharvesting Signs Observed (checkbox) |
| donor_mapping_notes | Donor Mapping Notes |

### 1.15 Staff Qualifications (`staff`)
| ID | Prompt |
|----|--------|
| num_surgeons | Number of Surgeons |
| avg_experience | Average Years of Experience for Surgeons |
| num_nurses_techs | Number of Nurses/Technicians |
| staff_training | Staff Training Programs |
| staff_certifications | Certifications of Key Staff |

### 1.16 Procedure Statistics (`statistics`)
| ID | Prompt |
|----|--------|
| procedures_annually | Total Hair Transplant Procedures Performed Annually |
| success_rate | Success Rate (%) |
| patient_satisfaction | Patient Satisfaction Score (1–5) |
| complication_rate | Complication Rate (%) |

### 1.17 Basic — Surgical Metadata (`surgical_metadata_basic`)
| ID | Prompt |
|----|--------|
| extraction_method | Extraction Method (checkbox) |
| extraction_devices_used | Extraction Devices/Systems Used (checkbox) |
| extraction_technique | Extraction Technique (checkbox) |
| extraction_operator | Extraction Performed By |
| punch_sizes_used | Punch Sizes Used (checkbox) |
| punch_types_used | Punch Types Used (checkbox) |
| holding_solutions_used | Holding/Storage Solutions Used (checkbox) |
| grafts_kept_hydrated | Grafts Kept Hydrated |
| sorting_performed | Sorting Performed |
| implantation_method | Implantation Method (checkbox) |
| implantation_devices_used | Implantation Devices Used (checkbox) |
| implanted_by | Implanted By |
| intraoperative_adjuncts_used | Intraoperative Adjuncts Used (checkbox) |
| postoperative_treatments_included | Post-Operative Treatments Included (checkbox) |
| postoperative_treatments_recommended | Post-Operative Treatments Recommended (checkbox) |
| follow_up_plan_documented | Follow-Up Plan Documented |
| outcome_audit_stage | Outcome Audit Stage |
| growth_outcome_category | Growth Outcome Category |
| donor_healing_category | Donor Healing Category |
| recipient_sites_created_by | Recipient Sites Created By |
| site_creation_method | Site Creation Method (checkbox) |
| dense_packing_attempted | Dense Packing Attempted |
| transection_category | Estimated Transection Category |

### 1.18 Advanced / Forensic — Surgical Metadata (`surgical_metadata_advanced`)
| ID | Prompt |
|----|--------|
| primary_extraction_device | Primary Extraction Device/System |
| extraction_experience_years | Extraction Experience Years |
| primary_punch_size | Primary Punch Size |
| primary_punch_type | Primary Punch Type |
| punch_manufacturers_used | Punch Manufacturers Used (checkbox) |
| primary_holding_solution | Primary Holding Solution |
| primary_implantation_device | Primary Implantation Device |
| implantation_time_minutes | Implantation Time (minutes) |
| singles_reserved_for_hairline | Singles Reserved for Hairline |
| intraop_prp_used | PRP Used Intraoperatively |
| intraop_exosomes_used | Exosomes Used Intraoperatively |
| exosome_type | Exosome Type (if intraop_exosomes_used = yes) |
| partial_transection_used | Partial Transection Technique Used |
| intraop_adjunct_notes | Intraoperative Adjunct Notes |
| extraction_device_change_notes | Extraction Device Change Notes |
| punch_size_change_notes | Punch Size Change Notes |
| punch_type_change_notes | Punch Type Change Notes |
| holding_solution_notes | Holding Solution Notes |
| graft_handling_team_notes | Graft Handling Team Notes |
| microscopic_inspection_used | Microscopic Inspection Used |
| graft_composition_available | Graft Composition Count Available |
| graft_tray_quality_rating | Graft Tray Quality Rating |
| graft_sorting_method | Graft Sorting Method (checkbox) |
| visible_transection_on_tray | Visible Transection on Tray |
| graft_tissue_quality_concern | Graft Tissue Quality Concern (checkbox) |
| microscopic_graft_review_available | Microscopic Graft Review Available |
| implantation_device_notes | Implantation Device Notes |
| popping_issues_observed | Popping Issues Observed |
| implant_depth_consistency | Implant Depth Consistency |
| postoperative_protocol_notes | Post-Operative Protocol Notes |
| finasteride_recommended | Finasteride Recommended |
| minoxidil_recommended | Minoxidil Recommended |
| donor_recovery_protocol_included | Donor Recovery Protocol Included |
| patient_satisfaction_category | Patient Satisfaction Category |
| corrective_surgery_likely | Corrective Surgery Likely Needed |
| outcome_notes | Outcome Notes |
| review_concern_categories | Review Concern Categories (checkbox) |
| claimed_evidenced_discrepancy | Claimed vs Evidenced Discrepancy |
| incomplete_records_flag | Incomplete Records Flag |
| case_complexity_rating | Case Complexity Rating |
| auditor_confidence_level | Auditor Confidence Level |
| forensic_notes | Freeform Forensic Notes |
| reason_for_intraoperative_changes | Reason for Intra-Operative Changes |
| motor_speed_rpm | Motor Speed (RPM) |
| punch_motion | Punch Motion (checkbox) |
| transection_rate_percent | Transection Rate (%) |
| buried_graft_rate_percent | Buried Graft Rate (%) |
| extraction_time_minutes | Extraction Time (minutes) |
| slit_orientation | Coronal / Sagittal Orientation |
| site_instrument_sizes_used | Site Instrument Sizes Used (checkbox) |
| hairline_direction_quality | Hairline Direction Quality |
| angle_direction_notes | Angle / Direction Strategy Notes |
| native_hair_protection_strategy | Native Hair Protection Strategy |
| out_of_body_time_category | Out-of-Body Time Category |
| temperature_controlled_storage | Temperature Controlled Storage |
| surgeon_vs_technician_split_notes | Surgeon vs Technician Split Notes |

### 1.19 Pricing Structure (`pricing`)
| ID | Prompt |
|----|--------|
| cost_range | Typical Cost Range for Hair Transplant Procedures |
| cost_included | What Is Typically Included in the Cost? (checkbox) |

### 1.20 Quality Assurance (`quality`)
| ID | Prompt |
|----|--------|
| quality_control | Quality Control Measures |
| equipment_maintenance | Equipment Maintenance Schedule |
| safety_protocols | Patient Safety Protocols |
| certifications | Certifications and Accreditations |

### 1.21 Patient Services (`services`)
| ID | Prompt |
|----|--------|
| preop_services | Pre-Operative Services (checkbox) |
| postop_services | Post-Operative Services (checkbox) |
| additional_services | Additional Services (checkbox) |

### 1.22 Technology and Equipment (`technology`)
| ID | Prompt |
|----|--------|
| techniques_offered | Hair Transplant Techniques Offered (checkbox) |
| advanced_tech | Advanced Technologies Used |
| graft_preservation | Graft Preservation Methods |

### 1.23 Patient Testimonials (Optional) (`testimonials`)
| ID | Prompt |
|----|--------|
| testimonials | Patient Testimonials |
| reviews_link | Link to Online Reviews |

---

## 2. DOCTOR AUDIT FORM (`src/lib/doctorAuditForm.ts`)

*Surgery submission / case audit — target 6–8 min. Conditional FUE/FUT sections.*

### 2.1 Doctor & Clinic Profile (`doctor_clinic`)
| ID | Prompt |
|----|--------|
| doctorName | Doctor's Name |
| clinicName | Clinic Name |
| clinicLocation | Clinic Location |
| medicalDegree | Medical Degree |
| yearsPerformingHairTransplants | Years Performing Hair Transplants |
| percentPracticeHairTransplant | Percent of Practice Devoted to Hair Transplant |
| memberships | Memberships (checkbox: ISHRS, ABHRS, national_board, other) |
| otherMembershipText | Other membership (if other) |

### 2.2 Case Identity & Submission Context (`case_identity_submission_context`)
Same IDs as Clinic 1.3: submission_type, audit_type, case_id, clinic_name, clinic_branch, doctor_name, country_jurisdiction, surgery_date, multi_day_flag, requested_by, review_purpose, previous_surgery_history, repair_case_flag.

### 2.3 Advanced Case Identity (`case_identity_submission_context_advanced`)
Same as Clinic 1.4: additional_operators, additional_operators_details, procedure_day_breakdown, previous_surgery_details.

### 2.4 Procedure Type & Areas Treated — Basic (`procedure_type_areas_treated_basic`)
Same as Clinic 1.5: procedure_type, primary_procedure_type, areas_treated, primary_area_treated, hairline_lowering_flag, crown_included_flag.

### 2.5 Procedure Type & Areas Treated — Advanced (`procedure_type_areas_treated_advanced`)
Same as Clinic 1.6: beard_donor_used, body_donor_used.

### 2.6 Patient Baseline — Basic (`patient_baseline_basic`)
Same as Clinic 1.7: patient_age_bracket, patient_sex, ethnicity_hair_background, hair_type_curl_pattern, hair_calibre_category.

### 2.7 Patient Baseline — Advanced (`patient_baseline_advanced`)
Same as Clinic 1.8: hair_shaft_diameter_microns, hair_colour, skin_hair_contrast.

### 2.8 Diagnosis & Hair Loss Pattern — Basic (`diagnosis_pattern_basic`)
Same as Clinic 1.9: primary_diagnosis, hair_loss_scale_used, hair_loss_grade, hair_loss_stability, miniaturisation_present.

### 2.9 Diagnosis & Hair Loss Pattern — Advanced (`diagnosis_pattern_advanced`)
Same as Clinic 1.10: secondary_diagnosis, miniaturisation_regions, dupa_retrograde_flag, scalp_condition_flags.

### 2.10 Pre-Operative Planning — Basic (`preoperative_planning_basic`)
Same as Clinic 1.11: planned_graft_count, actual_graft_count, zones_planned, future_loss_planning.

### 2.11 Pre-Operative Planning — Advanced (`preoperative_planning_advanced`)
Same as Clinic 1.12: estimated_hair_count, density_goal_by_zone, hairline_design_strategy, risk_counselling_documented, candidate_suitability_rating.

### 2.12 Donor Assessment — Basic (`donor_assessment_basic`)
Same as Clinic 1.13: donor_quality_rating, donor_density_rating, estimated_donor_capacity, estimated_donor_capacity_numeric, safe_donor_zone_assessed, donor_scarring_present, overharvesting_risk_flag.

### 2.13 Donor Assessment — Advanced (`donor_assessment_advanced`)
Same as Clinic 1.14: donor_density_per_cm2, avg_hairs_per_graft, overharvesting_signs, donor_mapping_notes.

### 2.14 Patient Profile (De-identified) (`patient_profile`)
| ID | Prompt |
|----|--------|
| patientAge | Patient Age |
| patientGender | Patient Gender |
| hairLossClassification | Hair Loss Classification |
| hairLossOtherText | Hair loss classification (if Other) |
| donorDensityMeasuredPreOp | Donor Density Measured Pre-Op |
| preOpDensityFuPerCm2 | Pre-Op Density (FU/cm²) |

### 2.15 Procedure Overview (`procedure_overview`)
| ID | Prompt |
|----|--------|
| totalGraftsExtracted | Total Grafts Extracted |
| totalGraftsImplanted | Total Grafts Implanted |
| extractionPerformedBy | Extraction Performed By |
| implantationPerformedBy | Implantation Performed By |

### 2.16 Basic — Surgical Metadata (`surgical_metadata_basic`)
Same question set as Clinic 1.17 (extraction_method through transection_category; doctor form does not include recipient_sites_created_by, site_creation_method, dense_packing_attempted in this block but has them in recipient_implantation).

### 2.17 Donor Extraction Details — FUE Only (`fue_details`) — showWhen: primary_procedure_type in FUE types
| ID | Prompt |
|----|--------|
| fuePunchType | FUE Punch Type |
| fuePunchDiameterRangeMm | Punch Diameter Range (mm) |
| fuePunchMovement | Punch Movement |
| fueDepthControl | Depth Control |
| fueDocumentedTransectionRatePercent | Documented Transection Rate (%) |

### 2.18 FUT Details — FUT Only (`fut_details`) — showWhen: primary_procedure_type in FUT types
| ID | Prompt |
|----|--------|
| futBladeType | Blade Type |
| futClosureTechnique | Closure Technique |
| futMicroscopicDissectionUsed | Microscopic Dissection Used |

### 2.19 Graft Handling & Preservation (`graft_handling`)
| ID | Prompt |
|----|--------|
| holdingSolution | Holding Solution |
| holdingSolutionOtherText | Holding solution (if Other) |
| temperatureControlled | Temperature Controlled |
| outOfBodyTimeLogged | Out-of-Body Time Logged |
| avgOutOfBodyTimeHours | Avg Out-of-Body Time (hours) |
| microscopeStationsUsed | Microscope Stations Used |
| microscopeType | Microscope Type |

### 2.20 Recipient Site & Implantation (`recipient_implantation`)
| ID | Prompt |
|----|--------|
| recipient_sites_created_by | Recipient Sites Created By |
| site_creation_method | Site Creation Method (checkbox) |
| slit_orientation | Coronal / Sagittal Orientation |
| site_instrument_sizes_used | Site Instrument Sizes Used (checkbox) |
| recipientTool | Recipient Tool |
| implantationMethod | Implantation Method |
| dense_packing_attempted | Dense Packing Attempted |
| hairline_direction_quality | Hairline Direction Quality |
| angle_direction_notes | Angle / Direction Strategy Notes |
| native_hair_protection_strategy | Native Hair Protection Strategy |
| implanterType | Implanter Type (if implanter) |
| implanterOtherText | Implanter type (if Other) |

### 2.21 Donor Management (`donor_management`)
| ID | Prompt |
|----|--------|
| donorMappingMethod | Donor Mapping Method |
| percentExtractionPerZoneControlled | Percent Extraction Per Zone Controlled |
| postOpDonorDensityMeasured | Post-Op Donor Density Measured |

### 2.22 Sterility & Safety (`sterility_safety`)
| ID | Prompt |
|----|--------|
| sterilizationProtocol | Sterilization Protocol (checkbox) |
| graftCountDoubleVerified | Graft Count Double Verified |
| intraOpComplications | Intra-Op Complications |
| complicationsOtherText | Complications (if Other) |

### 2.23 Cost & Value Transparency (`cost`)
| ID | Prompt |
|----|--------|
| totalProcedureCostUsd | Total Procedure Cost (USD equivalent) |
| costModel | Cost Model |
| includedInCost | Included in Cost (checkbox) |

### 2.24 Post-Operative Protocol (`postop_protocol`)
| ID | Prompt |
|----|--------|
| dhtManagementRecommended | DHT Management Recommended |
| prpPostOpUsed | PRP Post-Op Used |
| followUpScheduleStandardized | Follow-Up Schedule Standardized |
| photoDocumentationRequired12Month | Photo Documentation Required (12 month) |

### 2.25 Advanced / Forensic Audit (`advanced_forensic_metadata`)
Same question set as Clinic 1.18 (primary_extraction_device through surgeon_vs_technician_split_notes).

### 2.26 Doctor Self-Assessment (`self_assessment`)
| ID | Prompt |
|----|--------|
| estimatedGraftSurvivalPercent | Estimated Graft Survival (%) |
| overallCaseSuccessRating | Overall Case Success (1–5) |
| notesOptional | Additional Notes |

---

## 3. PATIENT AUDIT FORM (`src/lib/patientAuditForm.ts`)

*Patient-facing intake — ~5–6 min. Optional advanced sections.*

### 3.1 Clinic & Procedure Details (`clinic_procedure`)
| ID | Prompt |
|----|--------|
| clinic_name | Clinic Name |
| clinic_country | Clinic Country |
| clinic_country_other | Clinic country (if Other) |
| clinic_city | Clinic City |
| procedure_date | Date of Procedure |
| procedure_type | Type of Procedure |
| procedure_type_other | Procedure type (if Other) |
| surgeon_name | Surgeon's Name (optional) |
| patient_name | Your Name (optional) |

### 3.2 Transparency & Process (`transparency`)
| ID | Prompt |
|----|--------|
| preop_consult | Did you have a pre-operative consultation? |
| doctor_present_extraction | Was a doctor present during graft extraction? |
| doctor_present_implant | Was a doctor present during graft implantation? |
| graft_number_disclosed | Were you told the graft count? |
| graft_number_received | Graft number (if you were given one) |
| donor_shaving | Donor area shaving |
| surgery_duration | Surgery duration |

### 3.3 Cost & Value Transparency (`cost`)
| ID | Prompt |
|----|--------|
| total_paid_currency | Currency |
| total_paid_currency_other | Currency (if Other) |
| total_paid_amount | Total Amount Paid |
| cost_model | How was the cost structured? |
| what_included | What was included? (checkbox) |
| what_included_other | Other inclusions (if other) |

### 3.4 Surgical Experience (`surgical_experience`)
| ID | Prompt |
|----|--------|
| pain_level | Pain level during surgery (1–10) |
| post_op_swelling | Post-operative swelling |
| bleeding_issue | Any significant bleeding? |

### 3.5 Recovery & Complications (`recovery`)
| ID | Prompt |
|----|--------|
| recovery_time | Recovery time |
| shock_loss | Did you experience shock loss? |
| complications | Any complications? |
| complications_details | Complication details (if yes) |

### 3.6 Results (`results`)
| ID | Prompt |
|----|--------|
| months_since | Months since procedure |
| density_satisfaction | Density satisfaction (1–5) |
| hairline_naturalness | Hairline naturalness (1–5) |
| donor_appearance | Donor area appearance (1–5) |
| would_repeat | Would you repeat the procedure with this clinic? |
| would_recommend | Would you recommend this clinic? |

### 3.7 Advanced — Basics (`adv_basics`, optional)
| ID | Prompt |
|----|--------|
| enhanced_patient_answers.baseline.patient_age | Age |
| enhanced_patient_answers.baseline.patient_sex | Sex |
| enhanced_patient_answers.baseline.smoking_status | Smoking status |
| enhanced_patient_answers.baseline.alcohol_frequency | Alcohol frequency |
| enhanced_patient_answers.baseline.diabetes | Diabetes |
| enhanced_patient_answers.baseline.autoimmune_conditions | Autoimmune conditions |
| enhanced_patient_answers.baseline.thyroid_issues | Thyroid issues |
| enhanced_patient_answers.baseline.clotting_disorders | Clotting disorders |
| enhanced_patient_answers.baseline.blood_thinners | Blood thinners |
| enhanced_patient_answers.baseline.steroid_use | Steroid use |
| enhanced_patient_answers.baseline.previous_scalp_surgeries | Previous scalp surgeries |

### 3.8 Advanced — Hair & Biology (`adv_hair_biology`, optional)
| ID | Prompt |
|----|--------|
| enhanced_patient_answers.hair_biology.hair_loss_duration_years | Hair loss duration (years) |
| enhanced_patient_answers.hair_biology.hair_loss_progression_speed | Progression speed |
| enhanced_patient_answers.hair_biology.family_history_strength | Family history strength |
| enhanced_patient_answers.hair_biology.current_medications_for_hair | Current hair medications |
| enhanced_patient_answers.hair_biology.stopped_medications_recently | Stopped hair meds recently? |
| enhanced_patient_answers.hair_biology.scalp_condition_history | Scalp condition history |
| enhanced_patient_answers.hair_biology.previous_prp_or_exosomes | Previous PRP or exosomes? |

### 3.9 Advanced — Procedure Details (`adv_procedure_details`, optional)
| ID | Prompt |
|----|--------|
| enhanced_patient_answers.procedure_execution.technician_role_extraction | Who performed extraction? |
| enhanced_patient_answers.procedure_execution.technician_role_implantation | Who performed implantation? |
| enhanced_patient_answers.procedure_execution.grafts_claimed_total | Total grafts claimed |
| enhanced_patient_answers.procedure_execution.graft_ratio | Graft ratio |
| enhanced_patient_answers.procedure_execution.hairline_drawn_by_doctor | Hairline drawn by doctor? |
| enhanced_patient_answers.procedure_execution.single_hair_grafts_front | Single-hair grafts used in the front? |
| enhanced_patient_answers.procedure_execution.crown_pattern_discussed | Crown pattern discussed? |
| enhanced_patient_answers.donor_profile.pre_existing_donor_thinning | Pre-existing donor thinning |
| enhanced_patient_answers.donor_profile.donor_density_measured | Was donor density measured? |
| enhanced_patient_answers.donor_profile.donor_area_marked_preop | Donor area marked pre-op? |
| enhanced_patient_answers.donor_profile.donor_extraction_pattern_observed | Extraction pattern observed |
| enhanced_patient_answers.donor_profile.multiple_days_of_extraction | Multiple days of extraction? |

### 3.10 Advanced — Graft Handling (`adv_graft_handling`, optional)
| ID | Prompt |
|----|--------|
| enhanced_patient_answers.graft_handling.out_of_body_time_estimate | Out-of-body time estimate |
| enhanced_patient_answers.graft_handling.storage_solution | Storage solution |
| enhanced_patient_answers.graft_handling.temperature_control | Temperature control |
| enhanced_patient_answers.graft_handling.grafts_kept_hydrated | Grafts kept hydrated? |
| enhanced_patient_answers.graft_handling.exposed_to_air | Exposed to air |
| enhanced_patient_answers.graft_handling.long_breaks_during_surgery | Long breaks during surgery? |

### 3.11 Advanced — Healing (`adv_healing`, optional)
| ID | Prompt |
|----|--------|
| enhanced_patient_answers.healing_course.current_month_postop | Current months post-op |
| enhanced_patient_answers.healing_course.shedding_start_week | Shedding start (week) |
| enhanced_patient_answers.healing_course.shedding_severity | Shedding severity |
| enhanced_patient_answers.healing_course.regrowth_start_month | Regrowth start (month) |
| enhanced_patient_answers.healing_course.visible_density_improvement | Visible density improvement |
| enhanced_patient_answers.healing_course.uneven_growth_present | Uneven growth present? |
| enhanced_patient_answers.healing_course.persistent_redness | Persistent redness? |
| enhanced_patient_answers.healing_course.recipient_irregularities | Recipient irregularities |

### 3.12 Advanced — Current Status (`adv_current_status`, optional)
| ID | Prompt |
|----|--------|
| enhanced_patient_answers.aesthetics.hairline_height_changed_cm | Hairline height changed (cm) |
| enhanced_patient_answers.aesthetics.temple_points_reconstructed | Temple points reconstructed? |
| enhanced_patient_answers.aesthetics.direction_matches_native | Direction matches native hair? |
| enhanced_patient_answers.aesthetics.crown_swirl_matches | Crown swirl matches? |
| enhanced_patient_answers.experience.communication_rating | Communication rating (1–5) |
| enhanced_patient_answers.experience.transparency_rating | Transparency rating (1–5) |
| enhanced_patient_answers.experience.felt_rushed | Felt rushed? |
| enhanced_patient_answers.experience.felt_informed | Felt informed? |
| enhanced_patient_answers.experience.legal_or_refund_dispute | Legal or refund dispute? |
| enhanced_patient_answers.experience.current_satisfaction | Current satisfaction (0–10) |
| enhanced_patient_answers.experience.biggest_concern_now | Biggest concern right now |
| enhanced_patient_answers.experience.considering_revision | Considering revision? |

---

## Quick reference: option sets

Option sets (e.g. SUBMISSION_TYPE_OPTIONS, BOOLEAN_YES_NO_OPTIONS) are defined in `src/lib/audit/masterSurgicalMetadata.ts`. Use that file for valid values when mapping CSV columns or bulk uploads.

---

## Streamlining uploads

1. **CSV columns**: Use the **ID** column as the CSV header; values must match the option `value` in the form when the field is select/checkbox.
2. **Conditional fields**: Respect `dependsOn` and `showWhen` (e.g. FUE-only, FUT-only, “if Other”) so optional columns are only required when applicable.
3. **Clinic vs Doctor overlap**: Many case-identity, procedure-type, baseline, diagnosis, planning, donor, and surgical-metadata IDs are shared between Clinic and Doctor forms; one mapping can serve both where sections align.
4. **Patient advanced**: All `enhanced_patient_answers.*` IDs are optional; omit or leave blank to speed patient intake.
