/**
 * Doctor audit scenarios for the test harness.
 */

import type { ScenarioDefinition } from "../types/scenario";
import {
  createMinimalDoctorAnswersFue,
  createDoctorAnswersWithProvenance,
} from "../data/factories";
import { getGoldDoctorAnswers } from "../data/goldDoctorAnswers";

const DOCTOR_REQUIRED_IMG = [
  "img_preop_front",
  "img_preop_left",
  "img_preop_right",
  "img_preop_top",
  "img_preop_donor_rear",
  "img_immediate_postop_recipient",
  "img_immediate_postop_donor",
] as const;

export const doctorScenarios: ScenarioDefinition[] = [
  {
    meta: {
      id: "doctor.gold",
      name: "Gold-standard doctor (full validation pass)",
      submissionType: "doctor",
      procedureType: "fue",
      description: "Canonical regression: answers pass doctorAuditSchema, readiness pass, manifest ready, scoring eligible, auditor visible.",
    },
    answers: getGoldDoctorAnswers(),
    imageMapping: Object.fromEntries(DOCTOR_REQUIRED_IMG.map((k) => [k, true])),
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      evidenceRecognizesCategories: true,
      readinessPass: true,
      scoringEligible: true,
      auditorMissingConsistent: true,
      notes: "Gold scenario: validation pass, readiness, manifest, scoring, report row (if submit), provenance.",
    },
  },
  {
    meta: {
      id: "doctor.complete-fue",
      name: "Complete doctor FUE case (required images + answers)",
      submissionType: "doctor",
      procedureType: "fue",
      description: "Happy path: all required doctor photo categories; scoring eligible.",
    },
    answers: createMinimalDoctorAnswersFue(),
    imageMapping: Object.fromEntries(DOCTOR_REQUIRED_IMG.map((k) => [k, true])),
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      evidenceRecognizesCategories: true,
      readinessPass: true,
      scoringEligible: true,
      auditorMissingConsistent: true,
      notes: "Doctor schema validation may require extended payload; harness asserts photos + canSubmit.",
    },
  },
  {
    meta: {
      id: "doctor.legacy-preop-donor-rear",
      name: "Doctor legacy upload preop_donor_rear normalizes",
      submissionType: "doctor",
      legacyAliases: true,
      description: "Insert doctor_photo:preop_donor_rear; assert manifest recognizes and required categories satisfied.",
    },
    answers: createMinimalDoctorAnswersFue(),
    imageMapping: {
      img_preop_front: true,
      img_preop_left: true,
      img_preop_right: true,
      img_preop_top: true,
      img_immediate_postop_recipient: true,
      img_immediate_postop_donor: true,
      // img_preop_donor_rear omitted — supplied via legacy upload
    },
    legacyUploads: [{ type: "doctor_photo:preop_donor_rear" }],
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      evidenceRecognizesCategories: true,
      readinessPass: true,
      notes: "Legacy alias preop_donor_rear must normalize to img_preop_donor_rear.",
    },
  },
  {
    meta: {
      id: "doctor.missing-postop-donor",
      name: "Doctor case missing immediate postop donor image",
      submissionType: "doctor",
      description: "Correct missing category reported.",
    },
    answers: createMinimalDoctorAnswersFue(),
    imageMapping: {
      img_preop_front: true,
      img_preop_left: true,
      img_preop_right: true,
      img_preop_top: true,
      img_preop_donor_rear: true,
      img_immediate_postop_recipient: true,
      // img_immediate_postop_donor omitted
    },
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      readinessPass: false,
      expectedMissingCategories: ["img_immediate_postop_donor"],
      scoringBlocked: true,
      auditorMissingConsistent: true,
    },
  },
  {
    meta: {
      id: "doctor.defaults-provenance",
      name: "Doctor case with defaults inherited and overrides → provenance captured",
      submissionType: "doctor",
      provenance: true,
      description: "Provenance recorded correctly.",
    },
    answers: createDoctorAnswersWithProvenance(),
    imageMapping: Object.fromEntries(DOCTOR_REQUIRED_IMG.map((k) => [k, true])),
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      readinessPass: true,
      provenancePresent: true,
      defaultsHandled: true,
      auditorMissingConsistent: true,
    },
  },
  {
    meta: {
      id: "doctor.primary-procedure-fue",
      name: "Doctor primary_procedure_type FUE sections + scoring path",
      submissionType: "doctor",
      procedureType: "fue",
      description: "FUE sections and scoring path verified.",
    },
    answers: createMinimalDoctorAnswersFue({ primary_procedure_type: "fue_manual" }),
    imageMapping: Object.fromEntries(DOCTOR_REQUIRED_IMG.map((k) => [k, true])),
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      readinessPass: true,
      scoringEligible: true,
      notes: "primary_procedure_type drives conditional sections.",
    },
  },
  {
    meta: {
      id: "doctor.legacy-alias",
      name: "Doctor legacy alias normalization",
      submissionType: "doctor",
      legacyAliases: true,
      description: "Legacy aliases (e.g. day0_recipient → img_immediate_postop_recipient) normalize.",
    },
    answers: createMinimalDoctorAnswersFue(),
    imageMapping: {
      preop_front: true,
      preop_left: true,
      preop_right: true,
      preop_top: true,
      preop_donor_rear: true,
      day0_recipient: true,
      day0_donor: true,
    },
    expectations: {
      caseCreated: true,
      uploadsStored: true,
      readinessPass: true,
      notes: "DOCTOR_LEGACY_MAP in auditPhotoSchemas; upload types use img_* so we pass img_* in mapping.",
    },
  },
  // --- Edge: scoring blocked due to incomplete evidence (missing 2+ required) ---
  {
    meta: {
      id: "doctor.scoring-blocked-incomplete",
      name: "Doctor scoring blocked — incomplete evidence (missing 2 required)",
      submissionType: "doctor",
      description: "Missing postop recipient + donor → readiness fail, scoring blocked.",
    },
    answers: createMinimalDoctorAnswersFue(),
    imageMapping: {
      img_preop_front: true,
      img_preop_left: true,
      img_preop_right: true,
      img_preop_top: true,
      img_preop_donor_rear: true,
      // img_immediate_postop_recipient, img_immediate_postop_donor omitted
    },
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      readinessPass: false,
      expectedMissingCategories: ["img_immediate_postop_recipient", "img_immediate_postop_donor"],
      scoringBlocked: true,
      auditorMissingConsistent: true,
    },
  },
  // --- Edge: procedure type normalization (primary_procedure_type + procedure_type array) ---
  {
    meta: {
      id: "doctor.procedure-type-normalization",
      name: "Doctor procedure type normalization (FUE + procedure_type array)",
      submissionType: "doctor",
      procedureType: "fue",
      description: "primary_procedure_type and procedure_type array consistent; FUE path.",
    },
    answers: createMinimalDoctorAnswersFue({
      primary_procedure_type: "fue_manual",
      procedure_type: ["fue_manual"],
    }),
    imageMapping: Object.fromEntries(DOCTOR_REQUIRED_IMG.map((k) => [k, true])),
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      readinessPass: true,
      scoringEligible: true,
      notes: "procedure_type must include primary_procedure_type; FUE conditional sections.",
    },
  },
  // --- Edge: provenance override drift (edited_after_prefill when changing prefilled value) ---
  {
    meta: {
      id: "doctor.provenance-override-drift",
      name: "Doctor provenance override drift (edited_after_prefill)",
      submissionType: "doctor",
      provenance: true,
      overrides: true,
      description: "Prefilled value changed → provenance should show edited_after_prefill.",
    },
    answers: createDoctorAnswersWithProvenance(),
    imageMapping: Object.fromEntries(DOCTOR_REQUIRED_IMG.map((k) => [k, true])),
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      readinessPass: true,
      provenancePresent: true,
      defaultsHandled: true,
      notes: "mergeFieldProvenance sets edited_after_prefill when prefilled value changes.",
    },
  },
];
