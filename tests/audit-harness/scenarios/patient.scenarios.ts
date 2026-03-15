/**
 * Patient audit scenarios for the test harness.
 */

import type { ScenarioDefinition } from "../types/scenario";
import {
  createMinimalPatientAnswers,
  createIncompletePatientAnswers,
  createLegacyPatientAnswers,
} from "../data/factories";

export const patientScenarios: ScenarioDefinition[] = [
  {
    meta: {
      id: "patient.complete-fue",
      name: "Complete patient case (FUE, all required images + valid answers)",
      submissionType: "patient",
      procedureType: "fue",
      description: "Happy path: all required patient photo categories and valid form.",
    },
    answers: createMinimalPatientAnswers(),
    imageMapping: {
      preop_front: true,
      preop_top: true,
      preop_donor_rear: true,
      preop_left: true,
      preop_right: true,
      preop_crown: true,
      day0_recipient: true,
      day0_donor: true,
    },
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      evidenceRecognizesCategories: true,
      readinessPass: true,
      scoringEligible: true,
      auditorMissingConsistent: true,
      notes: "Patient submit uses patient_current_* keys via legacy map from preop_*.",
    },
  },
  {
    meta: {
      id: "patient.legacy-donor-rear",
      name: "Patient legacy upload category donor_rear normalizes",
      submissionType: "patient",
      legacyAliases: true,
      description: "Insert patient_photo:donor_rear; assert manifest recognizes and required categories satisfied.",
    },
    answers: createMinimalPatientAnswers(),
    imageMapping: {
      preop_front: true,
      preop_top: true,
      preop_left: true,
      preop_right: true,
      preop_crown: true,
      day0_recipient: true,
      day0_donor: true,
      // preop_donor_rear omitted — supplied via legacy upload
    },
    legacyUploads: [{ type: "patient_photo:donor_rear" }],
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      evidenceRecognizesCategories: true,
      readinessPass: true,
      notes: "Legacy alias donor_rear must normalize to patient_current_donor_rear; missing-category logic must not regress.",
    },
  },
  {
    meta: {
      id: "patient.missing-donor",
      name: "Patient case missing donor rear image",
      submissionType: "patient",
      description: "Readiness should fail with correct missing category.",
    },
    answers: createMinimalPatientAnswers(),
    imageMapping: {
      preop_front: true,
      preop_top: true,
      // preop_donor_rear omitted
      day0_recipient: true,
      day0_donor: true,
    },
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      readinessPass: false,
      expectedMissingCategories: ["patient_current_donor_rear", "preop_donor_rear"],
      scoringBlocked: true,
      auditorMissingConsistent: true,
    },
  },
  {
    meta: {
      id: "patient.minimal-optional-absent",
      name: "Patient minimal valid input, optional images absent",
      submissionType: "patient",
      description: "Only required categories; optional absent → partial readiness per schema.",
    },
    answers: createMinimalPatientAnswers(),
    imageMapping: {
      preop_front: true,
      preop_top: true,
      preop_donor_rear: true,
    },
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      readinessPass: true,
      evidenceRecognizesCategories: true,
      notes: "Required for submit are only patient_current_front, patient_current_top, patient_current_donor_rear.",
    },
  },
  {
    meta: {
      id: "patient.legacy-aliases",
      name: "Patient legacy naming compatibility",
      submissionType: "patient",
      legacyAliases: true,
      description: "Legacy aliases (e.g. donor_rear, preop-front) normalize correctly.",
    },
    answers: createLegacyPatientAnswers(),
    imageMapping: {
      "preop-front": true,
      preop_top: true,
      donor_rear: true,
    },
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      readinessPass: true,
      evidenceRecognizesCategories: true,
      notes: "photoCategories PATIENT_PHOTO_CATEGORY_ALIASES + auditPhotoSchemas legacy map.",
    },
  },
  {
    meta: {
      id: "patient.incomplete-form",
      name: "Patient incomplete form submission",
      submissionType: "patient",
      description: "Validation/readiness fail as expected.",
    },
    answers: createIncompletePatientAnswers(),
    imageMapping: {
      preop_front: true,
      preop_top: true,
      preop_donor_rear: true,
    },
    expectations: {
      caseCreated: true,
      uploadsStored: true,
      readinessPass: true,
      expectedMissingFields: ["clinic_city", "procedure_date"],
      notes: "Form validation fails; photo readiness can still pass.",
    },
  },
  // --- Edge: multiple missing required image categories → scoring blocked ---
  {
    meta: {
      id: "patient.multiple-missing-categories",
      name: "Patient missing multiple required images → scoring blocked",
      submissionType: "patient",
      description: "Only one required category; readiness fail, scoring blocked.",
    },
    answers: createMinimalPatientAnswers(),
    imageMapping: {
      preop_front: true,
      // preop_top, preop_donor_rear omitted
    },
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      readinessPass: false,
      expectedMissingCategories: ["patient_current_top", "patient_current_donor_rear"],
      scoringBlocked: true,
      auditorMissingConsistent: true,
    },
  },
  // --- Edge: legacy alias "postop" → postop_day0 (optional) ---
  {
    meta: {
      id: "patient.legacy-postop-alias",
      name: "Patient legacy postop alias",
      submissionType: "patient",
      legacyAliases: true,
      description: "Legacy alias postop normalizes to postop_day0.",
    },
    answers: createMinimalPatientAnswers(),
    imageMapping: {
      preop_front: true,
      preop_top: true,
      preop_donor_rear: true,
      postop: true,
    },
    expectations: {
      caseCreated: true,
      uploadsStored: true,
      readinessPass: true,
      notes: "PATIENT_PHOTO_CATEGORY_ALIASES: postop → postop_day0.",
    },
  },
];
