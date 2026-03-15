/**
 * Data factories for minimal valid patient, doctor, and clinic audit payloads.
 * Used by scenario definitions and harness helpers.
 */

import type { ProcedureType } from "../types/scenario";

const QA_PREFIX = "qa_automated_";

/** Minimal valid patient_audit_v2 payload (happy path) */
export function createMinimalPatientAnswers(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    clinic_name: `${QA_PREFIX}Test Clinic`,
    clinic_country: "uk",
    clinic_city: "London",
    procedure_date: "2024-01-15",
    procedure_type: "fue",
    preop_consult: "yes",
    doctor_present_extraction: "yes",
    doctor_present_implant: "yes",
    graft_number_disclosed: "yes",
    graft_number_received: 2500,
    donor_shaving: "full_shave",
    surgery_duration: "4_6h",
    total_paid_currency: "gbp",
    total_paid_amount: 4000,
    cost_model: "package",
    pain_level: 3,
    post_op_swelling: "mild",
    bleeding_issue: "no",
    recovery_time: "2_4_weeks",
    shock_loss: "no",
    complications: "no",
    months_since: "6_9",
    density_satisfaction: 4,
    hairline_naturalness: 4,
    donor_appearance: 5,
    would_repeat: "yes",
    would_recommend: "yes",
    ...overrides,
  };
}

/** Incomplete patient (missing required fields) */
export function createIncompletePatientAnswers(): Record<string, unknown> {
  return {
    clinic_name: `${QA_PREFIX}Clinic`,
    clinic_country: "other",
    clinic_city: "",
    procedure_date: "",
    procedure_type: "fue",
    preop_consult: "yes",
    doctor_present_extraction: "yes",
    doctor_present_implant: "yes",
    graft_number_disclosed: "no",
    donor_shaving: "full_shave",
    surgery_duration: "4_6h",
    total_paid_currency: "usd",
    total_paid_amount: 0,
    cost_model: "package",
    pain_level: 5,
    post_op_swelling: "mild",
    bleeding_issue: "no",
    recovery_time: "2_4_weeks",
    shock_loss: "no",
    complications: "no",
    months_since: "under_3",
    density_satisfaction: 3,
    hairline_naturalness: 3,
    donor_appearance: 4,
    would_repeat: "yes",
    would_recommend: "yes",
  };
}

/** Legacy-style patient keys (recovery_time over_4_weeks, results_satisfaction) for compat test */
export function createLegacyPatientAnswers(): Record<string, unknown> {
  return {
    ...createMinimalPatientAnswers(),
    recovery_time: "4_plus_weeks",
    density_satisfaction: 4,
  };
}

/** Minimal doctor FUE answers (required context + procedure) */
export function createMinimalDoctorAnswersFue(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    submission_type: "full_audit",
    audit_depth_type: "standard",
    requested_by: "doctor",
    review_purpose: "certification",
    country_jurisdiction: "uk",
    primary_procedure_type: "fue_manual",
    areas_treated: ["hairline", "mid_scalp"],
    patient_age_bracket: "30_39",
    patient_sex: "male",
    ethnicity_hair_background: "caucasian",
    hair_type_curl_pattern: "straight",
    hair_calibre_category: "medium",
    hair_colour: "dark_brown",
    skin_hair_contrast: "low",
    primary_diagnosis: "aga",
    hair_loss_scale: "norwood_3",
    hair_loss_stability: "stable",
    zones_planned: ["hairline", "mid_scalp"],
    candidate_suitability: "suitable",
    donor_quality_rating: "good",
    donor_density_rating: "medium",
    estimated_donor_capacity: "3000_4000",
    extraction_method: "fue",
    extraction_technique: "manual",
    extraction_operator: "lead_surgeon",
    extraction_device: "manual_punch",
    punch_size: "0_8mm",
    punch_type: "sharp",
    holding_solution: "saline",
    implantation_device: "implanter",
    implantation_method: "stick_and_place",
    implanted_by: "lead_surgeon",
    implant_depth_consistency: "consistent",
    claimed_grafts_extracted: 2800,
    claimed_grafts_implanted: 2650,
    ...overrides,
  };
}

/** Doctor answers with field_provenance (prefilled_from_doctor_default, edited_after_prefill) */
export function createDoctorAnswersWithProvenance(overrides?: Record<string, unknown>): Record<string, unknown> {
  const base = createMinimalDoctorAnswersFue(overrides);
  return {
    ...base,
    field_provenance: {
      primary_procedure_type: "prefilled_from_doctor_default",
      extraction_method: "edited_after_prefill",
      claimed_grafts_extracted: "entered_manually",
    },
  };
}

/** Minimal clinic answers (same shape as doctor for shared fields) */
export function createMinimalClinicAnswers(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...createMinimalDoctorAnswersFue(overrides),
    ...overrides,
  };
}

/** Clinic with provenance */
export function createClinicAnswersWithProvenance(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...createMinimalClinicAnswers(overrides),
    field_provenance: {
      primary_procedure_type: "prefilled_from_clinic_default",
      country_jurisdiction: "inherited_from_original_case",
    },
    ...overrides,
  };
}
