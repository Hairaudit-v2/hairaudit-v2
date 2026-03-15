/**
 * Clinic audit scenarios for the test harness.
 */

import type { ScenarioDefinition } from "../types/scenario";
import {
  createMinimalClinicAnswers,
  createClinicAnswersWithProvenance,
} from "../data/factories";
import { getGoldClinicAnswers } from "../data/goldClinicAnswers";

const CLINIC_REQUIRED_IMG = [
  "img_preop_front",
  "img_preop_left",
  "img_preop_right",
  "img_preop_top",
  "img_preop_donor_rear",
  "img_immediate_postop_recipient",
  "img_immediate_postop_donor",
] as const;

export const clinicScenarios: ScenarioDefinition[] = [
  {
    meta: {
      id: "clinic.gold",
      name: "Gold-standard clinic (full validation pass)",
      submissionType: "clinic",
      procedureType: "fue",
      description: "Canonical regression: answers pass clinicAuditSchema, readiness pass, manifest ready, scoring eligible, auditor visible.",
    },
    answers: getGoldClinicAnswers(),
    imageMapping: Object.fromEntries(CLINIC_REQUIRED_IMG.map((k) => [k, true])),
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      evidenceRecognizesCategories: true,
      readinessPass: true,
      scoringEligible: true,
      auditorMissingConsistent: true,
      notes: "Gold scenario: validation pass, readiness, manifest, scoring.",
    },
  },
  {
    meta: {
      id: "clinic.complete-case",
      name: "Complete clinic case (required categories + valid answers)",
      submissionType: "clinic",
      description: "Happy path: required clinic photo categories; readiness pass.",
    },
    answers: createMinimalClinicAnswers(),
    imageMapping: Object.fromEntries(CLINIC_REQUIRED_IMG.map((k) => [k, true])),
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      evidenceRecognizesCategories: true,
      readinessPass: true,
      auditorMissingConsistent: true,
      notes: "Submit API currently treats clinic as patient for canSubmit; harness may assert clinic_photo like doctor.",
    },
  },
  {
    meta: {
      id: "clinic.legacy-preop-donor-rear",
      name: "Clinic legacy upload preop_donor_rear normalizes",
      submissionType: "clinic",
      legacyAliases: true,
      description: "Insert clinic_photo:preop_donor_rear; assert manifest recognizes and required categories satisfied.",
    },
    answers: createMinimalClinicAnswers(),
    imageMapping: {
      img_preop_front: true,
      img_preop_left: true,
      img_preop_right: true,
      img_preop_top: true,
      img_immediate_postop_recipient: true,
      img_immediate_postop_donor: true,
      // img_preop_donor_rear omitted — supplied via legacy upload
    },
    legacyUploads: [{ type: "clinic_photo:preop_donor_rear" }],
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      evidenceRecognizesCategories: true,
      readinessPass: true,
      notes: "Legacy alias preop_donor_rear must normalize to img_preop_donor_rear for clinic.",
    },
  },
  {
    meta: {
      id: "clinic.missing-required",
      name: "Clinic case missing required evidence",
      submissionType: "clinic",
      description: "Readiness fail with correct missing list.",
    },
    answers: createMinimalClinicAnswers(),
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
      id: "clinic.partial-form",
      name: "Clinic partial form case",
      submissionType: "clinic",
      description: "Validation/readiness fail as expected.",
    },
    answers: { primary_procedure_type: "fue_manual" },
    imageMapping: Object.fromEntries(CLINIC_REQUIRED_IMG.map((k) => [k, true])),
    expectations: {
      caseCreated: true,
      uploadsStored: true,
      readinessPass: true,
      expectedMissingFields: ["submission_type", "zones_planned"],
      notes: "Minimal answers; form validation may fail; photo readiness can pass.",
    },
  },
  {
    meta: {
      id: "clinic.defaults-provenance",
      name: "Clinic defaults/provenance scenario",
      submissionType: "clinic",
      provenance: true,
      description: "Provenance and defaults handled.",
    },
    answers: createClinicAnswersWithProvenance(),
    imageMapping: Object.fromEntries(CLINIC_REQUIRED_IMG.map((k) => [k, true])),
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      readinessPass: true,
      provenancePresent: true,
      defaultsHandled: true,
    },
  },
  // --- Edge: multiple missing required evidence → scoring blocked ---
  {
    meta: {
      id: "clinic.multiple-missing-required",
      name: "Clinic multiple missing required categories",
      submissionType: "clinic",
      description: "Missing several required images; readiness fail, scoring blocked.",
    },
    answers: createMinimalClinicAnswers(),
    imageMapping: {
      img_preop_front: true,
      img_preop_left: true,
      img_preop_right: true,
      img_preop_top: true,
      // img_preop_donor_rear, img_immediate_postop_recipient, img_immediate_postop_donor omitted
    },
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      readinessPass: false,
      expectedMissingCategories: ["img_preop_donor_rear", "img_immediate_postop_recipient", "img_immediate_postop_donor"],
      scoringBlocked: true,
      auditorMissingConsistent: true,
    },
  },
  // --- Edge: procedure type normalization (clinic: procedure_type array + primary) ---
  {
    meta: {
      id: "clinic.procedure-type-normalization",
      name: "Clinic procedure type normalization",
      submissionType: "clinic",
      procedureType: "fue",
      description: "procedure_type array includes primary_procedure_type; consistent normalization.",
    },
    answers: createMinimalClinicAnswers({
      primary_procedure_type: "fue_manual",
      procedure_type: ["fue_manual"],
    }),
    imageMapping: Object.fromEntries(CLINIC_REQUIRED_IMG.map((k) => [k, true])),
    expectations: {
      caseCreated: true,
      answersStored: true,
      uploadsStored: true,
      readinessPass: true,
      notes: "Clinic schema: procedure_type.includes(primary_procedure_type).",
    },
  },
];
