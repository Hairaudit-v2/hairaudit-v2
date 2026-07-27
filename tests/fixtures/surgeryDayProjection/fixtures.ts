/**
 * HA-PROJECTION-1C — Synthetic (no PHI) fixtures for projection report tests / smoke.
 */

import { buildSurgeryDayProcedureReconstruction } from "@/lib/projection/surgeryDayProcedureReconstruction";
import { buildSurgeryDayProjectedOutcome } from "@/lib/projection/surgeryDayProjectedOutcome";
import type {
  SurgeryDayProcedureReconstruction,
  SurgeryDayProjectedOutcome,
} from "@/lib/projection/types";

const RICH_FORENSIC = {
  section_scores: {
    hairline_design: 82,
    recipient_placement: 75,
    density_distribution: 78,
    naturalness_and_aesthetics: 74,
    donor_management: 72,
    extraction_quality: 70,
  },
  section_score_evidence: {
    hairline_design: [
      "The hairline demonstrates visible irregularity rather than a uniform straight edge.",
    ],
    recipient_placement: [
      "Implantation appears concentrated through the frontal treatment zone.",
    ],
    density_distribution: [
      "The visible recipient pattern appears denser through the frontal region than posteriorly.",
    ],
    naturalness_and_aesthetics: [
      "Macro transition appears soft and graduated where visible.",
    ],
    donor_management: [
      "Extraction sites appear broadly distributed across the visible donor region.",
    ],
    extraction_quality: [
      "Extraction sites appear evenly spaced in the photographed donor area.",
    ],
  },
};

function requirePair(input: Parameters<typeof buildSurgeryDayProcedureReconstruction>[0]): {
  reconstruction: SurgeryDayProcedureReconstruction;
  projectedOutcome: SurgeryDayProjectedOutcome;
} {
  const rebuilt = buildSurgeryDayProcedureReconstruction(input);
  if (!rebuilt.ok) throw new Error(rebuilt.reason);
  const outcome = buildSurgeryDayProjectedOutcome(rebuilt.reconstruction);
  if (!outcome.ok || !outcome.projectedOutcome) {
    throw new Error(outcome.reason || "projection failed");
  }
  return {
    reconstruction: rebuilt.reconstruction,
    projectedOutcome: outcome.projectedOutcome,
  };
}

/** Fixture A — baseline + surgery-day + graft metadata */
export function fixtureA_baselinePlusSurgeryDay() {
  return requirePair({
    uploads: [
      { type: "patient_photo:day0_recipient" },
      { type: "patient_photo:day0_donor" },
      { type: "clinic_photo:img_preop_front" },
      { type: "clinic_photo:img_preop_top" },
      { type: "doctor_photo:img_marking_design" },
      { type: "doctor_photo:img_implantation_stage" },
    ],
    evidenceContext: { pathway: "post_surgery" },
    procedureSources: {
      clinicAnswers: {
        surgery_date: "2026-06-01",
        procedure_type: ["FUE"],
        actual_graft_count: 3180,
        avg_hairs_per_graft: 2.1,
        punch_size_mm: 0.85,
        areas_treated: ["hairline", "frontal", "temples"],
        extraction_method: "Motorized FUE",
        implantation_method: "Forceps",
      },
      patientAnswers: {
        graft_number_received: 3000,
      },
    },
    forensicAudit: RICH_FORENSIC,
    graftIntegrity: {
      estimated_implanted_min: 2900,
      estimated_implanted_max: 3300,
      confidence_label: "medium",
      auditor_status: "pending",
    },
  });
}

/** Fixture B — surgery-day only */
export function fixtureB_surgeryDayOnly() {
  return requirePair({
    uploads: [
      { type: "patient_photo:day0_recipient" },
      { type: "patient_photo:day0_donor" },
    ],
    forensicAudit: RICH_FORENSIC,
    procedureSources: {
      clinicAnswers: {
        actual_graft_count: 2500,
        areas_treated: ["hairline", "frontal"],
      },
    },
  });
}

/** Fixture C — limited evidence / no donor */
export function fixtureC_limitedNoDonor() {
  return requirePair({
    uploads: [{ type: "patient_photo:day0_recipient" }],
    forensicAudit: {
      section_scores: { recipient_placement: 70, density_distribution: 68 },
      section_score_evidence: {
        recipient_placement: [
          "Placement spacing appears relatively even in the frontal field.",
        ],
        density_distribution: [
          "The visible recipient pattern appears denser through the frontal region than posteriorly.",
        ],
      },
    },
    procedureSources: {
      clinicAnswers: { areas_treated: ["frontal"] },
    },
  });
}

/** Conflicting graft metadata (clinic vs patient) */
export function fixtureE_conflictingGrafts() {
  return requirePair({
    uploads: [
      { type: "patient_photo:day0_recipient" },
      { type: "clinic_photo:img_preop_front" },
    ],
    evidenceContext: { pathway: "post_surgery" },
    procedureSources: {
      clinicAnswers: {
        actual_graft_count: 3180,
        areas_treated: ["hairline", "frontal"],
      },
      patientAnswers: {
        graft_number_received: 2800,
      },
    },
    forensicAudit: RICH_FORENSIC,
    graftIntegrity: {
      estimated_implanted_min: 2900,
      estimated_implanted_max: 3300,
      confidence_label: "medium",
    },
  });
}

export const SYNTHETIC_PHOTOS_BY_CATEGORY = {
  "Patient - day0_recipient": [
    { signedUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", label: "Surgery-day recipient" },
  ],
  "Patient - day0_donor": [
    { signedUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", label: "Surgery-day donor" },
  ],
  "Clinic - img_preop_front": [
    { signedUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", label: "Preoperative front" },
  ],
};
