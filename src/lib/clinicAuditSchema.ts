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
  EXTRACTION_METHOD_OPTIONS,
  EXTRACTION_TECHNIQUE_OPTIONS,
  EXTRACTION_OPERATOR_OPTIONS,
  TRANSECTION_CATEGORY_OPTIONS,
  RECIPIENT_SITES_CREATED_BY_OPTIONS,
  SITE_CREATION_METHOD_OPTIONS,
  SLIT_ORIENTATION_OPTIONS,
  SITE_INSTRUMENT_SIZE_OPTIONS,
  HAIRLINE_DIRECTION_QUALITY_OPTIONS,
  EXTRACTION_DEVICE_OPTIONS,
  PUNCH_SIZE_OPTIONS,
  PUNCH_TYPE_OPTIONS,
  PUNCH_MANUFACTURER_OPTIONS,
  PUNCH_MOTION_OPTIONS,
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
} from "./audit/masterSurgicalMetadata";

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
const extractionMethodValues = EXTRACTION_METHOD_OPTIONS.map((o) => o.value) as [string, ...string[]];
const extractionTechniqueValues = EXTRACTION_TECHNIQUE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const extractionOperatorValues = EXTRACTION_OPERATOR_OPTIONS.map((o) => o.value) as [string, ...string[]];
const transectionCategoryValues = TRANSECTION_CATEGORY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const recipientSitesCreatedByValues = RECIPIENT_SITES_CREATED_BY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const siteCreationMethodValues = SITE_CREATION_METHOD_OPTIONS.map((o) => o.value) as [string, ...string[]];
const slitOrientationValues = SLIT_ORIENTATION_OPTIONS.map((o) => o.value) as [string, ...string[]];
const siteInstrumentSizeValues = SITE_INSTRUMENT_SIZE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const hairlineDirectionQualityValues = HAIRLINE_DIRECTION_QUALITY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const extractionDeviceValues = EXTRACTION_DEVICE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const punchSizeValues = PUNCH_SIZE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const punchTypeValues = PUNCH_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const punchManufacturerValues = PUNCH_MANUFACTURER_OPTIONS.map((o) => o.value) as [string, ...string[]];
const punchMotionValues = PUNCH_MOTION_OPTIONS.map((o) => o.value) as [string, ...string[]];
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

export const clinicAuditSchema = z
  .object({
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

    procedure_type: z.array(z.enum(procedureTypeValues)).min(1, "Select at least one procedure type"),
    primary_procedure_type: z.enum(procedureTypeValues),
    areas_treated: z.array(z.enum(areasTreatedValues)).min(1, "Select at least one treated area"),
    primary_area_treated: z.enum(areasTreatedValues).optional(),
    hairline_lowering_flag: z.enum(yesNoValues).optional(),
    crown_included_flag: z.enum(yesNoValues).optional(),
    beard_donor_used: z.enum(yesNoValues).optional(),
    body_donor_used: z.enum(yesNoValues).optional(),

    patient_age_bracket: z.enum(patientAgeBracketValues),
    patient_sex: z.enum(patientSexValues),
    ethnicity_hair_background: z.array(z.enum(ethnicityHairBackgroundValues)).optional(),
    hair_type_curl_pattern: z.enum(hairTypeCurlPatternValues),
    hair_calibre_category: z.enum(hairCalibreCategoryValues),
    hair_shaft_diameter_microns: z.coerce.number().min(0).max(300).optional(),
    hair_colour: z.enum(hairColourValues).optional(),
    skin_hair_contrast: z.enum(skinHairContrastValues).optional(),

    primary_diagnosis: z.enum(primaryDiagnosisValues),
    secondary_diagnosis: z.array(z.enum(secondaryDiagnosisValues)).optional(),
    hair_loss_scale_used: z.enum(hairLossScaleValues),
    hair_loss_grade: z.string().min(1, "Required"),
    hair_loss_stability: z.enum(hairLossStabilityValues),
    miniaturisation_present: z.enum(yesNoValues),
    miniaturisation_regions: z.array(z.enum(miniaturisationRegionValues)).optional(),
    dupa_retrograde_flag: z.enum(yesNoValues).optional(),
    scalp_condition_flags: z.array(z.enum(scalpConditionFlagValues)).optional(),

    planned_graft_count: z.coerce.number().int().min(0).max(50000),
    actual_graft_count: z.coerce.number().int().min(0).max(50000),
    estimated_hair_count: z.coerce.number().int().min(0).max(100000).optional(),
    zones_planned: z.array(z.enum(zonesPlannedValues)).min(1, "Select at least one planned zone"),
    density_goal_by_zone: z.string().optional(),
    hairline_design_strategy: z.string().optional(),
    future_loss_planning: z.enum(yesNoValues).optional(),
    risk_counselling_documented: z.enum(yesNoValues).optional(),
    candidate_suitability_rating: z.enum(candidateSuitabilityValues).optional(),

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

    extraction_method: z.array(z.enum(extractionMethodValues)).min(1, "Select at least one extraction method"),
    extraction_devices_used: z.array(z.enum(extractionDeviceValues)).min(1, "Select at least one extraction device"),
    extraction_technique: z.array(z.enum(extractionTechniqueValues)).min(1, "Select at least one extraction technique"),
    extraction_operator: z.enum(extractionOperatorValues),
    recipient_sites_created_by: z.enum(recipientSitesCreatedByValues),
    site_creation_method: z.array(z.enum(siteCreationMethodValues)).min(1, "Select at least one site creation method"),
    slit_orientation: z.enum(slitOrientationValues).optional(),
    site_instrument_sizes_used: z.array(z.enum(siteInstrumentSizeValues)).optional(),
    dense_packing_attempted: z.enum(yesNoValues).optional(),
    hairline_direction_quality: z.enum(hairlineDirectionQualityValues).optional(),
    angle_direction_notes: z.string().optional(),
    native_hair_protection_strategy: z.string().optional(),
    extraction_experience_years: z.coerce.number().min(0).max(60).optional(),
    punch_sizes_used: z.array(z.enum(punchSizeValues)).min(1, "Select at least one punch size"),
    punch_types_used: z.array(z.enum(punchTypeValues)).min(1, "Select at least one punch type"),
    holding_solutions_used: z.array(z.enum(holdingSolutionValues)).min(1, "Select at least one holding solution"),
    grafts_kept_hydrated: z.enum(yesNoValues),
    sorting_performed: z.enum(yesNoValues).optional(),
    implantation_method: z.array(z.enum(implantationMethodValues)).min(1, "Select at least one implantation method"),
    implantation_devices_used: z.array(z.enum(implantationDeviceValues)).min(1, "Select at least one implantation device"),
    implanted_by: z.enum(implantedByValues),
    intraoperative_adjuncts_used: z.array(z.enum(intraopAdjunctValues)).optional(),
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
    primary_extraction_device: z.enum(extractionDeviceValues).optional(),
    primary_punch_size: z.enum(punchSizeValues).optional(),
    primary_punch_type: z.enum(punchTypeValues).optional(),
    punch_manufacturers_used: z.array(z.enum(punchManufacturerValues)).optional(),
    punch_motion: z.array(z.enum(punchMotionValues)).optional(),
    motor_speed_rpm: z.coerce.number().min(0).max(12000).optional(),
    primary_holding_solution: z.enum(holdingSolutionValues).optional(),
    primary_implantation_device: z.enum(implantationDeviceValues).optional(),
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
    postoperative_protocol_notes: z.string().optional(),
    reason_for_intraoperative_changes: z.string().optional(),
    transection_category: z.enum(transectionCategoryValues).optional(),
    transection_rate_percent: z.coerce.number().min(0).max(100).optional(),
    buried_graft_rate_percent: z.coerce.number().min(0).max(100).optional(),
    extraction_time_minutes: z.coerce.number().min(0).max(1440).optional(),
    implantation_time_minutes: z.coerce.number().min(0).max(1440).optional(),
    singles_reserved_for_hairline: z.enum(yesNoValues).optional(),
    popping_issues_observed: z.enum(yesNoValues).optional(),
    implant_depth_consistency: z.enum(implantDepthConsistencyValues).optional(),
    intraop_prp_used: z.enum(yesNoValues).optional(),
    intraop_exosomes_used: z.enum(yesNoValues).optional(),
    exosome_type: z.enum(exosomeTypeValues).optional(),
    partial_transection_used: z.enum(yesNoValues).optional(),
    intraop_adjunct_notes: z.string().optional(),
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
    surgeon_vs_technician_split_notes: z.string().optional(),
  })
  .refine(
    (d) => d.procedure_type.includes(d.primary_procedure_type),
    { message: "Primary procedure type must be included in procedure type selections", path: ["primary_procedure_type"] }
  )
  .refine(
    (d) => !d.primary_area_treated || d.areas_treated.includes(d.primary_area_treated),
    { message: "Primary area treated must be included in areas treated selections", path: ["primary_area_treated"] }
  )
  .passthrough();

export function validateClinicAnswers(data: Record<string, unknown>): string | null {
  const parsed = clinicAuditSchema.safeParse(data);
  if (parsed.success) return null;
  const issues = (parsed as { error: { issues?: Array<{ path: (string | number)[]; message: string }> } }).error
    ?.issues ?? [];
  const first = issues[0];
  const path = first?.path ? String((first.path as string[]).join(".")) : "";
  return first ? (path ? `${path}: ${first.message}` : first.message) : "Validation failed";
}
