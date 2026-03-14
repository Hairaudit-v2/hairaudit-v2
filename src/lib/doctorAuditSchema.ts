// Doctor Audit Form schema — validation + backward compat mapping
// Target: 6–8 min completion, conditional FUE/FUT sections

import { z } from "zod";
import {
  SUBMISSION_TYPE_OPTIONS,
  AUDIT_DEPTH_TYPE_OPTIONS,
  REQUESTED_BY_OPTIONS,
  REVIEW_PURPOSE_OPTIONS,
  COUNTRY_JURISDICTION_OPTIONS,
  BOOLEAN_YES_NO_OPTIONS,
  ADDITIONAL_OPERATOR_OPTIONS,
  PROCEDURE_TYPE_OPTIONS,
  AREAS_TREATED_OPTIONS,
  PATIENT_AGE_BRACKET_OPTIONS,
  PATIENT_SEX_OPTIONS,
  ETHNICITY_HAIR_BACKGROUND_OPTIONS,
  HAIR_TYPE_CURL_PATTERN_OPTIONS,
  HAIR_CALIBRE_CATEGORY_OPTIONS,
  HAIR_COLOUR_OPTIONS,
  SKIN_HAIR_CONTRAST_OPTIONS,
  PRIMARY_DIAGNOSIS_OPTIONS,
  SECONDARY_DIAGNOSIS_OPTIONS,
  HAIR_LOSS_SCALE_OPTIONS,
  HAIR_LOSS_STABILITY_OPTIONS,
  MINIATURISATION_REGION_OPTIONS,
  SCALP_CONDITION_FLAG_OPTIONS,
  ZONES_PLANNED_OPTIONS,
  CANDIDATE_SUITABILITY_OPTIONS,
  DONOR_QUALITY_RATING_OPTIONS,
  DONOR_DENSITY_RATING_OPTIONS,
  ESTIMATED_DONOR_CAPACITY_OPTIONS,
  OVERHARVESTING_SIGN_OPTIONS,
  EXTRACTION_DEVICE_OPTIONS,
  PUNCH_SIZE_OPTIONS,
  PUNCH_TYPE_OPTIONS,
  PUNCH_MANUFACTURER_OPTIONS,
  HOLDING_SOLUTION_OPTIONS,
  IMPLANTATION_DEVICE_OPTIONS,
  IMPLANTATION_METHOD_OPTIONS,
  IMPLANTED_BY_OPTIONS,
  IMPLANT_DEPTH_CONSISTENCY_OPTIONS,
  INTRAOP_ADJUNCT_OPTIONS,
  EXOSOME_TYPE_OPTIONS,
  POSTOP_TREATMENT_OPTIONS,
  OUTCOME_AUDIT_STAGE_OPTIONS,
  GROWTH_OUTCOME_CATEGORY_OPTIONS,
  DONOR_HEALING_CATEGORY_OPTIONS,
  PATIENT_SATISFACTION_CATEGORY_OPTIONS,
  REVIEW_CONCERN_CATEGORY_OPTIONS,
  CASE_COMPLEXITY_RATING_OPTIONS,
  AUDITOR_CONFIDENCE_LEVEL_OPTIONS,
  GRAFT_TRAY_QUALITY_RATING_OPTIONS,
  GRAFT_SORTING_METHOD_OPTIONS,
  VISIBLE_TRANSECTION_ON_TRAY_OPTIONS,
  GRAFT_TISSUE_QUALITY_CONCERN_OPTIONS,
  EXTRACTION_METHOD_OPTIONS,
  EXTRACTION_TECHNIQUE_OPTIONS,
  EXTRACTION_OPERATOR_OPTIONS,
  TRANSECTION_CATEGORY_OPTIONS,
  RECIPIENT_SITES_CREATED_BY_OPTIONS,
  SITE_CREATION_METHOD_OPTIONS,
  SLIT_ORIENTATION_OPTIONS,
  SITE_INSTRUMENT_SIZE_OPTIONS,
  HAIRLINE_DIRECTION_QUALITY_OPTIONS,
  OUT_OF_BODY_TIME_CATEGORY_OPTIONS,
  PUNCH_MOTION_OPTIONS,
  TEMPERATURE_CONTROLLED_STORAGE_OPTIONS,
} from "./audit/masterSurgicalMetadata";
import { FIELD_PROVENANCE_VALUES } from "./audit/fieldProvenance";

// Procedure types for conditional logic
export const PROCEDURE_TYPE_FUE = ["fue_manual", "fue_motorized", "fue_robotic", "combined"] as const;
export const PROCEDURE_TYPE_FUT = ["fut", "combined"] as const;

const extractionDeviceValues = EXTRACTION_DEVICE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const submissionTypeValues = SUBMISSION_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const auditDepthTypeValues = AUDIT_DEPTH_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const requestedByValues = REQUESTED_BY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const reviewPurposeValues = REVIEW_PURPOSE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const countryJurisdictionValues = COUNTRY_JURISDICTION_OPTIONS.map((o) => o.value) as [string, ...string[]];
const yesNoValues = BOOLEAN_YES_NO_OPTIONS.map((o) => o.value) as [string, ...string[]];
const additionalOperatorValues = ADDITIONAL_OPERATOR_OPTIONS.map((o) => o.value) as [string, ...string[]];
const procedureTypeValues = PROCEDURE_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const areasTreatedValues = AREAS_TREATED_OPTIONS.map((o) => o.value) as [string, ...string[]];
const patientAgeBracketValues = PATIENT_AGE_BRACKET_OPTIONS.map((o) => o.value) as [string, ...string[]];
const patientSexValues = PATIENT_SEX_OPTIONS.map((o) => o.value) as [string, ...string[]];
const ethnicityHairBackgroundValues = ETHNICITY_HAIR_BACKGROUND_OPTIONS.map((o) => o.value) as [string, ...string[]];
const hairTypeCurlPatternValues = HAIR_TYPE_CURL_PATTERN_OPTIONS.map((o) => o.value) as [string, ...string[]];
const hairCalibreCategoryValues = HAIR_CALIBRE_CATEGORY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const hairColourValues = HAIR_COLOUR_OPTIONS.map((o) => o.value) as [string, ...string[]];
const skinHairContrastValues = SKIN_HAIR_CONTRAST_OPTIONS.map((o) => o.value) as [string, ...string[]];
const primaryDiagnosisValues = PRIMARY_DIAGNOSIS_OPTIONS.map((o) => o.value) as [string, ...string[]];
const secondaryDiagnosisValues = SECONDARY_DIAGNOSIS_OPTIONS.map((o) => o.value) as [string, ...string[]];
const hairLossScaleValues = HAIR_LOSS_SCALE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const hairLossStabilityValues = HAIR_LOSS_STABILITY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const miniaturisationRegionValues = MINIATURISATION_REGION_OPTIONS.map((o) => o.value) as [string, ...string[]];
const scalpConditionFlagValues = SCALP_CONDITION_FLAG_OPTIONS.map((o) => o.value) as [string, ...string[]];
const zonesPlannedValues = ZONES_PLANNED_OPTIONS.map((o) => o.value) as [string, ...string[]];
const candidateSuitabilityValues = CANDIDATE_SUITABILITY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const donorQualityRatingValues = DONOR_QUALITY_RATING_OPTIONS.map((o) => o.value) as [string, ...string[]];
const donorDensityRatingValues = DONOR_DENSITY_RATING_OPTIONS.map((o) => o.value) as [string, ...string[]];
const estimatedDonorCapacityValues = ESTIMATED_DONOR_CAPACITY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const overharvestingSignValues = OVERHARVESTING_SIGN_OPTIONS.map((o) => o.value) as [string, ...string[]];
const punchSizeValues = PUNCH_SIZE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const punchTypeValues = PUNCH_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const punchManufacturerValues = PUNCH_MANUFACTURER_OPTIONS.map((o) => o.value) as [string, ...string[]];
const holdingSolutionValues = HOLDING_SOLUTION_OPTIONS.map((o) => o.value) as [string, ...string[]];
const implantationDeviceValues = IMPLANTATION_DEVICE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const implantationMethodValues = IMPLANTATION_METHOD_OPTIONS.map((o) => o.value) as [string, ...string[]];
const implantedByValues = IMPLANTED_BY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const implantDepthConsistencyValues = IMPLANT_DEPTH_CONSISTENCY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const intraopAdjunctValues = INTRAOP_ADJUNCT_OPTIONS.map((o) => o.value) as [string, ...string[]];
const exosomeTypeValues = EXOSOME_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const postopTreatmentValues = POSTOP_TREATMENT_OPTIONS.map((o) => o.value) as [string, ...string[]];
const outcomeAuditStageValues = OUTCOME_AUDIT_STAGE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const growthOutcomeCategoryValues = GROWTH_OUTCOME_CATEGORY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const donorHealingCategoryValues = DONOR_HEALING_CATEGORY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const patientSatisfactionCategoryValues = PATIENT_SATISFACTION_CATEGORY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const reviewConcernCategoryValues = REVIEW_CONCERN_CATEGORY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const caseComplexityRatingValues = CASE_COMPLEXITY_RATING_OPTIONS.map((o) => o.value) as [string, ...string[]];
const auditorConfidenceLevelValues = AUDITOR_CONFIDENCE_LEVEL_OPTIONS.map((o) => o.value) as [string, ...string[]];
const graftTrayQualityRatingValues = GRAFT_TRAY_QUALITY_RATING_OPTIONS.map((o) => o.value) as [string, ...string[]];
const graftSortingMethodValues = GRAFT_SORTING_METHOD_OPTIONS.map((o) => o.value) as [string, ...string[]];
const visibleTransectionOnTrayValues = VISIBLE_TRANSECTION_ON_TRAY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const graftTissueQualityConcernValues = GRAFT_TISSUE_QUALITY_CONCERN_OPTIONS.map((o) => o.value) as [string, ...string[]];
const extractionMethodValues = EXTRACTION_METHOD_OPTIONS.map((o) => o.value) as [string, ...string[]];
const extractionTechniqueValues = EXTRACTION_TECHNIQUE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const extractionOperatorValues = EXTRACTION_OPERATOR_OPTIONS.map((o) => o.value) as [string, ...string[]];
const transectionCategoryValues = TRANSECTION_CATEGORY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const recipientSitesCreatedByValues = RECIPIENT_SITES_CREATED_BY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const siteCreationMethodValues = SITE_CREATION_METHOD_OPTIONS.map((o) => o.value) as [string, ...string[]];
const slitOrientationValues = SLIT_ORIENTATION_OPTIONS.map((o) => o.value) as [string, ...string[]];
const siteInstrumentSizeValues = SITE_INSTRUMENT_SIZE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const hairlineDirectionQualityValues = HAIRLINE_DIRECTION_QUALITY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const outOfBodyTimeCategoryValues = OUT_OF_BODY_TIME_CATEGORY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const punchMotionValues = PUNCH_MOTION_OPTIONS.map((o) => o.value) as [string, ...string[]];
const temperatureStorageValues = TEMPERATURE_CONTROLLED_STORAGE_OPTIONS.map((o) => o.value) as [string, ...string[]];

export const doctorAuditSchema = z
  .object({
    // Section 1: Doctor & Clinic Profile
    doctorName: z.string().min(1, "Required"),
    clinicName: z.string().min(1, "Required"),
    clinicLocation: z.string().min(1, "Required"),
    medicalDegree: z.string().min(1, "Required"),
    yearsPerformingHairTransplants: z.coerce.number().min(0).max(60),
    percentPracticeHairTransplant: z.enum(["lt25", "25_50", "50_75", "75_100"]),
    memberships: z.array(z.string()).optional(),
    otherMembershipText: z.string().optional(),

    // Section 2: Case Identity & Submission Context
    submission_type: z.enum(submissionTypeValues),
    audit_type: z.enum(auditDepthTypeValues),
    case_id: z.string().min(1, "Required"),
    clinic_name: z.string().min(1, "Required"),
    clinic_branch: z.string().optional(),
    doctor_name: z.string().min(1, "Required"),
    country_jurisdiction: z.enum(countryJurisdictionValues),
    surgery_date: z.string().min(1, "Required"),
    multi_day_flag: z.enum(yesNoValues),
    requested_by: z.enum(requestedByValues),
    review_purpose: z.array(z.enum(reviewPurposeValues)).min(1, "Select at least one review purpose"),
    previous_surgery_history: z.enum(yesNoValues),
    previous_surgery_details: z.string().optional(),
    repair_case_flag: z.enum(yesNoValues),
    additional_operators: z.array(z.enum(additionalOperatorValues)).optional(),
    additional_operators_details: z.string().optional(),
    procedure_day_breakdown: z.string().optional(),

    // Section 4: Procedure Type & Areas Treated
    procedure_type: z.array(z.enum(procedureTypeValues)).min(1, "Select at least one procedure type"),
    primary_procedure_type: z.enum(procedureTypeValues),
    areas_treated: z.array(z.enum(areasTreatedValues)).min(1, "Select at least one treated area"),
    primary_area_treated: z.enum(areasTreatedValues).optional(),
    hairline_lowering_flag: z.enum(yesNoValues).optional(),
    crown_included_flag: z.enum(yesNoValues).optional(),
    beard_donor_used: z.enum(yesNoValues).optional(),
    body_donor_used: z.enum(yesNoValues).optional(),

    // Section 6: Patient Baseline
    patient_age_bracket: z.enum(patientAgeBracketValues),
    patient_sex: z.enum(patientSexValues),
    ethnicity_hair_background: z.array(z.enum(ethnicityHairBackgroundValues)).optional(),
    hair_type_curl_pattern: z.enum(hairTypeCurlPatternValues),
    hair_calibre_category: z.enum(hairCalibreCategoryValues),
    hair_shaft_diameter_microns: z.coerce.number().min(0).max(300).optional(),
    hair_colour: z.enum(hairColourValues).optional(),
    skin_hair_contrast: z.enum(skinHairContrastValues).optional(),

    // Section 8: Diagnosis & Hair Loss Pattern
    primary_diagnosis: z.enum(primaryDiagnosisValues),
    secondary_diagnosis: z.array(z.enum(secondaryDiagnosisValues)).optional(),
    hair_loss_scale_used: z.enum(hairLossScaleValues),
    hair_loss_grade: z.string().min(1, "Required"),
    hair_loss_stability: z.enum(hairLossStabilityValues),
    miniaturisation_present: z.enum(yesNoValues),
    miniaturisation_regions: z.array(z.enum(miniaturisationRegionValues)).optional(),
    dupa_retrograde_flag: z.enum(yesNoValues).optional(),
    scalp_condition_flags: z.array(z.enum(scalpConditionFlagValues)).optional(),

    // Section 10: Pre-Operative Planning
    planned_graft_count: z.coerce.number().int().min(0).max(50000),
    actual_graft_count: z.coerce.number().int().min(0).max(50000),
    estimated_hair_count: z.coerce.number().int().min(0).max(100000).optional(),
    zones_planned: z.array(z.enum(zonesPlannedValues)).min(1, "Select at least one planned zone"),
    density_goal_by_zone: z.string().optional(),
    hairline_design_strategy: z.string().optional(),
    future_loss_planning: z.enum(yesNoValues).optional(),
    risk_counselling_documented: z.enum(yesNoValues).optional(),
    candidate_suitability_rating: z.enum(candidateSuitabilityValues).optional(),

    // Section 12: Donor Assessment
    donor_quality_rating: z.enum(donorQualityRatingValues),
    donor_density_rating: z.enum(donorDensityRatingValues),
    estimated_donor_capacity: z.enum(estimatedDonorCapacityValues).optional(),
    estimated_donor_capacity_numeric: z.coerce.number().int().min(0).max(50000).optional(),
    safe_donor_zone_assessed: z.enum(yesNoValues),
    donor_scarring_present: z.enum(yesNoValues).optional(),
    donor_density_per_cm2: z.coerce.number().min(0).max(200).optional(),
    avg_hairs_per_graft: z.coerce.number().min(0).max(10).optional(),
    overharvesting_risk_flag: z.enum(yesNoValues).optional(),
    overharvesting_signs: z.array(z.enum(overharvestingSignValues)).optional(),
    donor_mapping_notes: z.string().optional(),

    // Section 14: Patient Profile
    patientAge: z.coerce.number().min(10).max(100),
    patientGender: z.enum(["male", "female", "other"]),
    hairLossClassification: z.enum([
      "norwood_1", "norwood_2", "norwood_3", "norwood_4", "norwood_5", "norwood_6", "norwood_7",
      "ludwig_1", "ludwig_2", "ludwig_3", "diffuse", "other"
    ]),
    hairLossOtherText: z.string().optional(),
    donorDensityMeasuredPreOp: z.enum(["yes_trichoscopy", "yes_visual", "no"]),
    preOpDensityFuPerCm2: z.number().min(0).max(200).optional(),

    // Section 5: Procedure Overview (procedure type is canonical in section 4: procedure_type + primary_procedure_type)
    procedureType: z.enum(["fue_manual", "fue_motorized", "fue_robotic", "fut", "combined"]).optional(),
    totalGraftsExtracted: z.coerce.number().min(1).max(10000),
    totalGraftsImplanted: z.coerce.number().min(1).max(10000),
    extractionPerformedBy: z.enum(["doctor", "nurse", "technician", "mixed"]),
    implantationPerformedBy: z.enum(["doctor", "nurse", "technician", "mixed"]),

    // Section 6: Basic surgical metadata (required, multi-select where applicable)
    extraction_method: z.array(z.enum(extractionMethodValues)).min(1, "Select at least one extraction method"),
    extraction_devices_used: z.array(z.enum(extractionDeviceValues)).min(1, "Select at least one extraction device"),
    extraction_technique: z.array(z.enum(extractionTechniqueValues)).min(1, "Select at least one extraction technique"),
    extraction_operator: z.enum(extractionOperatorValues),
    punch_sizes_used: z.array(z.enum(punchSizeValues)).min(1, "Select at least one punch size"),
    punch_types_used: z.array(z.enum(punchTypeValues)).min(1, "Select at least one punch type"),
    holding_solutions_used: z.array(z.enum(holdingSolutionValues)).min(1, "Select at least one holding solution"),
    grafts_kept_hydrated: z.enum(yesNoValues),
    sorting_performed: z.enum(yesNoValues).optional(),
    implantation_method: z.array(z.enum(implantationMethodValues)).min(1, "Select at least one implantation method"),
    implantation_devices_used: z.array(z.enum(implantationDeviceValues)).min(1, "Select at least one implantation device"),
    implanted_by: z.enum(implantedByValues),
    postoperative_treatments_included: z
      .array(z.enum(postopTreatmentValues))
      .min(1, "Select at least one included post-op treatment"),
    postoperative_treatments_recommended: z
      .array(z.enum(postopTreatmentValues))
      .min(1, "Select at least one recommended post-op treatment"),
    follow_up_plan_documented: z.enum(yesNoValues),
    outcome_audit_stage: z.enum(outcomeAuditStageValues).optional(),
    growth_outcome_category: z.enum(growthOutcomeCategoryValues).optional(),
    donor_healing_category: z.enum(donorHealingCategoryValues).optional(),

    // Section 7: FUE (required if FUE)
    fuePunchType: z.string().optional(),
    fuePunchDiameterRangeMm: z.string().optional(),
    fuePunchMovement: z.string().optional(),
    fueDepthControl: z.string().optional(),
    fueDocumentedTransectionRatePercent: z.number().min(0).max(100).optional(),

    // Section 8: FUT (required if FUT)
    futBladeType: z.string().optional(),
    futClosureTechnique: z.string().optional(),
    futMicroscopicDissectionUsed: z.string().optional(),

    // Section 9: Graft Handling
    holdingSolution: z.enum(["saline", "hypothermic", "atp_enhanced", "other"]),
    holdingSolutionOtherText: z.string().optional(),
    temperatureControlled: z.enum(["ice_bowl", "measured_digital", "no_control"]),
    outOfBodyTimeLogged: z.enum(["no", "estimated", "digitally_logged"]),
    avgOutOfBodyTimeHours: z.number().min(0).max(24).optional(),
    microscopeStationsUsed: z.enum(["0", "1_2", "3_4", "5_plus"]),
    microscopeType: z.enum(["basic_stereo", "high_end_stereo"]).optional(),

    // Section 10: Recipient Site & Implantation
    recipientTool: z.enum(["steel_blade", "sapphire_blade", "needle", "implanter_pen", "mixed"]),
    implantationMethod: z.enum(["forceps", "premade_slits_forceps", "implanter"]),
    recipient_sites_created_by: z.enum(recipientSitesCreatedByValues),
    site_creation_method: z.array(z.enum(siteCreationMethodValues)).min(1, "Select at least one site creation method"),
    slit_orientation: z.enum(slitOrientationValues).optional(),
    site_instrument_sizes_used: z.array(z.enum(siteInstrumentSizeValues)).optional(),
    dense_packing_attempted: z.enum(["yes", "no"]).optional(),
    densePackingAttempted: z.enum(["yes", "no"]).optional(), // legacy compatibility
    hairline_direction_quality: z.enum(hairlineDirectionQualityValues).optional(),
    angle_direction_notes: z.string().optional(),
    native_hair_protection_strategy: z.string().optional(),
    implanterType: z.string().optional(),
    implanterOtherText: z.string().optional(),

    // Section 11: Donor Management
    donorMappingMethod: z.enum(["visual_only", "measured_zones", "density_mapped_grid"]),
    percentExtractionPerZoneControlled: z.enum(["yes", "no"]),
    postOpDonorDensityMeasured: z.enum(["yes", "no"]).optional(),

    // Section 12: Sterility & Safety
    sterilizationProtocol: z.array(z.string()).min(1, "At least one sterilization method required"),
    graftCountDoubleVerified: z.enum(["yes", "no"]),
    intraOpComplications: z.string().optional(),
    complicationsOtherText: z.string().optional(),

    // Section 13: Cost
    totalProcedureCostUsd: z.coerce.number().min(0).max(500000),
    costModel: z.enum(["per_graft", "per_session", "package"]),
    includedInCost: z.array(z.string()).optional(),

    // Section 14: Post-Op Protocol
    dhtManagementRecommended: z.enum(["yes", "no"]),
    prpPostOpUsed: z.enum(["yes", "no"]),
    followUpScheduleStandardized: z.enum(["yes", "no"]),
    photoDocumentationRequired12Month: z.enum(["yes", "no"]),

    // Section 15: Advanced / Forensic
    primary_extraction_device: z.enum(extractionDeviceValues).optional(),
    extraction_experience_years: z.coerce.number().min(0).max(60).optional(),
    primary_punch_size: z.enum(punchSizeValues).optional(),
    primary_punch_type: z.enum(punchTypeValues).optional(),
    punch_manufacturers_used: z.array(z.enum(punchManufacturerValues)).optional(),
    primary_holding_solution: z.enum(holdingSolutionValues).optional(),
    primary_implantation_device: z.enum(implantationDeviceValues).optional(),
    implantation_time_minutes: z.coerce.number().min(0).max(1440).optional(),
    singles_reserved_for_hairline: z.enum(yesNoValues).optional(),
    intraoperative_adjuncts_used: z.array(z.enum(intraopAdjunctValues)).optional(),
    intraop_prp_used: z.enum(yesNoValues).optional(),
    intraop_exosomes_used: z.enum(yesNoValues).optional(),
    exosome_type: z.enum(exosomeTypeValues).optional(),
    partial_transection_used: z.enum(yesNoValues).optional(),
    intraop_adjunct_notes: z.string().optional(),
    extraction_device_change_notes: z.string().optional(),
    punch_size_change_notes: z.string().optional(),
    punch_type_change_notes: z.string().optional(),
    holding_solution_notes: z.string().optional(),
    graft_handling_team_notes: z.string().optional(),
    microscopic_inspection_used: z.enum(yesNoValues).optional(),
    graft_composition_available: z.enum(yesNoValues).optional(),
    graft_tray_quality_rating: z.enum(graftTrayQualityRatingValues).optional(),
    graft_sorting_method: z.array(z.enum(graftSortingMethodValues)).optional(),
    visible_transection_on_tray: z.enum(visibleTransectionOnTrayValues).optional(),
    graft_tissue_quality_concern: z.array(z.enum(graftTissueQualityConcernValues)).optional(),
    microscopic_graft_review_available: z.enum(yesNoValues).optional(),
    implantation_device_notes: z.string().optional(),
    popping_issues_observed: z.enum(yesNoValues).optional(),
    implant_depth_consistency: z.enum(implantDepthConsistencyValues).optional(),
    postoperative_protocol_notes: z.string().optional(),
    finasteride_recommended: z.enum(yesNoValues).optional(),
    minoxidil_recommended: z.enum(yesNoValues).optional(),
    donor_recovery_protocol_included: z.enum(yesNoValues).optional(),
    patient_satisfaction_category: z.enum(patientSatisfactionCategoryValues).optional(),
    corrective_surgery_likely: z.enum(yesNoValues).optional(),
    outcome_notes: z.string().optional(),
    review_concern_categories: z.array(z.enum(reviewConcernCategoryValues)).optional(),
    claimed_evidenced_discrepancy: z.enum(yesNoValues).optional(),
    incomplete_records_flag: z.enum(yesNoValues).optional(),
    case_complexity_rating: z.enum(caseComplexityRatingValues).optional(),
    auditor_confidence_level: z.enum(auditorConfidenceLevelValues).optional(),
    forensic_notes: z.string().optional(),
    reason_for_intraoperative_changes: z.string().optional(),
    motor_speed_rpm: z.coerce.number().min(0).max(12000).optional(),
    punch_motion: z.array(z.enum(punchMotionValues)).optional(),
    transection_category: z.enum(transectionCategoryValues).optional(),
    transection_rate_percent: z.coerce.number().min(0).max(100).optional(),
    buried_graft_rate_percent: z.coerce.number().min(0).max(100).optional(),
    extraction_time_minutes: z.coerce.number().min(0).max(1440).optional(),
    out_of_body_time_category: z.enum(outOfBodyTimeCategoryValues).optional(),
    temperature_controlled_storage: z.enum(temperatureStorageValues).optional(),
    surgeon_vs_technician_split_notes: z.string().optional(),

    // Section 16: Doctor Self-Assessment
    estimatedGraftSurvivalPercent: z.number().min(0).max(100).optional(),
    overallCaseSuccessRating: z.coerce.number().min(1).max(5),
    notesOptional: z.string().optional(),
    field_provenance: z.record(z.string(), z.enum(FIELD_PROVENANCE_VALUES)).optional(),
  })
  .refine(
    (d) => d.procedure_type.includes(d.primary_procedure_type),
    { message: "Primary procedure type must be included in procedure type selections", path: ["primary_procedure_type"] }
  )
  .refine(
    (d) => !d.primary_area_treated || d.areas_treated.includes(d.primary_area_treated),
    { message: "Primary area treated must be included in areas treated selections", path: ["primary_area_treated"] }
  )
  .refine(
    (d) => {
      const pt = d.primary_procedure_type ?? (d as { procedureType?: string }).procedureType;
      const isFue = pt && PROCEDURE_TYPE_FUE.includes(pt as (typeof PROCEDURE_TYPE_FUE)[number]);
      const isFut = pt && PROCEDURE_TYPE_FUT.includes(pt as (typeof PROCEDURE_TYPE_FUT)[number]);
      if (isFue && (!d.fuePunchType || !d.fuePunchDiameterRangeMm || !d.fuePunchMovement || !d.fueDepthControl))
        return false;
      if (isFut && (!d.futBladeType || !d.futClosureTechnique || !d.futMicroscopicDissectionUsed)) return false;
      return true;
    },
    { message: "FUE/FUT-specific fields are required based on primary procedure type" }
  )
  .refine(
    (d) => {
      const needsImplanter =
        d.recipientTool === "implanter_pen" || d.implantationMethod === "implanter";
      if (needsImplanter && !d.implanterType) return false;
      return true;
    },
    { message: "Implanter type is required when using implanter pen or implanter method" }
  )
  .refine(
    (d) => {
      if (d.holdingSolution === "other" && !d.holdingSolutionOtherText) return false;
      return true;
    },
    { message: "Please specify holding solution when Other is selected" }
  );

export type DoctorAuditFormData = z.infer<typeof doctorAuditSchema>;

/** Validate doctor answers; returns first error message or null if valid */
export function validateDoctorAnswers(data: Record<string, unknown>): string | null {
  const parsed = doctorAuditSchema.safeParse(data);
  if (parsed.success) return null;
  const issues = (parsed as { error: { issues?: Array<{ path: (string | number)[]; message: string }> } }).error?.issues ?? [];
  const first = issues[0];
  const path = first?.path ? String((first.path as string[]).join(".")) : "";
  return first ? (path ? `${path}: ${first.message}` : first.message) : "Validation failed";
}

/** Canonical camel -> snake mapping for storage. UI may send camelCase; we persist snake_case. */
const CAMEL_TO_SNAKE: Record<string, string> = {
  doctorName: "doctor_name",
  clinicName: "clinic_name",
  clinicLocation: "clinic_location",
  medicalDegree: "medical_degree",
  yearsPerformingHairTransplants: "years_performing_hair_transplants",
  percentPracticeHairTransplant: "percent_practice_hair_transplant",
  otherMembershipText: "other_membership_text",
  procedureType: "primary_procedure_type",
  totalGraftsExtracted: "total_grafts_extracted",
  totalGraftsImplanted: "total_grafts_implanted",
  extractionPerformedBy: "extraction_performed_by",
  implantationPerformedBy: "implantation_performed_by",
  holdingSolution: "primary_holding_solution",
  holdingSolutionOtherText: "holding_solution_other_text",
  temperatureControlled: "temperature_controlled_storage",
  outOfBodyTimeLogged: "out_of_body_time_logged",
  avgOutOfBodyTimeHours: "avg_out_of_body_time_hours",
  microscopeStationsUsed: "microscope_stations_used",
  microscopeType: "microscope_type",
  recipientTool: "recipient_tool",
  implantationMethod: "implantation_method",
  densePackingAttempted: "dense_packing_attempted",
  implanterType: "implanter_type",
  implanterOtherText: "implanter_other_text",
  donorMappingMethod: "donor_mapping_method",
  percentExtractionPerZoneControlled: "percent_extraction_per_zone_controlled",
  postOpDonorDensityMeasured: "post_op_donor_density_measured",
  totalProcedureCostUsd: "total_procedure_cost_usd",
  costModel: "cost_model",
  includedInCost: "included_in_cost",
  dhtManagementRecommended: "dht_management_recommended",
  prpPostOpUsed: "prp_post_op_used",
  followUpScheduleStandardized: "follow_up_schedule_standardized",
  photoDocumentationRequired12Month: "photo_documentation_required_12_month",
  estimatedGraftSurvivalPercent: "estimated_graft_survival_percent",
  overallCaseSuccessRating: "overall_case_success_rating",
  notesOptional: "notes_optional",
  intraOpComplications: "intra_op_complications",
  complicationsOtherText: "complications_other_text",
  fuePunchType: "fue_punch_type",
  fuePunchDiameterRangeMm: "fue_punch_diameter_range_mm",
  fuePunchMovement: "fue_punch_movement",
  fueDepthControl: "fue_depth_control",
  fueDocumentedTransectionRatePercent: "fue_documented_transection_rate_percent",
  futBladeType: "fut_blade_type",
  futClosureTechnique: "fut_closure_technique",
  futMicroscopicDissectionUsed: "fut_microscopic_dissection_used",
};

/** Normalize doctor answers to snake_case for storage. Preserves field_provenance and unknown keys. */
export function normalizeDoctorAnswersToSnake(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (key === "field_provenance") {
      out[key] = value;
      continue;
    }
    const snake = CAMEL_TO_SNAKE[key];
    if (snake) {
      out[snake] = value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

const SNAKE_TO_CAMEL_FOR_FORM: Record<string, string> = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([camel, snake]) => [snake, camel])
);

/** Map stored (snake_case) doctor_answers back to form-expected keys for GET. */
export function mapStoredDoctorAnswersToForm(stored: Record<string, unknown> | null): Record<string, unknown> {
  if (!stored || typeof stored !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (value === undefined) continue;
    const camel = SNAKE_TO_CAMEL_FOR_FORM[key];
    if (camel) {
      out[camel] = value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Map legacy doctor_answers keys to new schema keys for backward compatibility */
export function mapLegacyDoctorAnswers(legacy: Record<string, unknown> | null): Record<string, unknown> {
  if (!legacy || typeof legacy !== "object") return {};
  const m: Record<string, unknown> = {};
  const map: Record<string, string> = {
    doctor_name: "doctorName",
    practice_name: "clinicName",
    practice_location: "clinicLocation",
    medical_degree: "medicalDegree",
    years_experience: "yearsPerformingHairTransplants",
    patient_age: "patientAge",
    patient_gender: "patientGender",
    hair_loss_pattern: "hairLossClassification",
    medical_history: "notesOptional",
    technique: "procedureType",
    grafts_extracted: "totalGraftsExtracted",
    grafts_implanted: "totalGraftsImplanted",
    extraction_performed_by: "extractionPerformedBy",
    preparation_performed_by: "notesOptional", // merge into notes
    implantation_performed_by: "implantationPerformedBy",
    total_cost: "totalProcedureCostUsd",
    cost_inclusions: "includedInCost",
    success_rating: "overallCaseSuccessRating",
    additional_comments: "notesOptional",
  };
  const techniqueMap: Record<string, string> = {
    fue: "fue_manual",
    fut: "fut",
    dhi: "fue_motorized",
    robotic: "fue_robotic",
  };
  const notesParts: string[] = [];
  for (const [oldKey, val] of Object.entries(legacy)) {
    if (val === null || val === undefined) continue;
    if (oldKey === "preparation_performed_by" || oldKey === "additional_comments") {
      if (typeof val === "string" && val.trim()) notesParts.push(val);
      continue;
    }
    const newKey = map[oldKey] ?? oldKey;
    let v = val;
    if (oldKey === "technique" && typeof val === "string") v = techniqueMap[val] ?? val;
    if (oldKey === "extraction_performed_by" || oldKey === "implantation_performed_by") {
      const s = String(val).toLowerCase();
      if (s.includes("doctor") && !s.includes("nurse") && !s.includes("technician")) v = "doctor";
      else if (s.includes("nurse") && !s.includes("technician")) v = "nurse";
      else if (s.includes("technician") && !s.includes("nurse")) v = "technician";
      else v = "mixed";
    }
    if (oldKey === "total_cost" && typeof val === "string") {
      const num = parseFloat(String(val).replace(/[^0-9.]/g, ""));
      v = Number.isFinite(num) ? num : val;
    }
    if (oldKey === "hair_loss_pattern" && typeof val === "string") {
      const hlMap: Record<string, string> = {
        norwood_1: "norwood_1", norwood_2: "norwood_2", norwood_3: "norwood_3",
        norwood_4: "norwood_4", norwood_5: "norwood_5", norwood_6: "norwood_6",
        ludwig_1: "ludwig_1", ludwig_2: "ludwig_2", ludwig_3: "ludwig_3",
        diffuse: "diffuse", other: "other",
      };
      v = hlMap[val] ?? val;
    }
    if (oldKey === "cost_inclusions" && Array.isArray(val)) {
      const incMap: Record<string, string> = {
        consultation: "consultation", prp: "prp", procedure: "procedure",
        anesthesia: "anaesthesia", facility: "facility", postop_care: "follow_up",
        medications: "medications", other: "other",
      };
      v = val.map((x) => incMap[String(x)] ?? x);
    }
    m[newKey] = v;
  }
  if (notesParts.length) m.notesOptional = notesParts.join("\n\n");
  return m;
}
