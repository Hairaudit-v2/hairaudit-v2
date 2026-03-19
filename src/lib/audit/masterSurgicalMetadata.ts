/**
 * Shared option registries for clinic and doctor audit forms.
 * - Legacy: existing option values are preserved for scoring/validation; do not remove or rename.
 * - New options use normalized value strings (snake_case, e.g. 0_70_mm).
 * - OPTION_GROUPS at end supports future searchable/grouped UI.
 */

export type AuditOption = { value: string; label: string };

export type Tier = "basic" | "advanced";

export const SUBMISSION_TYPE_OPTIONS: AuditOption[] = [
  { value: "doctor", label: "Doctor" },
  { value: "clinic", label: "Clinic" },
  { value: "internal", label: "Internal" },
];

export const AUDIT_DEPTH_TYPE_OPTIONS: AuditOption[] = [
  { value: "standard_audit", label: "Standard Audit" },
  { value: "advanced_audit", label: "Advanced Audit" },
  { value: "forensic_review", label: "Forensic Review" },
  { value: "training_review", label: "Training Review" },
  { value: "certification_review", label: "Certification Review" },
];

export const REQUESTED_BY_OPTIONS: AuditOption[] = [
  { value: "doctor", label: "Doctor" },
  { value: "clinic", label: "Clinic" },
  { value: "internal_team", label: "Internal Team" },
];

export const REVIEW_PURPOSE_OPTIONS: AuditOption[] = [
  { value: "qa", label: "QA" },
  { value: "training", label: "Training" },
  { value: "marketing", label: "Marketing" },
  { value: "certification", label: "Certification" },
  { value: "outcome_review", label: "Outcome Review" },
  { value: "dispute_review", label: "Dispute Review" },
];

export const COUNTRY_JURISDICTION_OPTIONS: AuditOption[] = [
  { value: "turkey", label: "Turkey" },
  { value: "spain", label: "Spain" },
  { value: "india", label: "India" },
  { value: "thailand", label: "Thailand" },
  { value: "mexico", label: "Mexico" },
  { value: "brazil", label: "Brazil" },
  { value: "argentina", label: "Argentina" },
  { value: "colombia", label: "Colombia" },
  { value: "australia", label: "Australia" },
  { value: "uk", label: "United Kingdom" },
  { value: "usa", label: "United States" },
  { value: "canada", label: "Canada" },
  { value: "uae", label: "UAE" },
  { value: "belgium", label: "Belgium" },
  { value: "germany", label: "Germany" },
  { value: "poland", label: "Poland" },
  { value: "greece", label: "Greece" },
  { value: "other", label: "Other" },
];

export const BOOLEAN_YES_NO_OPTIONS: AuditOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const ADDITIONAL_OPERATOR_OPTIONS: AuditOption[] = [
  { value: "additional_surgeon", label: "Additional Surgeon" },
  { value: "assistant_surgeon", label: "Assistant Surgeon" },
  { value: "extraction_technician", label: "Extraction Technician" },
  { value: "implantation_technician", label: "Implantation Technician" },
  { value: "anaesthesia_support", label: "Anaesthesia Support" },
  { value: "other", label: "Other" },
];

export const PROCEDURE_TYPE_OPTIONS: AuditOption[] = [
  { value: "fue", label: "FUE" },
  { value: "fut", label: "FUT" },
  { value: "long_hair_fue", label: "Long Hair FUE" },
  { value: "eyebrow", label: "Eyebrow" },
  { value: "beard", label: "Beard" },
  { value: "body_hair", label: "Body Hair" },
  { value: "repair", label: "Repair" },
  { value: "scar_revision", label: "Scar Revision" },
  { value: "mixed", label: "Mixed" },
];

export const AREAS_TREATED_OPTIONS: AuditOption[] = [
  { value: "hairline", label: "Hairline" },
  { value: "temples", label: "Temples" },
  { value: "frontal_tuft", label: "Frontal Tuft" },
  { value: "forelock", label: "Forelock" },
  { value: "midscalp", label: "Midscalp" },
  { value: "crown", label: "Crown" },
  { value: "donor_repair", label: "Donor Repair" },
  { value: "eyebrows", label: "Eyebrows" },
  { value: "beard", label: "Beard" },
  { value: "scar", label: "Scar" },
  { value: "other", label: "Other" },
];

export const PATIENT_AGE_BRACKET_OPTIONS: AuditOption[] = [
  { value: "lt_25", label: "<25" },
  { value: "25_30", label: "25-30" },
  { value: "31_35", label: "31-35" },
  { value: "36_40", label: "36-40" },
  { value: "41_50", label: "41-50" },
  { value: "51_60", label: "51-60" },
  { value: "gt_60", label: "60+" },
];

export const PATIENT_SEX_OPTIONS: AuditOption[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other_prefer_not_to_say", label: "Other / Prefer not to say" },
];

export const ETHNICITY_HAIR_BACKGROUND_OPTIONS: AuditOption[] = [
  { value: "caucasian", label: "Caucasian" },
  { value: "south_asian", label: "South Asian" },
  { value: "east_asian", label: "East Asian" },
  { value: "african_afro_textured", label: "African / Afro-textured" },
  { value: "middle_eastern", label: "Middle Eastern" },
  { value: "latino", label: "Latino" },
  { value: "mixed", label: "Mixed" },
  { value: "other", label: "Other" },
];

export const HAIR_TYPE_CURL_PATTERN_OPTIONS: AuditOption[] = [
  { value: "straight", label: "Straight" },
  { value: "wavy", label: "Wavy" },
  { value: "curly", label: "Curly" },
  { value: "coily", label: "Coily" },
  { value: "afro_textured", label: "Afro-textured" },
];

export const HAIR_CALIBRE_CATEGORY_OPTIONS: AuditOption[] = [
  { value: "fine", label: "Fine" },
  { value: "medium", label: "Medium" },
  { value: "coarse", label: "Coarse" },
  { value: "mixed", label: "Mixed" },
];

export const HAIR_COLOUR_OPTIONS: AuditOption[] = [
  { value: "black", label: "Black" },
  { value: "brown", label: "Brown" },
  { value: "blonde", label: "Blonde" },
  { value: "grey", label: "Grey" },
  { value: "red", label: "Red" },
  { value: "mixed", label: "Mixed" },
];

export const SKIN_HAIR_CONTRAST_OPTIONS: AuditOption[] = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
];

export const PRIMARY_DIAGNOSIS_OPTIONS: AuditOption[] = [
  { value: "aga", label: "AGA" },
  { value: "female_pattern_hair_loss", label: "Female Pattern Hair Loss" },
  { value: "traction_alopecia", label: "Traction Alopecia" },
  { value: "scarring_alopecia", label: "Scarring Alopecia" },
  { value: "ccca", label: "CCCA" },
  { value: "post_surgical_scar", label: "Post-surgical Scar" },
  { value: "other", label: "Other" },
];

export const SECONDARY_DIAGNOSIS_OPTIONS: AuditOption[] = [
  { value: "diffuse_thinning", label: "Diffuse thinning" },
  { value: "scalp_inflammation", label: "Scalp inflammation" },
  { value: "hypothyroid_related", label: "Hypothyroid-related" },
  { value: "stress_related", label: "Stress-related" },
  { value: "nutritional", label: "Nutritional" },
  { value: "other", label: "Other" },
];

export const HAIR_LOSS_SCALE_OPTIONS: AuditOption[] = [
  { value: "hamilton_norwood", label: "Hamilton-Norwood" },
  { value: "ludwig", label: "Ludwig" },
  { value: "savin", label: "Savin" },
  { value: "custom", label: "Custom" },
  { value: "not_recorded", label: "Not Recorded" },
];

export const HAIR_LOSS_STABILITY_OPTIONS: AuditOption[] = [
  { value: "stable", label: "Stable" },
  { value: "probably_stable", label: "Probably Stable" },
  { value: "unstable", label: "Unstable" },
  { value: "unknown", label: "Unknown" },
];

export const MINIATURISATION_REGION_OPTIONS: AuditOption[] = [
  { value: "hairline", label: "Hairline" },
  { value: "frontal", label: "Frontal" },
  { value: "midscalp", label: "Midscalp" },
  { value: "crown", label: "Crown" },
  { value: "donor", label: "Donor" },
  { value: "temples", label: "Temples" },
];

export const SCALP_CONDITION_FLAG_OPTIONS: AuditOption[] = [
  { value: "seb_derm", label: "Seb Derm" },
  { value: "psoriasis", label: "Psoriasis" },
  { value: "fibrosis", label: "Fibrosis" },
  { value: "scar_tissue", label: "Scar tissue" },
  { value: "folliculitis", label: "Folliculitis" },
  { value: "inflammation", label: "Inflammation" },
  { value: "other", label: "Other" },
];

export const ZONES_PLANNED_OPTIONS: AuditOption[] = [
  { value: "hairline", label: "Hairline" },
  { value: "temples", label: "Temples" },
  { value: "frontal_tuft", label: "Frontal Tuft" },
  { value: "forelock", label: "Forelock" },
  { value: "midscalp", label: "Midscalp" },
  { value: "crown", label: "Crown" },
  { value: "scar", label: "Scar" },
  { value: "eyebrows", label: "Eyebrows" },
  { value: "beard", label: "Beard" },
];

export const CANDIDATE_SUITABILITY_OPTIONS: AuditOption[] = [
  { value: "good", label: "Good" },
  { value: "borderline", label: "Borderline" },
  { value: "high_risk", label: "High Risk" },
  { value: "poor_candidate", label: "Poor Candidate" },
];

export const DONOR_QUALITY_RATING_OPTIONS: AuditOption[] = [
  { value: "poor", label: "Poor" },
  { value: "fair", label: "Fair" },
  { value: "good", label: "Good" },
  { value: "excellent", label: "Excellent" },
];

export const DONOR_DENSITY_RATING_OPTIONS: AuditOption[] = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
];

export const ESTIMATED_DONOR_CAPACITY_OPTIONS: AuditOption[] = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
];

export const OVERHARVESTING_SIGN_OPTIONS: AuditOption[] = [
  { value: "patchiness", label: "Patchiness" },
  { value: "moth_eaten_appearance", label: "Moth-eaten appearance" },
  { value: "visible_thinning", label: "Visible thinning" },
  { value: "uneven_extraction", label: "Uneven extraction" },
  { value: "other", label: "Other" },
];

/** FUE extraction devices/systems. Legacy values first; new options use normalized value strings. */
export const EXTRACTION_DEVICE_OPTIONS: AuditOption[] = [
  { value: "manual_punch", label: "Manual Punch" },
  { value: "motorised_punch", label: "Motorised Punch" },
  { value: "safe_system", label: "SAFE System" },
  { value: "artas_robotic_system", label: "ARTAS Robotic System" },
  { value: "neograft", label: "Neograft" },
  { value: "smartgraft", label: "SmartGraft" },
  { value: "atera_fue_100", label: "Atera FUE-100" },
  { value: "trivellini_system", label: "Trivellini System" },
  { value: "waw_system", label: "WAW System" },
  { value: "zeus_ugraft_system", label: "Zeus UGraft System" },
  { value: "fue_designer", label: "FUE Designer" },
  { value: "mamba_fue", label: "Mamba FUE" },
  { value: "sapyre", label: "Sapyre" },
  { value: "prodigy_fue", label: "Prodigy FUE" },
  { value: "fue_evolve", label: "FUE Evolve" },
  { value: "manual_motorised_hybrid", label: "Manual / Motorised Hybrid" },
  { value: "other", label: "Other" },
];

/** Punch sizes (mm). Normalized value format 0_70_mm etc. Legacy values preserved. */
export const PUNCH_SIZE_OPTIONS: AuditOption[] = [
  { value: "0_60_mm", label: "0.60 mm" },
  { value: "0_65_mm", label: "0.65 mm" },
  { value: "0_70_mm", label: "0.70 mm" },
  { value: "0_75_mm", label: "0.75 mm" },
  { value: "0_80_mm", label: "0.80 mm" },
  { value: "0_85_mm", label: "0.85 mm" },
  { value: "0_90_mm", label: "0.90 mm" },
  { value: "0_95_mm", label: "0.95 mm" },
  { value: "1_00_mm", label: "1.00 mm" },
  { value: "1_05_mm", label: "1.05 mm" },
  { value: "1_10_mm", label: "1.10 mm" },
  { value: "1_15_mm", label: "1.15 mm" },
  { value: "other", label: "Other" },
];

/** Punch types. Legacy values preserved for validation. */
export const PUNCH_TYPE_OPTIONS: AuditOption[] = [
  { value: "sharp", label: "Sharp" },
  { value: "dull", label: "Dull" },
  { value: "hybrid", label: "Hybrid" },
  { value: "serrated", label: "Serrated" },
  { value: "trumpet", label: "Trumpet" },
  { value: "custom_proprietary", label: "Custom / Proprietary" },
  { value: "flared", label: "Flared" },
  { value: "tapered", label: "Tapered" },
  { value: "other", label: "Other" },
];

/** Punch manufacturers. For grouping/searchable UI. */
export const PUNCH_MANUFACTURER_OPTIONS: AuditOption[] = [
  { value: "waw", label: "WAW" },
  { value: "trivellini", label: "Trivellini" },
  { value: "devroye", label: "Devroye" },
  { value: "cole", label: "Cole" },
  { value: "hans", label: "Hans" },
  { value: "sharp_needle", label: "Sharp Needle" },
  { value: "generic", label: "Generic" },
  { value: "other", label: "Other" },
];

/** Graft holding / storage solutions. Legacy values preserved. */
export const HOLDING_SOLUTION_OPTIONS: AuditOption[] = [
  { value: "saline", label: "Saline" },
  { value: "hypothermosol", label: "Hypothermosol" },
  { value: "atp_enhanced_solution", label: "ATP-enhanced solution" },
  { value: "lactated_ringers", label: "Lactated Ringer's" },
  { value: "prp", label: "PRP" },
  { value: "chilled_saline", label: "Chilled saline" },
  { value: "organ_culture_medium", label: "Organ culture medium" },
  { value: "hypothermosol_plus", label: "Hypothermosol Plus" },
  { value: "other", label: "Other" },
];

/** Recipient implantation devices. Legacy values preserved for validation. */
export const IMPLANTATION_DEVICE_OPTIONS: AuditOption[] = [
  { value: "choi_pen", label: "Choi Pen" },
  { value: "lion_implanter", label: "Lion Implanter" },
  { value: "keep_implanter", label: "KEEP Implanter" },
  { value: "sava_implanter", label: "SAVA Implanter" },
  { value: "forceps", label: "Forceps" },
  { value: "stick_and_place", label: "Stick and Place" },
  { value: "needle_and_forceps", label: "Needle and Forceps" },
  { value: "sergeant_implanter", label: "Sergeant Implanter" },
  { value: "blunt_needle_forceps", label: "Blunt needle + forceps" },
  { value: "implanter_pen_generic", label: "Implanter pen (generic)" },
  { value: "other", label: "Other" },
];

export const IMPLANTATION_METHOD_OPTIONS: AuditOption[] = [
  { value: "implanter", label: "Implanter" },
  { value: "forceps", label: "Forceps" },
  { value: "stick_and_place", label: "Stick and Place" },
  { value: "needle_and_forceps", label: "Needle and Forceps" },
  { value: "mixed", label: "Mixed" },
  { value: "other", label: "Other" },
];

export const IMPLANTED_BY_OPTIONS: AuditOption[] = [
  { value: "surgeon", label: "Surgeon" },
  { value: "technician", label: "Technician" },
  { value: "mixed_team", label: "Mixed Team" },
];

export const IMPLANT_DEPTH_CONSISTENCY_OPTIONS: AuditOption[] = [
  { value: "poor", label: "Poor" },
  { value: "fair", label: "Fair" },
  { value: "good", label: "Good" },
  { value: "excellent", label: "Excellent" },
];

export const INTRAOP_ADJUNCT_OPTIONS: AuditOption[] = [
  { value: "prp", label: "PRP" },
  { value: "exosomes", label: "Exosomes" },
  { value: "atp", label: "ATP" },
  { value: "hypothermosol", label: "Hypothermosol" },
  { value: "microneedling", label: "Microneedling" },
  { value: "partial_transection_technique", label: "Partial Transection Technique" },
  { value: "chilled_storage_protocol", label: "Chilled Storage Protocol" },
  { value: "other", label: "Other" },
];

export const EXOSOME_TYPE_OPTIONS: AuditOption[] = [
  { value: "human_msc", label: "Human MSC" },
  { value: "plant", label: "Plant" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

export const OUTCOME_AUDIT_STAGE_OPTIONS: AuditOption[] = [
  { value: "immediate_post_op", label: "Immediate Post-op" },
  { value: "early_follow_up", label: "Early Follow-up" },
  { value: "6_month", label: "6 Month" },
  { value: "12_month", label: "12 Month" },
  { value: "18_plus_month", label: "18+ Month" },
];

export const GROWTH_OUTCOME_CATEGORY_OPTIONS: AuditOption[] = [
  { value: "poor", label: "Poor" },
  { value: "fair", label: "Fair" },
  { value: "good", label: "Good" },
  { value: "excellent", label: "Excellent" },
  { value: "too_early_to_assess", label: "Too Early to Assess" },
];

export const DONOR_HEALING_CATEGORY_OPTIONS: AuditOption[] = [
  { value: "poor", label: "Poor" },
  { value: "fair", label: "Fair" },
  { value: "good", label: "Good" },
  { value: "excellent", label: "Excellent" },
];

export const PATIENT_SATISFACTION_CATEGORY_OPTIONS: AuditOption[] = [
  { value: "dissatisfied", label: "Dissatisfied" },
  { value: "mixed", label: "Mixed" },
  { value: "satisfied", label: "Satisfied" },
  { value: "very_satisfied", label: "Very Satisfied" },
  { value: "unknown", label: "Unknown" },
];

export const REVIEW_CONCERN_CATEGORY_OPTIONS: AuditOption[] = [
  { value: "low_yield", label: "Low Yield" },
  { value: "overharvesting", label: "Overharvesting" },
  { value: "poor_hairline_design", label: "Poor Hairline Design" },
  { value: "poor_angle_direction", label: "Poor Angle/Direction" },
  { value: "poor_density", label: "Poor Density" },
  { value: "donor_trauma", label: "Donor Trauma" },
  { value: "incomplete_records", label: "Incomplete Records" },
  { value: "other", label: "Other" },
];

export const CASE_COMPLEXITY_RATING_OPTIONS: AuditOption[] = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "extreme", label: "Extreme" },
];

export const AUDITOR_CONFIDENCE_LEVEL_OPTIONS: AuditOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const GRAFT_TRAY_QUALITY_RATING_OPTIONS: AuditOption[] = [
  { value: "poor", label: "Poor" },
  { value: "fair", label: "Fair" },
  { value: "good", label: "Good" },
  { value: "excellent", label: "Excellent" },
];

export const GRAFT_SORTING_METHOD_OPTIONS: AuditOption[] = [
  { value: "singles", label: "Singles" },
  { value: "doubles", label: "Doubles" },
  { value: "triples", label: "Triples" },
  { value: "by_calibre", label: "By calibre" },
  { value: "by_zone", label: "By zone" },
  { value: "not_sorted", label: "Not sorted" },
  { value: "other", label: "Other" },
];

export const VISIBLE_TRANSECTION_ON_TRAY_OPTIONS: AuditOption[] = [
  { value: "none", label: "None" },
  { value: "minimal", label: "Minimal" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "significant", label: "Significant" },
  { value: "unknown", label: "Unknown" },
];

export const GRAFT_TISSUE_QUALITY_CONCERN_OPTIONS: AuditOption[] = [
  { value: "excess_tissue", label: "Excess tissue" },
  { value: "overskeletonised", label: "Overskeletonised" },
  { value: "crushed_grafts", label: "Crushed grafts" },
  { value: "dehydration_concern", label: "Dehydration concern" },
  { value: "blood_heavy_tray", label: "Blood-heavy tray" },
  { value: "inconsistent_graft_quality", label: "Inconsistent graft quality" },
  { value: "none_observed", label: "None observed" },
];

/** Standard post-op protocol items. Legacy values preserved for scoring. */
export const POSTOP_TREATMENT_OPTIONS: AuditOption[] = [
  { value: "prp", label: "PRP" },
  { value: "exosomes", label: "Exosomes" },
  { value: "microneedling", label: "Microneedling" },
  { value: "led_light_therapy", label: "LED Light Therapy" },
  { value: "lllt_laser_cap", label: "LLLT / Laser Cap" },
  { value: "minoxidil_topical", label: "Minoxidil Topical" },
  { value: "minoxidil_oral", label: "Minoxidil Oral" },
  { value: "finasteride_oral", label: "Finasteride Oral" },
  { value: "dutasteride_oral", label: "Dutasteride Oral" },
  { value: "saw_palmetto", label: "Saw Palmetto" },
  { value: "ketoconazole_shampoo", label: "Ketoconazole Shampoo" },
  { value: "nutraceutical_support", label: "Nutraceutical Support" },
  { value: "antibiotics", label: "Antibiotics" },
  { value: "analgesics", label: "Analgesics" },
  { value: "steroids_anti_swelling_medication", label: "Steroids / Anti-swelling Medication" },
  { value: "donor_recovery_protocol", label: "Donor Recovery Protocol" },
  { value: "topical_steroid", label: "Topical steroid" },
  { value: "follicle_support_supplements", label: "Follicle support supplements" },
  { value: "other", label: "Other" },
];

export const OUT_OF_BODY_TIME_CATEGORY_OPTIONS: AuditOption[] = [
  { value: "lt_1h", label: "< 1 hour" },
  { value: "1_2h", label: "1-2 hours" },
  { value: "2_4h", label: "2-4 hours" },
  { value: "gt_4h", label: "> 4 hours" },
  { value: "mixed_unknown", label: "Mixed / Unknown" },
  { value: "mixed", label: "Mixed (legacy)" },
];

/** Punch motion (FUE). Legacy values preserved. */
export const PUNCH_MOTION_OPTIONS: AuditOption[] = [
  { value: "rotation", label: "Rotation" },
  { value: "oscillation", label: "Oscillation" },
  { value: "hybrid", label: "Hybrid" },
  { value: "reciprocating", label: "Reciprocating" },
  { value: "unknown", label: "Unknown" },
];

export const EXTRACTION_METHOD_OPTIONS: AuditOption[] = [
  { value: "manual", label: "Manual" },
  { value: "motorised", label: "Motorised" },
  { value: "robotic", label: "Robotic" },
  { value: "mixed", label: "Mixed" },
];

export const EXTRACTION_TECHNIQUE_OPTIONS: AuditOption[] = [
  { value: "standard_fue", label: "Standard FUE" },
  { value: "long_hair_fue", label: "Long Hair FUE" },
  { value: "unshaven_fue", label: "Unshaven FUE" },
  { value: "partial_shave_fue", label: "Partial Shave FUE" },
  { value: "zone_shave_fue", label: "Zone Shave FUE" },
  { value: "hybrid_fue_fut", label: "Hybrid FUE/FUT" },
  { value: "other", label: "Other" },
];

export const EXTRACTION_OPERATOR_OPTIONS: AuditOption[] = [
  { value: "surgeon", label: "Surgeon" },
  { value: "technician", label: "Technician" },
  { value: "mixed_team", label: "Mixed Team" },
  { value: "robotic", label: "Robotic" },
];

export const TRANSECTION_CATEGORY_OPTIONS: AuditOption[] = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "unknown", label: "Unknown" },
];

export const RECIPIENT_SITES_CREATED_BY_OPTIONS: AuditOption[] = [
  { value: "surgeon", label: "Surgeon" },
  { value: "technician", label: "Technician" },
  { value: "mixed_team", label: "Mixed Team" },
];

/** Recipient site creation tools/methods. Legacy values preserved. */
export const SITE_CREATION_METHOD_OPTIONS: AuditOption[] = [
  { value: "blade", label: "Blade" },
  { value: "needle", label: "Needle" },
  { value: "implanter_led", label: "Implanter-led" },
  { value: "stick_and_place", label: "Stick and Place" },
  { value: "sapphire_blade", label: "Sapphire blade" },
  { value: "steel_blade", label: "Steel blade" },
  { value: "premade_slits", label: "Pre-made slits" },
  { value: "other", label: "Other" },
];

export const SLIT_ORIENTATION_OPTIONS: AuditOption[] = [
  { value: "coronal", label: "Coronal" },
  { value: "sagittal", label: "Sagittal" },
  { value: "mixed", label: "Mixed" },
  { value: "unknown", label: "Unknown" },
];

/** Recipient site instrument sizes (mm). For grouping/searchable UI. */
export const SITE_INSTRUMENT_SIZE_OPTIONS: AuditOption[] = [
  { value: "0_5_mm", label: "0.5 mm" },
  { value: "0_6_mm", label: "0.6 mm" },
  { value: "0_7_mm", label: "0.7 mm" },
  { value: "0_8_mm", label: "0.8 mm" },
  { value: "0_9_mm", label: "0.9 mm" },
  { value: "1_0_mm", label: "1.0 mm" },
  { value: "1_2_mm", label: "1.2 mm" },
  { value: "other", label: "Other" },
];

export const HAIRLINE_DIRECTION_QUALITY_OPTIONS: AuditOption[] = [
  { value: "poor", label: "Poor" },
  { value: "fair", label: "Fair" },
  { value: "good", label: "Good" },
  { value: "excellent", label: "Excellent" },
];

export const TEMPERATURE_CONTROLLED_STORAGE_OPTIONS: AuditOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

// ---------------------------------------------------------------------------
// New registries for clinic/doctor forms (additive). Not yet used in validation.
// ---------------------------------------------------------------------------

/** Microscopes / magnification / imaging. For graft inspection and dissection. */
export const MICROSCOPE_MAGNIFICATION_OPTIONS: AuditOption[] = [
  { value: "stereo_basic", label: "Basic stereo microscope" },
  { value: "stereo_high_end", label: "High-end stereo microscope" },
  { value: "digital_microscope", label: "Digital microscope" },
  { value: "trichoscope", label: "Trichoscope" },
  { value: "loupe_magnification", label: "Loupe magnification" },
  { value: "none", label: "None" },
  { value: "other", label: "Other" },
];

/** Sterilization / infection-control workflows. */
export const STERILIZATION_PROTOCOL_OPTIONS: AuditOption[] = [
  { value: "autoclave", label: "Autoclave" },
  { value: "single_use_disposables", label: "Single-use disposables" },
  { value: "chemical", label: "Chemical sterilization" },
  { value: "mixed", label: "Mixed (autoclave + disposables)" },
  { value: "other", label: "Other" },
];

/** Emergency / facility equipment. */
export const EMERGENCY_FACILITY_EQUIPMENT_OPTIONS: AuditOption[] = [
  { value: "defibrillator", label: "Defibrillator" },
  { value: "oxygen", label: "Oxygen supply" },
  { value: "emergency_meds", label: "Emergency medications" },
  { value: "backup_power", label: "Backup power supply" },
  { value: "crash_cart", label: "Crash cart" },
  { value: "airway_management", label: "Airway management kit" },
  { value: "other", label: "Other" },
];

/**
 * Grouped option keys for future searchable/grouped UI.
 * Maps logical group id to option constant name (so consumers can filter by group).
 * Does not change validation or payload shape.
 */
export const OPTION_GROUPS: Record<
  string,
  { label: string; optionKeys: string[] }
> = {
  fue_extraction_devices: {
    label: "FUE extraction devices/systems",
    optionKeys: ["EXTRACTION_DEVICE_OPTIONS"],
  },
  fut_tools: {
    label: "FUT tools / closure / dissection",
    optionKeys: ["SITE_CREATION_METHOD_OPTIONS", "PUNCH_TYPE_OPTIONS"],
  },
  punch_sizes: { label: "Punch sizes", optionKeys: ["PUNCH_SIZE_OPTIONS"] },
  punch_types: { label: "Punch types", optionKeys: ["PUNCH_TYPE_OPTIONS"] },
  punch_motion: { label: "Punch motion", optionKeys: ["PUNCH_MOTION_OPTIONS"] },
  microscopes: {
    label: "Microscopes / magnification / imaging",
    optionKeys: ["MICROSCOPE_MAGNIFICATION_OPTIONS"],
  },
  holding_storage: {
    label: "Holding solutions / graft storage",
    optionKeys: ["HOLDING_SOLUTION_OPTIONS", "TEMPERATURE_CONTROLLED_STORAGE_OPTIONS"],
  },
  graft_handling: {
    label: "Graft handling / sorting / inspection",
    optionKeys: ["GRAFT_SORTING_METHOD_OPTIONS", "GRAFT_TISSUE_QUALITY_CONCERN_OPTIONS", "VISIBLE_TRANSECTION_ON_TRAY_OPTIONS"],
  },
  recipient_site_tools: {
    label: "Recipient site creation tools",
    optionKeys: ["SITE_CREATION_METHOD_OPTIONS", "SITE_INSTRUMENT_SIZE_OPTIONS", "SLIT_ORIENTATION_OPTIONS"],
  },
  implantation: {
    label: "Implantation devices / methods",
    optionKeys: ["IMPLANTATION_DEVICE_OPTIONS", "IMPLANTATION_METHOD_OPTIONS", "IMPLANTED_BY_OPTIONS"],
  },
  sterilization: {
    label: "Sterilization / infection control",
    optionKeys: ["STERILIZATION_PROTOCOL_OPTIONS"],
  },
  emergency_facility: {
    label: "Emergency / facility equipment",
    optionKeys: ["EMERGENCY_FACILITY_EQUIPMENT_OPTIONS"],
  },
  postop_protocol: {
    label: "Standard post-op protocol",
    optionKeys: ["POSTOP_TREATMENT_OPTIONS"],
  },
};

export const BASIC_REQUIRED_SURGICAL_METADATA_KEYS = [
  "extraction_method",
  "extraction_devices_used",
  "extraction_technique",
  "extraction_operator",
  "punch_sizes_used",
  "punch_types_used",
  "holding_solutions_used",
  "grafts_kept_hydrated",
  "implantation_method",
  "implanted_by",
  "recipient_sites_created_by",
  "site_creation_method",
  "implantation_devices_used",
  "postoperative_treatments_included",
  "postoperative_treatments_recommended",
  "follow_up_plan_documented",
] as const;

export const BASIC_OPTIONAL_SURGICAL_METADATA_KEYS = [
  "intraoperative_adjuncts_used",
  "outcome_audit_stage",
  "growth_outcome_category",
  "donor_healing_category",
] as const;

export const BASIC_REQUIRED_CASE_CONTEXT_KEYS = [
  "submission_type",
  "audit_type",
  "case_id",
  "clinic_name",
  "doctor_name",
  "country_jurisdiction",
  "surgery_date",
  "multi_day_flag",
  "requested_by",
  "review_purpose",
  "previous_surgery_history",
  "repair_case_flag",
] as const;

export const BASIC_REQUIRED_PROCEDURE_AREA_KEYS = [
  "procedure_type",
  "primary_procedure_type",
  "areas_treated",
] as const;

export const ADVANCED_PROCEDURE_AREA_KEYS = [
  "primary_area_treated",
  "hairline_lowering_flag",
  "crown_included_flag",
  "beard_donor_used",
  "body_donor_used",
] as const;

export const BASIC_REQUIRED_PATIENT_BASELINE_KEYS = [
  "patient_age_bracket",
  "patient_sex",
  "hair_type_curl_pattern",
  "hair_calibre_category",
] as const;

export const ADVANCED_PATIENT_BASELINE_KEYS = [
  "ethnicity_hair_background",
  "hair_shaft_diameter_microns",
  "hair_colour",
  "skin_hair_contrast",
] as const;

export const BASIC_REQUIRED_DIAGNOSIS_PATTERN_KEYS = [
  "primary_diagnosis",
  "hair_loss_scale_used",
  "hair_loss_grade",
  "hair_loss_stability",
  "miniaturisation_present",
] as const;

export const ADVANCED_DIAGNOSIS_PATTERN_KEYS = [
  "secondary_diagnosis",
  "miniaturisation_regions",
  "dupa_retrograde_flag",
  "scalp_condition_flags",
] as const;

export const BASIC_REQUIRED_PREOP_PLANNING_KEYS = [
  "planned_graft_count",
  "actual_graft_count",
  "zones_planned",
] as const;

export const ADVANCED_PREOP_PLANNING_KEYS = [
  "estimated_hair_count",
  "density_goal_by_zone",
  "hairline_design_strategy",
  "future_loss_planning",
  "risk_counselling_documented",
  "candidate_suitability_rating",
] as const;

export const BASIC_REQUIRED_DONOR_ASSESSMENT_KEYS = [
  "donor_quality_rating",
  "donor_density_rating",
  "safe_donor_zone_assessed",
] as const;

export const ADVANCED_DONOR_ASSESSMENT_KEYS = [
  "estimated_donor_capacity",
  "estimated_donor_capacity_numeric",
  "donor_scarring_present",
  "donor_density_per_cm2",
  "avg_hairs_per_graft",
  "overharvesting_risk_flag",
  "overharvesting_signs",
  "donor_mapping_notes",
] as const;

export const ADVANCED_CASE_CONTEXT_KEYS = [
  "clinic_branch",
  "additional_operators",
  "additional_operators_details",
  "procedure_day_breakdown",
  "previous_surgery_details",
] as const;

export const ADVANCED_SURGICAL_METADATA_KEYS = [
  "primary_extraction_device",
  "extraction_experience_years",
  "primary_punch_size",
  "primary_punch_type",
  "punch_manufacturers_used",
  "primary_holding_solution",
  "primary_implantation_device",
  "intraop_prp_used",
  "intraop_exosomes_used",
  "exosome_type",
  "partial_transection_used",
  "intraop_adjunct_notes",
  "finasteride_recommended",
  "minoxidil_recommended",
  "donor_recovery_protocol_included",
  "patient_satisfaction_category",
  "corrective_surgery_likely",
  "outcome_notes",
  "review_concern_categories",
  "claimed_evidenced_discrepancy",
  "incomplete_records_flag",
  "case_complexity_rating",
  "auditor_confidence_level",
  "forensic_notes",
  "graft_tray_quality_rating",
  "graft_sorting_method",
  "visible_transection_on_tray",
  "graft_tissue_quality_concern",
  "microscopic_graft_review_available",
  "extraction_device_change_notes",
  "punch_size_change_notes",
  "punch_type_change_notes",
  "holding_solution_notes",
  "graft_handling_team_notes",
  "microscopic_inspection_used",
  "graft_composition_available",
  "slit_orientation",
  "site_instrument_sizes_used",
  "hairline_direction_quality",
  "angle_direction_notes",
  "native_hair_protection_strategy",
  "implantation_time_minutes",
  "singles_reserved_for_hairline",
  "popping_issues_observed",
  "implant_depth_consistency",
  "implantation_device_notes",
  "postoperative_protocol_notes",
  "reason_for_intraoperative_changes",
  "motor_speed_rpm",
  "punch_motion",
  "transection_category",
  "transection_rate_percent",
  "buried_graft_rate_percent",
  "extraction_time_minutes",
  "out_of_body_time_category",
  "temperature_controlled_storage",
  "surgeon_vs_technician_split_notes",
] as const;

export const DOCTOR_BASIC_FIELD_KEYS = [
  ...BASIC_REQUIRED_SURGICAL_METADATA_KEYS,
  ...BASIC_OPTIONAL_SURGICAL_METADATA_KEYS,
] as const;
export const DOCTOR_ADVANCED_FIELD_KEYS = [...ADVANCED_SURGICAL_METADATA_KEYS] as const;
export const CLINIC_BASIC_FIELD_KEYS = [
  ...BASIC_REQUIRED_SURGICAL_METADATA_KEYS,
  ...BASIC_OPTIONAL_SURGICAL_METADATA_KEYS,
] as const;
export const CLINIC_ADVANCED_FIELD_KEYS = [...ADVANCED_SURGICAL_METADATA_KEYS] as const;

export const DOCTOR_BASIC_CONTEXT_FIELD_KEYS = [...BASIC_REQUIRED_CASE_CONTEXT_KEYS] as const;
export const DOCTOR_ADVANCED_CONTEXT_FIELD_KEYS = [...ADVANCED_CASE_CONTEXT_KEYS] as const;
export const CLINIC_BASIC_CONTEXT_FIELD_KEYS = [...BASIC_REQUIRED_CASE_CONTEXT_KEYS] as const;
export const CLINIC_ADVANCED_CONTEXT_FIELD_KEYS = [...ADVANCED_CASE_CONTEXT_KEYS] as const;

export const DOCTOR_BASIC_PROCEDURE_AREA_FIELD_KEYS = [...BASIC_REQUIRED_PROCEDURE_AREA_KEYS] as const;
export const DOCTOR_ADVANCED_PROCEDURE_AREA_FIELD_KEYS = [...ADVANCED_PROCEDURE_AREA_KEYS] as const;
export const CLINIC_BASIC_PROCEDURE_AREA_FIELD_KEYS = [...BASIC_REQUIRED_PROCEDURE_AREA_KEYS] as const;
export const CLINIC_ADVANCED_PROCEDURE_AREA_FIELD_KEYS = [...ADVANCED_PROCEDURE_AREA_KEYS] as const;

export const DOCTOR_BASIC_PATIENT_BASELINE_FIELD_KEYS = [...BASIC_REQUIRED_PATIENT_BASELINE_KEYS] as const;
export const DOCTOR_ADVANCED_PATIENT_BASELINE_FIELD_KEYS = [...ADVANCED_PATIENT_BASELINE_KEYS] as const;
export const CLINIC_BASIC_PATIENT_BASELINE_FIELD_KEYS = [...BASIC_REQUIRED_PATIENT_BASELINE_KEYS] as const;
export const CLINIC_ADVANCED_PATIENT_BASELINE_FIELD_KEYS = [...ADVANCED_PATIENT_BASELINE_KEYS] as const;

export const DOCTOR_BASIC_DIAGNOSIS_PATTERN_FIELD_KEYS = [...BASIC_REQUIRED_DIAGNOSIS_PATTERN_KEYS] as const;
export const DOCTOR_ADVANCED_DIAGNOSIS_PATTERN_FIELD_KEYS = [...ADVANCED_DIAGNOSIS_PATTERN_KEYS] as const;
export const CLINIC_BASIC_DIAGNOSIS_PATTERN_FIELD_KEYS = [...BASIC_REQUIRED_DIAGNOSIS_PATTERN_KEYS] as const;
export const CLINIC_ADVANCED_DIAGNOSIS_PATTERN_FIELD_KEYS = [...ADVANCED_DIAGNOSIS_PATTERN_KEYS] as const;

export const DOCTOR_BASIC_PREOP_PLANNING_FIELD_KEYS = [...BASIC_REQUIRED_PREOP_PLANNING_KEYS] as const;
export const DOCTOR_ADVANCED_PREOP_PLANNING_FIELD_KEYS = [...ADVANCED_PREOP_PLANNING_KEYS] as const;
export const CLINIC_BASIC_PREOP_PLANNING_FIELD_KEYS = [...BASIC_REQUIRED_PREOP_PLANNING_KEYS] as const;
export const CLINIC_ADVANCED_PREOP_PLANNING_FIELD_KEYS = [...ADVANCED_PREOP_PLANNING_KEYS] as const;

export const DOCTOR_BASIC_DONOR_ASSESSMENT_FIELD_KEYS = [...BASIC_REQUIRED_DONOR_ASSESSMENT_KEYS] as const;
export const DOCTOR_ADVANCED_DONOR_ASSESSMENT_FIELD_KEYS = [...ADVANCED_DONOR_ASSESSMENT_KEYS] as const;
export const CLINIC_BASIC_DONOR_ASSESSMENT_FIELD_KEYS = [...BASIC_REQUIRED_DONOR_ASSESSMENT_KEYS] as const;
export const CLINIC_ADVANCED_DONOR_ASSESSMENT_FIELD_KEYS = [...ADVANCED_DONOR_ASSESSMENT_KEYS] as const;
