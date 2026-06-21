import {
  PATHWAY_EVIDENCE_PACKS,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import type { DemoQaScenario } from "./types";

function pre(
  index: number,
  slug: string,
  title: string,
  args: Omit<DemoQaScenario, "id" | "pathway" | "index" | "slug" | "title">
): DemoQaScenario {
  return {
    id: `pre_${String(index).padStart(2, "0")}_${slug}`,
    pathway: "pre_surgery",
    index,
    slug,
    title,
    ...args,
  };
}

function post(
  index: number,
  slug: string,
  title: string,
  args: Omit<DemoQaScenario, "id" | "pathway" | "index" | "slug" | "title">
): DemoQaScenario {
  return {
    id: `post_${String(index).padStart(2, "0")}_${slug}`,
    pathway: "post_surgery",
    index,
    slug,
    title,
    ...args,
  };
}

const PRE_INTAKE_BASE = {
  clinic_country: "uk",
  procedure_type: "fue",
} as const;

const POST_INTAKE_BASE = {
  clinic_name: "Demo QA Clinic London",
  clinic_country: "uk",
  clinic_city: "London",
  procedure_date: "2024-08-12",
  procedure_type: "fue",
  preop_consult: "yes",
  graft_number_disclosed: "yes",
  graft_number_received: 2800,
  months_since: "6_9",
  density_satisfaction: 3,
  hairline_naturalness: 3,
  donor_appearance: 3,
} as const;

export const DEMO_QA_PRE_SURGERY_SCENARIOS: readonly DemoQaScenario[] = [
  pre(1, "strong_surgical_candidate", "Strong surgical candidate", {
    intakeAnswers: { ...PRE_INTAKE_BASE },
    forensic: {
      overallScore: 82,
      sectionScores: { donor_management: 84, hairline_design: 80, naturalness_and_aesthetics: 81 },
      summary:
        "Visible pattern suggests a strong surgical candidate with adequate donor reserve and conservative planning priorities.",
      keyFindings: [
        { title: "Stable frontal recession with donor region appearing adequate for planning", severity: "low" },
        { title: "Hairline design should remain conservative given long-term progression", severity: "low" },
      ],
      photoObservations: [
        { category: "front", observation: "Frontal recession appears suitable for conservative restoration planning." },
        { category: "donor_rear", observation: "Donor density appears adequate based on visible image evidence." },
      ],
    },
    intelligencePatch: {
      norwoodStage: "III",
      crownProgression: "early",
      donorDensityBand: "appears_adequate",
      donorReserveRisk: "low",
      overallConfidence: "moderate",
    },
    expectedPreOutcome: "strong_surgical_candidate",
    extraRecommendedUploadKeys: ["preop_hairline_closeup"],
  }),
  pre(2, "donor_limitations", "Donor limitations", {
    intakeAnswers: { ...PRE_INTAKE_BASE, procedure_type: "fut" },
    forensic: {
      overallScore: 58,
      sectionScores: { donor_management: 48, hairline_design: 62, naturalness_and_aesthetics: 60 },
      summary: "Donor reserve appears limited; conservative graft planning and long-term preservation are essential.",
      keyFindings: [
        { title: "Donor region appears limited with visible thinning in the safe extraction zone", severity: "high" },
        { title: "Restoration goals may need to be narrowed to preserve future donor reserve", severity: "medium" },
      ],
      photoObservations: [
        { category: "donor_rear", observation: "Donor region shows signs of limited density for extensive planning." },
      ],
    },
    intelligencePatch: {
      norwoodStage: "IV",
      donorDensityBand: "appears_limited",
      donorReserveRisk: "elevated",
      overallConfidence: "moderate",
    },
    expectedPreOutcome: "donor_limitations_identified",
    extraRecommendedUploadKeys: ["preop_donor_closeup"],
  }),
  pre(3, "medical_stabilisation_first", "Medical stabilisation first", {
    intakeAnswers: { ...PRE_INTAKE_BASE },
    forensic: {
      overallScore: 64,
      sectionScores: { donor_management: 70, hairline_design: 62, naturalness_and_aesthetics: 60 },
      summary: "Early pattern changes suggest medical stabilisation should be discussed before surgical planning.",
      keyFindings: [
        { title: "Diffuse thinning pattern may benefit from medical stabilisation before surgery", severity: "medium" },
        { title: "Young patient with early recession — progression risk should be reviewed", severity: "medium" },
      ],
    },
    intelligencePatch: {
      norwoodStage: "II",
      diffuseThinningPattern: "likely",
      miniaturisationSuspicion: "elevated_suspicion",
      overallConfidence: "moderate",
    },
    expectedPreOutcome: "medical_stabilisation_recommended_first",
    extraRecommendedUploadKeys: ["preop_wet_top"],
  }),
  pre(4, "diffuse_thinning", "Diffuse thinning", {
    intakeAnswers: { ...PRE_INTAKE_BASE },
    forensic: {
      overallScore: 66,
      sectionScores: { donor_management: 68, hairline_design: 64, naturalness_and_aesthetics: 65 },
      summary: "Diffuse thinning across the mid-scalp should be distinguished from patterned recession before planning.",
      keyFindings: [
        { title: "Diffuse thinning visible across mid-scalp rather than isolated recession", severity: "medium" },
        { title: "Medical review may help clarify stabilisation before graft planning", severity: "low" },
      ],
      photoObservations: [{ category: "top", observation: "Diffuse thinning pattern visible across the mid-scalp." }],
    },
    intelligencePatch: { diffuseThinningPattern: "likely", norwoodStage: "III", overallConfidence: "moderate" },
    extraRecommendedUploadKeys: ["preop_wet_top", "preop_hairline_closeup"],
  }),
  pre(5, "crown_focused", "Crown-focused case", {
    intakeAnswers: { ...PRE_INTAKE_BASE },
    forensic: {
      overallScore: 70,
      sectionScores: { donor_management: 72, hairline_design: 68, naturalness_and_aesthetics: 70 },
      summary: "Crown involvement is the primary planning focus with frontal hairline changes appearing secondary.",
      keyFindings: [
        { title: "Crown thinning appears moderate and is the dominant planning priority", severity: "medium" },
        { title: "Frontal hairline recession appears mild relative to crown involvement", severity: "low" },
      ],
      photoObservations: [{ category: "top", observation: "Crown involvement appears moderate based on visible evidence." }],
    },
    intelligencePatch: { norwoodStage: "III_vertex", crownProgression: "moderate", overallConfidence: "moderate" },
    extraRecommendedUploadKeys: ["preop_wet_top"],
  }),
  pre(6, "conservative_hairline_planning", "Conservative hairline planning", {
    intakeAnswers: { ...PRE_INTAKE_BASE },
    forensic: {
      overallScore: 74,
      sectionScores: { donor_management: 76, hairline_design: 70, naturalness_and_aesthetics: 75 },
      summary: "Conservative hairline design is recommended to preserve natural progression and donor reserve.",
      keyFindings: [
        { title: "Hairline lowering should remain conservative to avoid future unnatural appearance", severity: "medium" },
        { title: "Temple points should be planned with long-term recession in mind", severity: "low" },
      ],
      photoObservations: [
        { category: "front", observation: "Frontal hairline recession suitable for conservative restoration design." },
      ],
    },
    intelligencePatch: { norwoodStage: "III", crownProgression: "early", overallConfidence: "moderate" },
    extraRecommendedUploadKeys: ["preop_hairline_closeup"],
  }),
  pre(7, "young_patient_caution", "Young patient caution", {
    intakeAnswers: { ...PRE_INTAKE_BASE },
    forensic: {
      overallScore: 62,
      sectionScores: { donor_management: 68, hairline_design: 58, naturalness_and_aesthetics: 60 },
      summary: "Early recession in a young patient warrants caution and long-term progression planning before surgery.",
      keyFindings: [
        { title: "Early recession in a young patient — surgical timing requires careful discussion", severity: "medium" },
        { title: "Aggressive hairline design is not recommended at this stage", severity: "medium" },
      ],
    },
    intelligencePatch: {
      norwoodStage: "II",
      diffuseThinningPattern: "possible",
      miniaturisationSuspicion: "elevated_suspicion",
      overallConfidence: "moderate",
    },
    expectedPreOutcome: "medical_stabilisation_recommended_first",
    extraRecommendedUploadKeys: ["preop_family_pattern"],
  }),
  pre(8, "high_graft_requirement", "High graft requirement", {
    intakeAnswers: { ...PRE_INTAKE_BASE },
    forensic: {
      overallScore: 68,
      sectionScores: { donor_management: 66, hairline_design: 68, naturalness_and_aesthetics: 69 },
      summary: "Advanced pattern suggests a higher preliminary graft requirement with staged planning likely.",
      keyFindings: [
        { title: "Advanced recession pattern may require a higher graft count than early cases", severity: "medium" },
        { title: "Staged sessions may be preferable to preserve donor reserve", severity: "medium" },
      ],
      photoObservations: [
        { category: "front", observation: "Advanced frontal and mid-scalp involvement visible." },
        { category: "top", observation: "Crown involvement contributes to higher graft planning estimates." },
      ],
    },
    intelligencePatch: { norwoodStage: "V", crownProgression: "moderate", overallConfidence: "moderate" },
    extraRecommendedUploadKeys: ["preop_donor_closeup"],
  }),
  pre(9, "low_progression_risk", "Low progression risk", {
    intakeAnswers: { ...PRE_INTAKE_BASE },
    forensic: {
      overallScore: 78,
      sectionScores: { donor_management: 80, hairline_design: 76, naturalness_and_aesthetics: 78 },
      summary: "Pattern appears relatively stable with low progression risk based on visible evidence.",
      keyFindings: [
        { title: "Hair loss pattern appears relatively stable with limited crown progression", severity: "low" },
        { title: "Donor region appears suitable for planning with standard monitoring", severity: "low" },
      ],
    },
    intelligencePatch: {
      norwoodStage: "II",
      crownProgression: "none_observed",
      donorDensityBand: "appears_adequate",
      overallConfidence: "moderate",
    },
    extraRecommendedUploadKeys: ["preop_hairline_closeup"],
  }),
  pre(10, "further_professional_review", "Further professional review", {
    intakeAnswers: { ...PRE_INTAKE_BASE, clinic_country: "other", clinic_country_other: "Portugal" },
    forensic: {
      overallScore: 55,
      sectionScores: { donor_management: 50, hairline_design: 52, naturalness_and_aesthetics: 54 },
      summary: "Image quality and coverage limit assessment — further professional review is recommended.",
      keyFindings: [
        { title: "Insufficient image clarity to confirm donor density with confidence", severity: "medium" },
        { title: "In-person assessment recommended before committing to a surgical plan", severity: "medium" },
      ],
    },
    intelligencePatch: { norwoodStage: "not_assessable", overallConfidence: "very_low" },
    expectedPreOutcome: "further_professional_review_recommended",
    extraRecommendedUploadKeys: ["preop_donor_closeup"],
  }),
];

export const DEMO_QA_POST_SURGERY_SCENARIOS: readonly DemoQaScenario[] = [
  post(1, "strong_outcome", "Strong outcome", {
    intakeAnswers: {
      ...POST_INTAKE_BASE,
      density_satisfaction: 5,
      hairline_naturalness: 5,
      donor_appearance: 5,
      would_repeat: "yes",
      would_recommend: "yes",
    },
    forensic: {
      overallScore: 86,
      sectionScores: {
        donor_management: 84,
        extraction_quality: 88,
        density_distribution: 87,
        recipient_placement: 85,
        hairline_design: 86,
        post_op_course_and_aftercare: 90,
      },
      summary: "Independent review indicates a strong procedural outcome with well-preserved donor characteristics.",
      keyFindings: [
        { title: "Recipient density distribution appears consistent with stated graft count", severity: "low" },
        { title: "Donor region shows acceptable preservation for future reserve", severity: "low" },
      ],
    },
    intelligencePatch: { donorReserveRisk: "low", overharvestingIndicators: "none_suggested", overallConfidence: "moderate" },
    expectedPostOutcome: "strong_outcome",
    extraRecommendedUploadKeys: ["postop_wet_recipient"],
  }),
  post(2, "moderate_donor_concerns", "Moderate donor concerns", {
    intakeAnswers: { ...POST_INTAKE_BASE, donor_appearance: 2, density_satisfaction: 3 },
    forensic: {
      overallScore: 68,
      sectionScores: {
        donor_management: 58,
        extraction_quality: 70,
        density_distribution: 72,
        recipient_placement: 74,
        post_op_course_and_aftercare: 75,
      },
      summary: "Generally acceptable recipient results with moderate donor preservation concerns requiring monitoring.",
      keyFindings: [
        { title: "Donor region shows moderate extraction irregularity in the left temporal zone", severity: "medium" },
        { title: "Recipient density appears generally consistent overall", severity: "low" },
      ],
    },
    intelligencePatch: { donorReserveRisk: "moderate", overharvestingIndicators: "possible" },
    expectedPostOutcome: "moderate_concerns",
    extraRecommendedUploadKeys: ["day0_donor"],
  }),
  post(3, "density_inconsistency", "Density inconsistency", {
    intakeAnswers: { ...POST_INTAKE_BASE, density_satisfaction: 2 },
    forensic: {
      overallScore: 64,
      sectionScores: {
        donor_management: 70,
        extraction_quality: 72,
        density_distribution: 52,
        recipient_placement: 60,
        hairline_design: 65,
      },
      summary: "Recipient density appears uneven in some zones relative to surrounding areas.",
      keyFindings: [
        { title: "Density inconsistency visible in the mid-scalp relative to the hairline zone", severity: "medium" },
        { title: "Further close-up review may help clarify whether this reflects growth phase variation", severity: "low" },
      ],
    },
    expectedPostOutcome: "moderate_concerns",
    extraRecommendedUploadKeys: ["postop_wet_recipient"],
  }),
  post(4, "recipient_asymmetry", "Recipient asymmetry", {
    intakeAnswers: { ...POST_INTAKE_BASE, hairline_naturalness: 2 },
    forensic: {
      overallScore: 62,
      sectionScores: {
        donor_management: 72,
        extraction_quality: 70,
        density_distribution: 68,
        recipient_placement: 54,
        hairline_design: 58,
      },
      summary: "Recipient placement shows asymmetry that may benefit from specialist review.",
      keyFindings: [
        { title: "Recipient asymmetry noted between left and right frontal zones", severity: "medium" },
        { title: "Hairline contour appears uneven on close review", severity: "medium" },
      ],
    },
    expectedPostOutcome: "moderate_concerns",
    extraRecommendedUploadKeys: ["current_recipient_closeup"],
  }),
  post(5, "healing_concern", "Healing concern", {
    intakeAnswers: {
      ...POST_INTAKE_BASE,
      months_since: "under_3",
      post_op_swelling: "moderate",
      complications: "yes",
      complications_details: "Prolonged redness in recipient zone",
    },
    forensic: {
      overallScore: 60,
      sectionScores: {
        donor_management: 68,
        extraction_quality: 65,
        density_distribution: 62,
        post_op_course_and_aftercare: 48,
      },
      summary: "Healing course appears slower than typical with post-operative concerns noted.",
      keyFindings: [
        { title: "Healing concern with prolonged redness in the recipient zone", severity: "medium" },
        { title: "Early-stage result — density assessment remains preliminary", severity: "low" },
      ],
    },
    expectedPostOutcome: "moderate_concerns",
    extraRecommendedUploadKeys: ["day0_recipient"],
  }),
  post(6, "possible_overharvesting", "Possible overharvesting", {
    intakeAnswers: { ...POST_INTAKE_BASE, donor_appearance: 1, graft_number_received: 4500 },
    forensic: {
      overallScore: 52,
      sectionScores: {
        donor_management: 42,
        extraction_quality: 50,
        density_distribution: 65,
        recipient_placement: 68,
      },
      summary: "Donor region shows signs consistent with possible overharvesting that warrants careful review.",
      keyFindings: [
        { title: "Possible overharvesting pattern visible in the donor region", severity: "high" },
        { title: "Future donor reserve may be compromised if extraction density was excessive", severity: "high" },
      ],
      redFlags: [{ flag: "Possible overharvesting indicators in donor region", severity: "high" }],
    },
    intelligencePatch: { overharvestingIndicators: "likely", donorReserveRisk: "elevated" },
    expectedPostOutcome: "donor_preservation_concerns",
    extraRecommendedUploadKeys: ["day0_donor", "preop_donor_closeup"],
  }),
  post(7, "repair_likely", "Repair likely", {
    intakeAnswers: { ...POST_INTAKE_BASE, density_satisfaction: 1, would_repeat: "no" },
    forensic: {
      overallScore: 45,
      sectionScores: {
        donor_management: 40,
        extraction_quality: 45,
        density_distribution: 42,
        recipient_placement: 48,
        hairline_design: 44,
      },
      summary: "Significant procedural concerns suggest repair planning may be worth discussing with a specialist.",
      keyFindings: [
        { title: "Significant density and placement concerns visible in the recipient area", severity: "high" },
        { title: "Repair consultation may be appropriate given combined donor and recipient findings", severity: "high" },
      ],
      redFlags: [{ flag: "Significant procedural integrity concerns identified", severity: "high" }],
    },
    intelligencePatch: { repairComplexityBand: "high", overharvestingIndicators: "likely" },
    expectedPostOutcome: "donor_preservation_concerns",
    extraRecommendedUploadKeys: ["postop_month3_front"],
  }),
  post(8, "low_concern_reassurance", "Low concern reassurance", {
    intakeAnswers: {
      ...POST_INTAKE_BASE,
      density_satisfaction: 4,
      hairline_naturalness: 4,
      donor_appearance: 4,
      would_repeat: "yes",
    },
    forensic: {
      overallScore: 82,
      sectionScores: {
        donor_management: 80,
        extraction_quality: 84,
        density_distribution: 82,
        recipient_placement: 81,
        post_op_course_and_aftercare: 85,
      },
      summary: "Review indicates generally reassuring findings with minor observations only.",
      keyFindings: [
        { title: "Recipient and donor findings appear generally reassuring on available evidence", severity: "low" },
        { title: "Minor variation in density may reflect normal growth phase differences", severity: "low" },
      ],
    },
    extraRecommendedUploadKeys: ["postop_wet_recipient"],
  }),
  post(9, "graft_count_mismatch", "Graft count mismatch concern", {
    intakeAnswers: { ...POST_INTAKE_BASE, graft_number_received: 4000, density_satisfaction: 2 },
    forensic: {
      overallScore: 58,
      sectionScores: {
        donor_management: 62,
        extraction_quality: 60,
        density_distribution: 50,
        recipient_placement: 55,
      },
      summary: "Visible density appears lower than expected relative to the stated graft count.",
      keyFindings: [
        { title: "Visible density appears lower than expected relative to stated graft count of 4000", severity: "medium" },
        { title: "Graft count verification with clinic records may be useful", severity: "medium" },
      ],
    },
    extraRecommendedUploadKeys: ["graft_count_board"],
  }),
  post(10, "long_term_donor_preservation", "Long-term donor preservation concern", {
    intakeAnswers: { ...POST_INTAKE_BASE, donor_appearance: 2, graft_number_received: 4200 },
    forensic: {
      overallScore: 56,
      sectionScores: {
        donor_management: 48,
        extraction_quality: 55,
        density_distribution: 64,
        recipient_placement: 66,
      },
      summary: "Long-term donor preservation should be prioritised given visible reserve concerns.",
      keyFindings: [
        { title: "Long-term donor preservation concern given visible reserve thinning", severity: "medium" },
        { title: "Future procedures may be limited if donor reserve was heavily utilised", severity: "medium" },
      ],
    },
    intelligencePatch: { donorReserveRisk: "elevated", overharvestingIndicators: "possible" },
    expectedPostOutcome: "donor_preservation_concerns",
    extraRecommendedUploadKeys: ["day0_donor"],
  }),
];

export const DEMO_QA_ALL_SCENARIOS: readonly DemoQaScenario[] = [
  ...DEMO_QA_PRE_SURGERY_SCENARIOS,
  ...DEMO_QA_POST_SURGERY_SCENARIOS,
];

export function getDemoQaRequiredUploadKeys(pathway: PatientReviewPathway): readonly string[] {
  return PATHWAY_EVIDENCE_PACKS[pathway].requiredPhotoKeys;
}

export function getDemoQaRecommendedUploadKeys(
  scenario: DemoQaScenario
): readonly string[] {
  const pack = PATHWAY_EVIDENCE_PACKS[scenario.pathway];
  const extras = scenario.extraRecommendedUploadKeys ?? [];
  const merged = [...pack.recommendedPhotoKeys.slice(0, 2), ...extras];
  return Array.from(new Set(merged)).slice(0, 3);
}
