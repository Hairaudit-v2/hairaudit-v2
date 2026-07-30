/**
 * HA-PATIENT-REPORT-UI-1A.1 — Deterministic donor-healing report fixtures.
 * Clinical pathway remains post_surgery; seed segment is demo-qa:donorhealing:NN.
 */

import type { DemoQaScenario } from "./types";

const DONOR_INTAKE_BASE = {
  clinic_name: "Demo QA Clinic London",
  clinic_country: "uk",
  clinic_city: "London",
  procedure_date: "2025-01-15",
  procedure_type: "fue",
  preop_consult: "yes",
  graft_number_disclosed: "yes",
  graft_number_received: 2800,
  months_since: "6_9",
  density_satisfaction: 3,
  hairline_naturalness: 3,
  donor_appearance: 3,
  entry_context: "donor_healing",
  primary_donor_concern: "donor_patchiness",
  donor_appearance_trend: "stable",
} as const;

const FULL_DONOR_KEYS = [
  "preop_donor_rear",
  "preop_donor_left",
  "preop_donor_right",
] as const;

function donor(
  index: number,
  slug: string,
  title: string,
  args: Omit<DemoQaScenario, "id" | "pathway" | "index" | "slug" | "title">
): DemoQaScenario {
  return {
    id: `donor_${String(index).padStart(2, "0")}_${slug}`,
    pathway: "post_surgery",
    index,
    slug,
    title,
    ...args,
  };
}

export const DEMO_QA_DONOR_HEALING_SCENARIOS: readonly DemoQaScenario[] = [
  donor(1, "orientation_confirmed", "Donor orientation confirmed", {
    intakeAnswers: { ...DONOR_INTAKE_BASE },
    forensic: {
      overallScore: 74,
      sectionScores: {
        donor_management: 72,
        extraction_pattern: 70,
        density_distribution: 68,
        recipient_area: 76,
      },
      summary:
        "Donor healing orientation confirmed for structured photographic review at the reported stage.",
      keyFindings: [
        {
          title: "Donor appearance broadly compatible with the reported healing stage",
          severity: "low",
        },
      ],
      photoObservations: [
        { category: "donor_rear", observation: "Rear donor view suitable for structured review." },
      ],
    },
    expectedPostOutcome: "strong_outcome",
    extraRecommendedUploadKeys: [...FULL_DONOR_KEYS],
    donorFixture: {
      kind: "orientation_confirmed",
      donorUploadKeys: FULL_DONOR_KEYS,
    },
  }),
  donor(2, "orientation_corrected", "Donor orientation corrected", {
    intakeAnswers: {
      ...DONOR_INTAKE_BASE,
      donor_appearance_trend: "stable",
    },
    forensic: {
      overallScore: 66,
      sectionScores: {
        donor_management: 60,
        extraction_pattern: 62,
        density_distribution: 58,
        recipient_area: 70,
      },
      summary:
        "Clinician-corrected donor orientation for persistent irregularity discussion support.",
      keyFindings: [
        {
          title: "Persistent donor irregularity deserves structured clinical discussion",
          severity: "medium",
        },
      ],
    },
    expectedPostOutcome: "moderate_concerns",
    extraRecommendedUploadKeys: [...FULL_DONOR_KEYS],
    donorFixture: {
      kind: "orientation_corrected",
      correctedState: "persistent_irregularity_deserves_review",
      donorUploadKeys: FULL_DONOR_KEYS,
    },
  }),
  donor(3, "missing_orientation_fallback", "Missing orientation fallback", {
    intakeAnswers: { ...DONOR_INTAKE_BASE },
    forensic: {
      overallScore: 70,
      sectionScores: {
        donor_management: 68,
        extraction_pattern: 66,
        density_distribution: 64,
        recipient_area: 72,
      },
      summary:
        "Donor-healing entry without a stored orientation record — patient shell uses fallback adapter.",
      keyFindings: [
        { title: "Donor healing entry present; orientation record intentionally omitted", severity: "low" },
      ],
    },
    expectedPostOutcome: "strong_outcome",
    extraRecommendedUploadKeys: [...FULL_DONOR_KEYS],
    donorFixture: {
      kind: "missing_orientation_fallback",
      omitOrientationRecord: true,
      donorUploadKeys: FULL_DONOR_KEYS,
    },
  }),
  donor(4, "partial_donor_evidence", "Partial donor evidence", {
    intakeAnswers: { ...DONOR_INTAKE_BASE },
    forensic: {
      overallScore: 62,
      sectionScores: {
        donor_management: 55,
        extraction_pattern: 58,
        density_distribution: 54,
        recipient_area: 68,
      },
      summary: "Single-angle donor evidence limits stage-aware orientation certainty.",
      keyFindings: [
        {
          title: "Available photographs are insufficient for reliable multi-angle donor orientation",
          severity: "medium",
        },
      ],
    },
    expectedPostOutcome: "moderate_concerns",
    extraRecommendedUploadKeys: ["preop_donor_rear"],
    donorFixture: {
      kind: "partial_donor_evidence",
      donorUploadKeys: ["preop_donor_rear"],
    },
  }),
  donor(5, "direct_clinical_assessment", "Direct clinical assessment warning", {
    intakeAnswers: {
      ...DONOR_INTAKE_BASE,
      donor_red_flag_symptoms: ["fever", "discharge"],
      donor_appearance_trend: "worsening",
    },
    forensic: {
      overallScore: 48,
      sectionScores: {
        donor_management: 42,
        extraction_pattern: 45,
        density_distribution: 44,
        recipient_area: 55,
      },
      summary: "Reported symptoms require direct clinical assessment rather than photo-only reassurance.",
      keyFindings: [
        {
          title: "Direct clinical assessment is recommended based on reported symptoms",
          severity: "high",
        },
      ],
      redFlags: [{ flag: "Reported symptoms better assessed in person", severity: "high" }],
    },
    expectedPostOutcome: "moderate_concerns",
    extraRecommendedUploadKeys: [...FULL_DONOR_KEYS],
    donorFixture: {
      kind: "direct_clinical_assessment",
      donorUploadKeys: FULL_DONOR_KEYS,
    },
  }),
];

export function isDemoQaDonorFixture(scenario: DemoQaScenario): boolean {
  return Boolean(scenario.donorFixture);
}
