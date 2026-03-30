export type PatientNarrativeDomainId =
  | "donor_management"
  | "recipient_site_design"
  | "graft_handling"
  | "implantation_technique"
  | "documentation_quality"
  | "hairline_transition"
  | "density_consistency"
  | "direction_angle_coherence";

export type PatientNarrativeState =
  | "strong_positive"
  | "moderate_positive"
  | "mixed"
  | "limited_evidence"
  | "concern_flagged";

export type PatientNarrativeBlock = {
  clinicalFinding: string;
  plainEnglishMeaning: string;
  patientImplication: string;
  confidenceExplanation: string;
  followUpAdvice: string;
};

type PatientNarrativeTemplates = Record<PatientNarrativeDomainId, Record<PatientNarrativeState, PatientNarrativeBlock>>;

export function getPatientNarrativeState(input: {
  score: number | null;
  evidenceCount: number;
  hasConcern: boolean;
  confidenceBand: "high" | "moderate" | "low" | "limited";
}): PatientNarrativeState {
  const { score, evidenceCount, hasConcern, confidenceBand } = input;
  if (hasConcern) return "concern_flagged";
  if (score == null || evidenceCount === 0 || confidenceBand === "limited") return "limited_evidence";
  if (score >= 80 && confidenceBand !== "low") return "strong_positive";
  if (score >= 65) return "moderate_positive";
  if (score < 50) return "concern_flagged";
  return "mixed";
}

export function patientConfidenceExplanation(confidenceBand: "high" | "moderate" | "low" | "limited"): string {
  if (confidenceBand === "high") {
    return "Positive evidence: image quality and coverage are strong enough for higher-confidence interpretation.";
  }
  if (confidenceBand === "moderate") {
    return "Mixed evidence: the pattern is visible, but some angles or timepoints are incomplete.";
  }
  if (confidenceBand === "low") {
    return "Limited evidence: interpretation is possible but uncertainty remains higher than ideal.";
  }
  return "Limited evidence: this section cannot be interpreted reliably yet. Limited evidence is not the same as a poor result.";
}

const templates: PatientNarrativeTemplates = {
  donor_management: {
    strong_positive: {
      clinicalFinding: "Donor extraction pattern appears spatially balanced with no dominant overharvest signature.",
      plainEnglishMeaning: "The donor area looks evenly used rather than patchy.",
      patientImplication: "This supports lower risk of visible donor thinning as your hair grows out.",
      confidenceExplanation: "",
      followUpAdvice: "Re-check donor photos at 6 and 12 months in similar lighting to confirm long-term donor uniformity.",
    },
    moderate_positive: {
      clinicalFinding: "Donor pattern is broadly acceptable, with mild variability in extraction spacing.",
      plainEnglishMeaning: "Most donor zones look even, but a few areas look slightly less uniform.",
      patientImplication: "This may still settle well, but donor appearance should be monitored during maturation.",
      confidenceExplanation: "",
      followUpAdvice: "Take standardized donor photos every 8-12 weeks for the first 6 months.",
    },
    mixed: {
      clinicalFinding: "Donor preservation signals are mixed, with both uniform and variable extraction zones.",
      plainEnglishMeaning: "Some donor regions look balanced while others look less even.",
      patientImplication: "Your final donor appearance may vary by area, so trend monitoring matters more than single images.",
      confidenceExplanation: "",
      followUpAdvice: "Track donor changes monthly and request a clinician review if patchiness appears to increase.",
    },
    limited_evidence: {
      clinicalFinding: "Donor preservation cannot be judged confidently due to limited donor-angle documentation.",
      plainEnglishMeaning: "There are not enough clear donor images to draw a reliable conclusion.",
      patientImplication: "This does not mean a poor donor outcome; it means the current evidence is incomplete.",
      confidenceExplanation: "",
      followUpAdvice: "Upload left, right, and central donor views at 1-3 month intervals.",
    },
    concern_flagged: {
      clinicalFinding: "Donor pattern shows features that may indicate uneven extraction density.",
      plainEnglishMeaning: "Some donor zones may be carrying more visible extraction load than expected.",
      patientImplication: "If this persists, donor visibility risk can be higher in short hairstyles.",
      confidenceExplanation: "",
      followUpAdvice: "Arrange a focused donor review within 4-8 weeks and continue interval photography.",
    },
  },
  recipient_site_design: {
    strong_positive: {
      clinicalFinding: "Recipient site planning appears anatomically coherent with balanced zone distribution.",
      plainEnglishMeaning: "The placement map looks proportionate across the treated area.",
      patientImplication: "This generally supports a natural-looking frame once growth matures.",
      confidenceExplanation: "",
      followUpAdvice: "Compare frontal and oblique photos at months 4, 6, and 9 to confirm balanced emergence.",
    },
    moderate_positive: {
      clinicalFinding: "Recipient design is acceptable with minor distribution variability across sub-zones.",
      plainEnglishMeaning: "The plan mostly looks balanced, with small areas that may fill differently.",
      patientImplication: "You may notice minor unevenness early, which often improves over time.",
      confidenceExplanation: "",
      followUpAdvice: "Monitor zone-to-zone fill every 2-3 months under consistent photo conditions.",
    },
    mixed: {
      clinicalFinding: "Recipient distribution findings are mixed and suggest variable site planning consistency.",
      plainEnglishMeaning: "Some regions look well planned, while others appear less consistent.",
      patientImplication: "Final visual harmony may depend on how these regions mature over the growth cycle.",
      confidenceExplanation: "",
      followUpAdvice: "Use monthly frontal/top photos and reassess with your team at month 6.",
    },
    limited_evidence: {
      clinicalFinding: "Recipient design interpretation is limited by incomplete region coverage.",
      plainEnglishMeaning: "Not enough clear images were available from all treated zones.",
      patientImplication: "Limited evidence should be read as uncertainty, not as a negative result.",
      confidenceExplanation: "",
      followUpAdvice: "Add full frontal, top-down, and both temple-transition views at your next update.",
    },
    concern_flagged: {
      clinicalFinding: "Recipient site pattern includes irregular distribution features requiring closer follow-up.",
      plainEnglishMeaning: "Some placement areas may look less even than expected.",
      patientImplication: "If unchanged over time, this can affect perceived balance and framing.",
      confidenceExplanation: "",
      followUpAdvice: "Book a targeted recipient review in 6-10 weeks with repeat standardized photos.",
    },
  },
  graft_handling: {
    strong_positive: {
      clinicalFinding: "Available intra-operative evidence suggests controlled graft handling conditions.",
      plainEnglishMeaning: "The graft process appears to have followed consistent handling cues.",
      patientImplication: "This is generally favorable for graft viability and predictable growth progression.",
      confidenceExplanation: "",
      followUpAdvice: "Continue routine follow-up imaging at months 3, 6, and 12.",
    },
    moderate_positive: {
      clinicalFinding: "Graft handling signals are generally reassuring, with minor evidence gaps.",
      plainEnglishMeaning: "Most signs are positive, but not every handling step is clearly documented.",
      patientImplication: "Expected growth can still be good, but certainty is slightly reduced.",
      confidenceExplanation: "",
      followUpAdvice: "Maintain timeline photos and request operative detail clarification at the next review.",
    },
    mixed: {
      clinicalFinding: "Graft handling evidence is mixed, with both favorable and uncertain intra-operative cues.",
      plainEnglishMeaning: "Some signs look supportive, while other details are unclear.",
      patientImplication: "Growth outcomes may still be good, but trend-based follow-up is important.",
      confidenceExplanation: "",
      followUpAdvice: "Review progress at 4-6 month intervals and compare against baseline density zones.",
    },
    limited_evidence: {
      clinicalFinding: "Graft handling cannot be interpreted robustly due to minimal intra-operative documentation.",
      plainEnglishMeaning: "There is not enough procedural evidence to judge graft handling quality confidently.",
      patientImplication: "This is an evidence gap, not proof of poor graft survival.",
      confidenceExplanation: "",
      followUpAdvice: "Where possible, add procedural records and continue structured growth monitoring.",
    },
    concern_flagged: {
      clinicalFinding: "Graft handling indicators include patterns that may merit caution in viability interpretation.",
      plainEnglishMeaning: "Some available signs raise concern about consistency of graft care.",
      patientImplication: "If follow-up growth lags, these factors may become clinically relevant.",
      confidenceExplanation: "",
      followUpAdvice: "Prioritize 3-, 6-, and 9-month density documentation and discuss concerns with your clinician.",
    },
  },
  implantation_technique: {
    strong_positive: {
      clinicalFinding: "Implantation spacing and placement coherence appear technically consistent.",
      plainEnglishMeaning: "Graft placement pattern looks orderly and controlled.",
      patientImplication: "This supports smoother blending and more predictable cosmetic density.",
      confidenceExplanation: "",
      followUpAdvice: "Continue scheduled follow-up photos at 3-month intervals during the first year.",
    },
    moderate_positive: {
      clinicalFinding: "Implantation technique appears mostly consistent with mild local variability.",
      plainEnglishMeaning: "Placement is generally good, with a few areas that may mature differently.",
      patientImplication: "Small visual differences can occur early and often settle during maturation.",
      confidenceExplanation: "",
      followUpAdvice: "Track regional density monthly and review any persistent asymmetry at month 6.",
    },
    mixed: {
      clinicalFinding: "Implantation evidence is mixed with variable spacing or placement regularity.",
      plainEnglishMeaning: "Some zones look consistent while others appear less uniform.",
      patientImplication: "Final texture and density balance may be less predictable without trend follow-up.",
      confidenceExplanation: "",
      followUpAdvice: "Capture same-angle photos every 6-8 weeks to assess progression accurately.",
    },
    limited_evidence: {
      clinicalFinding: "Implantation technique cannot be fully assessed from available visual data.",
      plainEnglishMeaning: "Current images do not clearly show enough placement detail.",
      patientImplication: "Unclear evidence should not be interpreted as treatment failure.",
      confidenceExplanation: "",
      followUpAdvice: "Submit higher-resolution close and mid-range images at your next follow-up.",
    },
    concern_flagged: {
      clinicalFinding: "Implantation pattern shows irregular features that warrant closer surveillance.",
      plainEnglishMeaning: "Some placement cues may not be as consistent as expected.",
      patientImplication: "If persistent, this can influence perceived density smoothness.",
      confidenceExplanation: "",
      followUpAdvice: "Arrange reassessment in 6-8 weeks and prioritize matched-angle comparison photos.",
    },
  },
  documentation_quality: {
    strong_positive: {
      clinicalFinding: "Documentation quality is comprehensive and supports robust interpretation.",
      plainEnglishMeaning: "Your photo and evidence coverage is strong across key views.",
      patientImplication: "This increases confidence that your report reflects your real pattern.",
      confidenceExplanation: "",
      followUpAdvice: "Maintain the same capture quality and intervals for future checkpoints.",
    },
    moderate_positive: {
      clinicalFinding: "Documentation is adequate with minor missing elements.",
      plainEnglishMeaning: "Most required views are present, with small gaps.",
      patientImplication: "Your report is still useful, though confidence could improve with fuller coverage.",
      confidenceExplanation: "",
      followUpAdvice: "Add missing categories at your next upload window for stronger trend tracking.",
    },
    mixed: {
      clinicalFinding: "Documentation completeness is mixed across required categories.",
      plainEnglishMeaning: "Some important views are clear, while others are incomplete.",
      patientImplication: "Interpretation quality may vary by section because the evidence quality varies.",
      confidenceExplanation: "",
      followUpAdvice: "Prioritize missing categories within 2-4 weeks to improve next-report confidence.",
    },
    limited_evidence: {
      clinicalFinding: "Overall documentation is currently insufficient for high-confidence interpretation.",
      plainEnglishMeaning: "There are not enough complete images to judge all domains properly.",
      patientImplication: "This reflects missing documentation, not necessarily a weak clinical result.",
      confidenceExplanation: "",
      followUpAdvice: "Upload a full baseline set now, then repeat every 2-3 months.",
    },
    concern_flagged: {
      clinicalFinding: "Documentation gaps materially limit interpretation reliability in key domains.",
      plainEnglishMeaning: "Important image categories are missing, reducing report certainty.",
      patientImplication: "Without better documentation, false reassurance or false concern is more likely.",
      confidenceExplanation: "",
      followUpAdvice: "Complete the missing evidence set before drawing strong conclusions from this section.",
    },
  },
  hairline_transition: {
    strong_positive: {
      clinicalFinding: "Hairline transition pattern appears graduated and biomimetically natural.",
      plainEnglishMeaning: "The front edge looks softly blended rather than abrupt.",
      patientImplication: "This supports a more natural appearance in normal social distance views.",
      confidenceExplanation: "",
      followUpAdvice: "Reassess at months 6 and 12 as caliber maturation continues.",
    },
    moderate_positive: {
      clinicalFinding: "Hairline transition is mostly natural with mild edge-density concentration.",
      plainEnglishMeaning: "The hairline looks good overall but may appear slightly sharper in places.",
      patientImplication: "This often softens over time as growth and texture mature.",
      confidenceExplanation: "",
      followUpAdvice: "Track close-range and conversational-distance photos every 8-12 weeks.",
    },
    mixed: {
      clinicalFinding: "Hairline transition evidence is mixed with variable softness across segments.",
      plainEnglishMeaning: "Parts of the hairline look natural, while other parts appear less blended.",
      patientImplication: "Perceived naturalness may vary by lighting, angle, and hairstyle.",
      confidenceExplanation: "",
      followUpAdvice: "Capture consistent frontal and temple views monthly through month 9.",
    },
    limited_evidence: {
      clinicalFinding: "Hairline transition cannot be confidently graded from current image angles.",
      plainEnglishMeaning: "The available photos do not clearly show the front transition line.",
      patientImplication: "No strong conclusion should be drawn yet from this domain alone.",
      confidenceExplanation: "",
      followUpAdvice: "Add high-resolution frontal and 45-degree views in neutral lighting.",
    },
    concern_flagged: {
      clinicalFinding: "Hairline transition shows features that may reduce natural edge blending.",
      plainEnglishMeaning: "The front edge may look more abrupt than expected.",
      patientImplication: "If persistent over time, this can affect naturalness perception.",
      confidenceExplanation: "",
      followUpAdvice: "Repeat imaging in 6-8 weeks and discuss targeted options during clinical review.",
    },
  },
  density_consistency: {
    strong_positive: {
      clinicalFinding: "Density distribution appears coherent with low visible inter-zone variance.",
      plainEnglishMeaning: "Coverage looks even across nearby treated regions.",
      patientImplication: "This supports smoother visual fullness across the transplant area.",
      confidenceExplanation: "",
      followUpAdvice: "Continue standardized top and frontal photos every 2-3 months.",
    },
    moderate_positive: {
      clinicalFinding: "Density pattern is generally consistent with mild regional variation.",
      plainEnglishMeaning: "Most areas look balanced, with small differences in fullness.",
      patientImplication: "Minor differences often improve as later-growth hairs mature.",
      confidenceExplanation: "",
      followUpAdvice: "Compare the same zones at months 4, 6, and 9.",
    },
    mixed: {
      clinicalFinding: "Density consistency findings are mixed with notable zone-to-zone variation.",
      plainEnglishMeaning: "Some areas appear fuller, while others look thinner.",
      patientImplication: "Visual uniformity may improve, but trend tracking is important.",
      confidenceExplanation: "",
      followUpAdvice: "Use repeat top-down images monthly and review if asymmetry persists beyond month 6.",
    },
    limited_evidence: {
      clinicalFinding: "Density consistency cannot be interpreted reliably from the current dataset.",
      plainEnglishMeaning: "There are not enough comparable images to measure consistency.",
      patientImplication: "This uncertainty is evidence-related and does not confirm poor density.",
      confidenceExplanation: "",
      followUpAdvice: "Submit matched-angle photos in consistent lighting every 6-8 weeks.",
    },
    concern_flagged: {
      clinicalFinding: "Density pattern includes asymmetry that may be clinically meaningful if persistent.",
      plainEnglishMeaning: "Some treated zones may be maturing unevenly.",
      patientImplication: "Ongoing asymmetry can affect overall visual balance.",
      confidenceExplanation: "",
      followUpAdvice: "Plan a clinician follow-up in 4-8 weeks with side-by-side interval photos.",
    },
  },
  direction_angle_coherence: {
    strong_positive: {
      clinicalFinding: "Follicular direction and angulation appear coherent with native flow.",
      plainEnglishMeaning: "Hair direction looks aligned and natural in the visible pattern.",
      patientImplication: "This supports better blending with existing hair and easier styling.",
      confidenceExplanation: "",
      followUpAdvice: "Reassess in dry and wet states at months 6 and 12 for full flow evaluation.",
    },
    moderate_positive: {
      clinicalFinding: "Direction and angle pattern is mostly coherent with minor local deviations.",
      plainEnglishMeaning: "Hair flow looks generally natural, with small areas that may sit differently.",
      patientImplication: "Minor deviations are often manageable and may become less noticeable over time.",
      confidenceExplanation: "",
      followUpAdvice: "Document comb-through videos and stills every 2-3 months.",
    },
    mixed: {
      clinicalFinding: "Direction-angle coherence is mixed with region-specific variability.",
      plainEnglishMeaning: "Some areas flow naturally, while others may look less aligned.",
      patientImplication: "This can affect styling behavior and perceived naturalness in certain angles.",
      confidenceExplanation: "",
      followUpAdvice: "Capture short motion clips and fixed-angle photos to track direction stability.",
    },
    limited_evidence: {
      clinicalFinding: "Direction-angle analysis is constrained by limited high-detail directional views.",
      plainEnglishMeaning: "Current photos do not clearly show enough hair-flow detail.",
      patientImplication: "No definitive direction-quality conclusion can be made yet.",
      confidenceExplanation: "",
      followUpAdvice: "Upload close-range oblique and temple views under even lighting.",
    },
    concern_flagged: {
      clinicalFinding: "Direction-angle pattern includes discordant regions that may impact visual integration.",
      plainEnglishMeaning: "Some hairs may not be following the expected natural flow.",
      patientImplication: "If this remains, blending and styling may feel less intuitive in those areas.",
      confidenceExplanation: "",
      followUpAdvice: "Repeat direction-focused imaging in 6-8 weeks and review with your treating team.",
    },
  },
};

export function buildPatientNarrative(input: {
  domainId: PatientNarrativeDomainId;
  state: PatientNarrativeState;
  confidenceBand: "high" | "moderate" | "low" | "limited";
}): PatientNarrativeBlock {
  const base = templates[input.domainId][input.state];
  return {
    ...base,
    confidenceExplanation: patientConfidenceExplanation(input.confidenceBand),
  };
}
