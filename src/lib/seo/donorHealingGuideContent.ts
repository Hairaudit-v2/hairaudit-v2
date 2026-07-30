/**
 * HA-DONOR-HEALING-1A — structured content for the donor healing guide experience.
 * Patient-safe language only; no diagnostic guarantees.
 */

export type DonorHealingTimelineStage = {
  id: string;
  label: string;
  rangeLabel: string;
  commonlyNotice: string[];
  cannotYetJudge: string[];
  mayDeserveFollowUp: string[];
  seekDirectClinicalCare: string[];
};

export type DonorHealingComparisonCard = {
  id: string;
  domain: string;
  oftenCompatible: string;
  deservesReview: string;
  seekClinicalAdvice: string;
};

export type DonorHealingStageRoute = {
  id: "early" | "later";
  label: string;
  anchorId: string;
  description: string;
  stageGroup: "under_3_months" | "3_months_or_more";
};

export const DONOR_HEALING_OPENING_HOOK =
  "Does your FUE donor area look red, patchy, dotted, or thinner than expected?";

export const DONOR_HEALING_OPENING_SUPPORT =
  "The donor area can look very different during healing. Timing, hair length, lighting, temporary shedding, and extraction distribution all affect what can reasonably be concluded from photographs.";

export const DONOR_HEALING_REASSURANCE = DONOR_HEALING_OPENING_SUPPORT;

export const DONOR_HEALING_CTA_SUPPORTING =
  "Upload clear donor photographs and your procedure date for an independent, stage-aware review of what the available evidence can support.";

export const DONOR_HEALING_CAPABILITY = {
  canHelp: [
    "Visible healing patterns",
    "Donor-area uniformity",
    "Persistent patchiness",
    "Whether temporary shedding may be contributing",
    "Whether photographs are comparable",
    "Whether the evidence is sufficient",
    "Whether closer clinical assessment is sensible",
  ],
  cannotConfirm: [
    "Infection",
    "Exact donor density",
    "Remaining safe graft capacity",
    "Permanent follicle loss",
    "Definitive overharvesting in every case",
    "Treatment requirements",
  ],
} as const;

export const DONOR_HEALING_STAGE_ROUTES: readonly DonorHealingStageRoute[] = [
  {
    id: "early",
    label: "My surgery was less than 3 months ago",
    anchorId: "donor-healing-early",
    stageGroup: "under_3_months",
    description:
      "Early donor change is often about healing, crusting, and temporary shedding—not a final long-term read.",
  },
  {
    id: "later",
    label: "My surgery was 3 months ago or longer",
    anchorId: "donor-healing-later",
    stageGroup: "3_months_or_more",
    description:
      "Later photographs can support a clearer conversation about uniformity, patchiness, and what may deserve structured review.",
  },
];

export const DONOR_HEALING_TIMELINE: readonly DonorHealingTimelineStage[] = [
  {
    id: "days_1_3",
    label: "Days 1–3",
    rangeLabel: "Immediate healing",
    commonlyNotice: [
      "Redness, swelling, and small crusts at extraction sites may appear",
      "A dotted or speckled look can feel more visible with short hair",
      "Mild tenderness that often eases day by day when care instructions are followed",
    ],
    cannotYetJudge: [
      "Long-term donor uniformity",
      "Whether temporary shedding will settle",
      "Future donor reserve from photographs alone",
    ],
    mayDeserveFollowUp: [
      "Pain that is increasing rather than settling",
      "Marked asymmetry that worries you and your clinic",
    ],
    seekDirectClinicalCare: [
      "Fever, spreading redness, discharge, or persistent bleeding",
      "Rapidly worsening swelling with systemic symptoms",
    ],
  },
  {
    id: "days_4_7",
    label: "Days 4–7",
    rangeLabel: "Early crusting phase",
    commonlyNotice: [
      "Crusts may loosen or shed",
      "Pink or mottled scalp visibility under short hair",
      "Itching as surfaces settle",
    ],
    cannotYetJudge: [
      "Whether patchiness will remain after hair lengthens",
      "Overharvesting claims from a single angle or lighting condition",
    ],
    mayDeserveFollowUp: [
      "Worsening local irritation that is not settling",
      "New areas of intense pain",
    ],
    seekDirectClinicalCare: [
      "Discharge, odour, spreading redness, or fever",
      "Persistent bleeding",
    ],
  },
  {
    id: "days_8_14",
    label: "Days 8–14",
    rangeLabel: "Surface settling",
    commonlyNotice: [
      "Most surface crusting may have cleared",
      "Donor can still look thinner while hair is short",
      "Lighting and camera distance can exaggerate contrast",
    ],
    cannotYetJudge: [
      "Stable long-term density pattern",
      "Safe remaining graft capacity",
    ],
    mayDeserveFollowUp: [
      "Persistent open areas or delayed surface healing",
      "Marked asymmetry that still concerns you",
    ],
    seekDirectClinicalCare: [
      "Spreading inflammation, fever, or discharge",
      "Increasing pain rather than settling discomfort",
    ],
  },
  {
    id: "weeks_3_8",
    label: "Weeks 3–8",
    rangeLabel: "Shock-shedding window",
    commonlyNotice: [
      "Temporary donor or surrounding shedding can appear",
      "Uneven regrowth timing between neighbouring follicles",
      "Photos taken weeks apart may look different without a lasting problem",
    ],
    cannotYetJudge: [
      "Final cosmetic donor read",
      "Whether irregularity is temporary shedding versus a stable pattern",
    ],
    mayDeserveFollowUp: [
      "Clinic-recommended review if healing feels off-track",
      "Persistent local irritation beyond what your clinic expected",
    ],
    seekDirectClinicalCare: [
      "Rapidly worsening thinning with pain or inflammation",
      "Fever, discharge, or spreading redness",
    ],
  },
  {
    id: "months_3_4",
    label: "Months 3–4",
    rangeLabel: "Early pattern window",
    commonlyNotice: [
      "Hair length often makes donor appearance easier to interpret",
      "Some temporary thinning may still be resolving",
      "Neutral lighting and dry hair give a fairer comparison",
    ],
    cannotYetJudge: [
      "Final 12-month uniformity from one photograph",
      "Definitive overharvesting claims without multi-view evidence",
    ],
    mayDeserveFollowUp: [
      "Stable concentrated patchiness under consistent dated photos",
      "Ongoing pain, redness, or irritation beyond expected recovery",
    ],
    seekDirectClinicalCare: [
      "New inflammatory change, discharge, or fever at this stage",
      "Increasing pain or spreading redness",
    ],
  },
  {
    id: "months_6_12",
    label: "Months 6–12",
    rangeLabel: "Later settling window",
    commonlyNotice: [
      "Donor pattern is usually clearer than in the first weeks",
      "Homogeneity and concentrated thin zones can be compared across views",
      "Pre-surgery or surgery-day donor photos (if available) add useful context",
    ],
    cannotYetJudge: [
      "Exact remaining graft capacity from consumer photographs",
      "Infection or medication needs from photos alone",
    ],
    mayDeserveFollowUp: [
      "Persistent irregularity that still concerns you after healing has settled",
      "Planning a second procedure where donor reserve needs clinical assessment",
    ],
    seekDirectClinicalCare: [
      "Acute inflammatory symptoms at any late stage",
      "Persistent bleeding, discharge, or systemic illness",
    ],
  },
];

export const DONOR_HEALING_COMPARISON_CARDS: readonly DonorHealingComparisonCard[] = [
  {
    id: "redness",
    domain: "Redness and surface healing",
    oftenCompatible:
      "Temporary redness or crusting that may be compatible with the reported healing stage.",
    deservesReview:
      "Redness or irregular healing that persists longer than expected for your stage.",
    seekClinicalAdvice:
      "Spreading redness, heat, discharge, fever, or increasing pain.",
  },
  {
    id: "patchiness",
    domain: "Patchiness and scalp visibility",
    oftenCompatible:
      "Short hair and bright light that make the scalp look more visible than it feels day to day.",
    deservesReview:
      "Persistent concentrated patchiness that remains under neutral light and consistent distance.",
    seekClinicalAdvice:
      "Open wounds, expanding bald patches with pain, or sudden inflammatory change.",
  },
  {
    id: "shedding",
    domain: "Shedding versus lasting irregularity",
    oftenCompatible:
      "Possible temporary donor shedding that may improve across several months.",
    deservesReview:
      "Stable late donor irregularity once early healing and shedding windows have passed.",
    seekClinicalAdvice:
      "Rapid loss with systemic symptoms that need in-person assessment.",
  },
  {
    id: "evidence",
    domain: "Single image versus dated evidence",
    oftenCompatible:
      "Uncertainty from one photograph taken at an early stage or poor angle—not enough evidence yet.",
    deservesReview:
      "Repeat dated rear and side views that still show the same concerning pattern.",
    seekClinicalAdvice:
      "Any acute symptom set that needs in-person assessment regardless of photos.",
  },
  {
    id: "tenderness",
    domain: "Tenderness versus warning symptoms",
    oftenCompatible:
      "Mild tenderness that settles with the reported healing stage.",
    deservesReview:
      "Discomfort that is stable but still concerning enough to document with dated photos and clinic follow-up.",
    seekClinicalAdvice:
      "Increasing pain, fever, spreading redness, persistent bleeding, discharge, or rapidly worsening swelling.",
  },
];

export const DONOR_HEALING_PHOTO_PREP = {
  heading: "Donor photographs that support a fairer review",
  intro:
    "Minimum useful donor evidence usually includes rear, left, and right views. Recipient views may still be required for a complete Post-Surgery Audit readiness check—the first donor photographs document your immediate concern. Optional close-ups and earlier donor images can add context.",
  requiredViews: [
    {
      id: "rear",
      title: "Rear donor view",
      detail: "Full back of the head showing the extraction zone clearly.",
    },
    {
      id: "left",
      title: "Left donor view",
      detail: "Left transition into the donor zone for side-to-side balance.",
    },
    {
      id: "right",
      title: "Right donor view",
      detail: "Right transition into the donor zone for side-to-side balance.",
    },
  ],
  optionalViews: [
    {
      id: "closeup",
      title: "Optional close-up",
      detail: "A nearer photograph of a specific area you are worried about.",
    },
    {
      id: "preop",
      title: "Optional pre-surgery donor",
      detail: "A donor photograph taken before your procedure, if you still have one.",
    },
    {
      id: "surgery_day",
      title: "Optional surgery-day donor",
      detail: "A donor photograph from the procedure day, if available.",
    },
    {
      id: "earlier_healing",
      title: "Optional earlier dated healing image",
      detail: "A prior healing photograph with a known date for comparison.",
    },
    {
      id: "graft_report",
      title: "Optional clinic graft report",
      detail: "Graft count paperwork or punch-size notes if your clinic provided them.",
    },
  ],
  techniqueTips: [
    "Use neutral indoor lighting when you can",
    "Photograph dry hair without fibres or concealer",
    "Keep a similar camera distance across dates",
    "Show the full donor zone in rear and side views",
    "Avoid heavy filters and harsh overhead shadow where possible",
  ],
} as const;
