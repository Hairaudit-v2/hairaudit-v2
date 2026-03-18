/**
 * Fixed sample data for the HairAudit demo/sample report.
 * No real case or patient data; used for website preview and commercial presentation.
 */

export const DEMO_CASE_ID = "DEMO-SAMPLE";
export const DEMO_REPORT_VERSION = 1;

export const demoReportData = {
  caseId: DEMO_CASE_ID,
  generatedAt: new Date().toLocaleString(),
  version: DEMO_REPORT_VERSION,
  overallScore: 72,
  confidencePct: 78,
  confidenceBand: "Moderate" as const,
  modelVersion: "Sample",
  grade: "Silver",
  scoreBand: { label: "Silver", color: "#E6E6E6" },

  metrics: {
    donorQuality: "Moderate — even distribution in sample views",
    graftSurvival: "72–82% estimated range",
    transectionRisk: "Low to moderate",
    implantationDensity: "Moderate — zone-dependent",
    hairlineNaturalness: "Good transition in sample",
    donorScarVisibility: "Not fully assessable in sample",
  },

  executiveSummary:
    "This sample report illustrates the structure and depth of a HairAudit AI surgical analysis. " +
    "In a full report, pattern-based observations across donor, recipient, and implantation evidence are summarized with confidence bands and actionable guidance.",

  radar: {
    labels: [
      "Donor Management",
      "Recipient Site Design",
      "Graft Handling",
      "Implantation Technique",
      "Density Distribution",
      "Documentation Quality",
    ],
    values: [68, 74, 62, 70, 76, 82],
    overall: 72,
    confidence: 0.78,
  },

  areaDomains: [
    { title: "Donor Management", score: 68, outOf5: 3, level: "Medium" },
    { title: "Recipient Site Design", score: 74, outOf5: 4, level: "High" },
    { title: "Graft Handling", score: 62, outOf5: 3, level: "Medium" },
    { title: "Implantation Technique", score: 70, outOf5: 4, level: "High" },
    { title: "Documentation Quality", score: 82, outOf5: 4, level: "High" },
  ],

  domainCards: [
    {
      title: "Donor Management",
      score: 68,
      observation: "Sample data shows balanced extraction spread; full reports use your actual donor imagery.",
      whyItMatters: "Donor management patterns influence long-term donor preservation and visual uniformity.",
      monitoring: "Monitor donor density and visible donor homogeneity over the next 6–12 months.",
    },
    {
      title: "Recipient Site Design",
      score: 74,
      observation: "Recipient design in this sample indicates structured zone planning.",
      whyItMatters: "Recipient site distribution can influence naturalness and zone-to-zone balance.",
      monitoring: "Monitor transition softness, frontal framing, and regional blending during growth cycles.",
    },
    {
      title: "Graft Handling",
      score: 62,
      observation: "Assessment is limited by available evidence in this domain for the sample.",
      whyItMatters: "Graft handling consistency may influence viability and downstream growth quality.",
      monitoring: "Where evidence is limited, request procedural details or additional intra-operative documentation.",
    },
    {
      title: "Implantation Technique",
      score: 70,
      observation: "Observed patterns are mixed with moderate confidence in this sample.",
      whyItMatters: "Implantation spacing and angle coherence can influence visual density and native blending.",
      monitoring: "Track maturing density pattern and directional consistency between regions.",
    },
    {
      title: "Documentation Quality",
      score: 82,
      observation: "Sample documentation tier illustrates how evidence completeness affects confidence.",
      whyItMatters: "Documentation quality determines confidence in all pattern-based interpretations.",
      monitoring: "Add missing captures where possible to improve future confidence and longitudinal comparability.",
    },
  ],

  confidenceIntegrity: {
    aiConfidencePct: 78,
    confidenceBand: "Moderate",
    imagesAnalyzed: 12,
    donorViews: 3,
    recipientViews: 5,
    intraOpViews: 4,
    evidenceCompleteness: "Sufficient for broader interpretation",
    limitations: ["Sample report; no real patient imagery or identifiers."],
  },

  fingerprintCards: [
    {
      title: "Donor Extraction Pattern",
      icon: "◯",
      label: "Extraction distribution",
      confidence: "Moderate" as const,
      observation: "Sample data illustrates how extraction spread is assessed from donor views.",
      whyItMatters: "Even distribution supports long-term donor sustainability and visual consistency.",
      strength: 3,
    },
    {
      title: "Recipient Site Distribution",
      icon: "▣",
      label: "Recipient placement",
      confidence: "High" as const,
      observation: "Sample shows zone-based placement assessment.",
      whyItMatters: "Balanced distribution supports natural appearance and density perception.",
      strength: 4,
    },
    {
      title: "Density Consistency",
      icon: "▤",
      label: "Density signature",
      confidence: "Moderate" as const,
      observation: "Density consistency is evaluated across zones in full reports.",
      whyItMatters: "Consistency reduces visible patchiness and supports predictable growth.",
      strength: 3,
    },
    {
      title: "Direction & Angle Coherence",
      icon: "◇",
      label: "Directional flow",
      confidence: "High" as const,
      observation: "Angle and direction coherence are assessed from recipient imagery.",
      whyItMatters: "Coherent angles improve natural flow and blending with native hair.",
      strength: 4,
    },
  ],

  highlights: [
    "Structured zone-based design in sample data.",
    "Documentation tier supports moderate to high confidence in key domains.",
    "Clear separation of evidence limitations from clinical findings.",
  ],

  risks: [
    "Sample only — no real patient findings.",
    "Full reports may flag donor over-harvest risk or density concerns where evidence supports it.",
  ],

  patientGuidance: [
    "Monitor donor density and visible donor homogeneity over the next 6–12 months.",
    "Monitor transition softness, frontal framing, and regional blending during growth cycles.",
    "Where evidence is limited, request procedural details or additional intra-operative documentation.",
    "Add missing captures where possible to improve future confidence and longitudinal comparability.",
  ],

  predictiveOutlook:
    "In full reports, observed implantation and density patterns are summarized with a graft survival expectation range based on your submitted evidence.",
};
