/**
 * HA-REPORT-4A — Independent pre-surgery planning report.
 * Separate from post-surgery auditing; patient-safe language only.
 */

import type {
  CrownProgressionEstimate,
  DonorDensityBand,
  HairAuditIntelligenceBundle,
  NorwoodStageEstimate,
} from "@/lib/hairaudit-intelligence/types";
import {
  normalizePatientReviewPathway,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import {
  buildLongTermHairPreservationContent,
  isLongTermHairPreservationContent,
  type LongTermHairPreservationContent,
} from "./longTermHairPreservation";
import {
  buildFutureHairLossProgressionRisk,
  isFutureHairLossRiskResult,
  type FutureHairLossRiskResult,
} from "./futureHairLossProgressionRisk";
import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import {
  buildPatientSafeReportSummary,
  type PatientSafeReportSummary,
} from "./patientSafeSummary";
import { sanitizePatientReportText } from "./postSurgeryPatientText";

export const PRE_SURGERY_PLANNING_REPORT_VERSION = 1 as const;

export type PreSurgeryPlanningOutcomeId =
  | "strong_surgical_candidate"
  | "suitable_with_long_term_planning"
  | "medical_stabilisation_recommended_first"
  | "donor_limitations_identified"
  | "further_professional_review_recommended";

export type PreSurgeryQualitativeBand = "low" | "moderate" | "elevated" | "strong" | "limited" | "high" | "caution";

export type PreSurgeryScorecardMetricId =
  | "hair_loss_progression_risk"
  | "donor_area_strength"
  | "restoration_suitability"
  | "estimated_graft_requirement"
  | "long_term_preservation_score"
  | "treatment_stabilisation_priority";

export type PreSurgeryReviewSectionId =
  | "overall_planning"
  | "hair_loss_pattern"
  | "donor_area"
  | "estimated_graft_requirement"
  | "surgical_suitability"
  | "future_progression"
  | "medical_treatment";

export type PreSurgeryScorecardMetric = {
  id: PreSurgeryScorecardMetricId;
  percentScore?: number | null;
  qualitativeLabel?: string | null;
  displayValue: string;
};

export type PreSurgeryReviewSection = {
  id: PreSurgeryReviewSectionId;
  finding: string;
};

export type PreSurgeryImageAssessment = {
  viewKey: "front" | "crown" | "donor";
  photoCategoryKey?: string | null;
  imageUrl?: string | null;
  imageLabel?: string | null;
  assessment: string;
};

export type PreSurgeryPlanningReport = {
  version: typeof PRE_SURGERY_PLANNING_REPORT_VERSION;
  pathway: "pre_surgery";
  reportId: string;
  generatedAt: string;
  planningOutcomeId: PreSurgeryPlanningOutcomeId;
  scorecards: PreSurgeryScorecardMetric[];
  sections: PreSurgeryReviewSection[];
  imageAssessments: PreSurgeryImageAssessment[];
  recommendedNextSteps: string[];
  graftEstimateRange?: { min: number; max: number } | null;
  graftEstimateCaveat: string;
  longTermPreservation: LongTermHairPreservationContent;
  futureHairLossRisk: FutureHairLossRiskResult;
  patientSafeSummary: PatientSafeReportSummary;
};

export type GeneratePreSurgeryPlanningReportInput = {
  summary: Record<string, unknown>;
  intelligenceBundle?: HairAuditIntelligenceBundle | null;
  caseId: string;
  reportVersion?: number;
  patientReviewPathway?: PatientReviewPathway | unknown;
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
  clinicalHistory?: ClinicalHistorySnapshot | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function extractFindingText(entry: unknown): string {
  if (typeof entry === "string") return entry.trim();
  if (!isRecord(entry)) return "";
  return String(entry.title ?? entry.flag ?? "").trim();
}

function buildSectionFinding(
  defaultText: string,
  keywords: string[],
  findings: unknown[]
): string {
  for (const entry of findings) {
    const text = extractFindingText(entry);
    if (!text) continue;
    const lower = text.toLowerCase();
    if (keywords.some((k) => lower.includes(k))) return sanitizePatientReportText(text);
  }
  return sanitizePatientReportText(defaultText);
}

function norwoodNumericStage(stage: NorwoodStageEstimate): number | null {
  switch (stage) {
    case "I":
      return 1;
    case "II":
      return 2;
    case "III":
      return 3;
    case "III_vertex":
      return 3.5;
    case "IV":
      return 4;
    case "V":
      return 5;
    case "VI":
      return 6;
    case "VII":
      return 7;
    default:
      return null;
  }
}

function deriveGraftRange(
  norwood: NorwoodStageEstimate,
  crown: CrownProgressionEstimate
): { min: number; max: number } | null {
  const base: Record<NorwoodStageEstimate, { min: number; max: number } | null> = {
    I: { min: 0, max: 800 },
    II: { min: 800, max: 1500 },
    III: { min: 1500, max: 2200 },
    III_vertex: { min: 1800, max: 2800 },
    IV: { min: 2200, max: 3500 },
    V: { min: 3000, max: 4500 },
    VI: { min: 4000, max: 5500 },
    VII: { min: 5000, max: 6500 },
    indeterminate: null,
    not_assessable: null,
  };
  const range = base[norwood];
  if (!range) return null;
  if (crown === "moderate" || crown === "advanced") {
    return { min: range.min + 200, max: range.max + 400 };
  }
  return range;
}

function formatGraftRange(range: { min: number; max: number } | null): string {
  if (!range) return "Preliminary range pending review";
  return `${range.min.toLocaleString("en-US")}–${range.max.toLocaleString("en-US")} grafts`;
}

function donorStrengthLabel(band: DonorDensityBand): { label: string; band: PreSurgeryQualitativeBand } {
  switch (band) {
    case "appears_adequate":
      return { label: "Strong", band: "strong" };
    case "moderate":
      return { label: "Moderate", band: "moderate" };
    case "appears_limited":
      return { label: "Limited", band: "limited" };
    default:
      return { label: "Under review", band: "moderate" };
  }
}

function progressionRiskLabel(
  norwood: NorwoodStageEstimate,
  crown: CrownProgressionEstimate
): { label: string; band: PreSurgeryQualitativeBand; percent?: number } {
  const stage = norwoodNumericStage(norwood);
  if (stage == null || norwood === "not_assessable" || norwood === "indeterminate") {
    return { label: "Under review", band: "moderate" };
  }
  if (stage <= 2 && crown !== "moderate" && crown !== "advanced") {
    return { label: "Low", band: "low", percent: 25 };
  }
  if (stage <= 3.5 && crown !== "advanced") {
    return { label: "Moderate", band: "moderate", percent: 45 };
  }
  return { label: "Elevated", band: "elevated", percent: 70 };
}

function restorationSuitabilityLabel(
  donorBand: DonorDensityBand,
  norwood: NorwoodStageEstimate,
  stabilisationPriority: PreSurgeryQualitativeBand
): { label: string; band: PreSurgeryQualitativeBand } {
  if (norwood === "not_assessable" || norwood === "indeterminate") {
    return { label: "Further review needed", band: "caution" };
  }
  if (stabilisationPriority === "elevated" || norwood === "I" || norwood === "II") {
    return { label: "Not recommended yet", band: "caution" };
  }
  if (donorBand === "appears_limited") {
    return { label: "Caution", band: "caution" };
  }
  if (donorBand === "moderate" || norwood === "IV" || norwood === "V") {
    return { label: "Moderate", band: "moderate" };
  }
  return { label: "High", band: "high" };
}

function preservationScoreLabel(
  donorReserveRisk: string | undefined,
  norwood: NorwoodStageEstimate
): { label: string; band: PreSurgeryQualitativeBand } {
  const stage = norwoodNumericStage(norwood);
  if (donorReserveRisk === "elevated" || (stage != null && stage >= 5)) {
    return { label: "Low", band: "low" };
  }
  if (donorReserveRisk === "moderate" || (stage != null && stage >= 3.5)) {
    return { label: "Moderate", band: "moderate" };
  }
  return { label: "Strong", band: "strong" };
}

function stabilisationPriorityLabel(
  norwood: NorwoodStageEstimate,
  diffuse: string | undefined,
  miniaturisation: string | undefined
): { label: string; band: PreSurgeryQualitativeBand } {
  const stage = norwoodNumericStage(norwood);
  if (
    (stage != null && stage <= 2.5) ||
    diffuse === "likely" ||
    diffuse === "possible" ||
    miniaturisation === "elevated_suspicion"
  ) {
    return { label: "High", band: "elevated" };
  }
  if (stage != null && stage <= 3.5) {
    return { label: "Moderate", band: "moderate" };
  }
  return { label: "Low", band: "low" };
}

function derivePlanningOutcome(
  suitability: PreSurgeryQualitativeBand,
  donorBand: DonorDensityBand,
  stabilisation: PreSurgeryQualitativeBand,
  norwood: NorwoodStageEstimate,
  confidence: string | undefined
): PreSurgeryPlanningOutcomeId {
  if (norwood === "not_assessable" || norwood === "indeterminate" || confidence === "very_low") {
    return "further_professional_review_recommended";
  }
  if (donorBand === "appears_limited") {
    return "donor_limitations_identified";
  }
  if (stabilisation === "elevated") {
    return "medical_stabilisation_recommended_first";
  }
  if (suitability === "high" && donorBand === "appears_adequate") {
    return "strong_surgical_candidate";
  }
  if (suitability === "caution") {
    return "further_professional_review_recommended";
  }
  return "suitable_with_long_term_planning";
}

function buildRecommendedNextSteps(
  outcomeId: PreSurgeryPlanningOutcomeId,
  stabilisation: PreSurgeryQualitativeBand,
  patientSummary: PatientSafeReportSummary,
  bundle: HairAuditIntelligenceBundle | null | undefined
): string[] {
  const steps = [...patientSummary.whatHappensNext.steps];

  if (stabilisation === "elevated" || outcomeId === "medical_stabilisation_recommended_first") {
    steps.push("Discuss medical stabilisation before final surgical planning.");
  }
  steps.push("Confirm donor density with in-person assessment.");
  steps.push("Avoid overly aggressive hairline lowering in early planning discussions.");
  steps.push("Request a written graft plan from any clinic you consider.");
  steps.push("Consider independent review before paying a deposit.");

  if (outcomeId === "donor_limitations_identified") {
    steps.push("Prioritise conservative graft use and long-term donor preservation in any plan.");
  }
  if (bundle?.donorIntelligence?.suggestedNextStep) {
    const cleaned = sanitizePatientReportText(bundle.donorIntelligence.suggestedNextStep);
    if (cleaned) steps.push(cleaned);
  }
  if (bundle?.hairLossClassification?.suggestedNextStep) {
    const cleaned = sanitizePatientReportText(bundle.hairLossClassification.suggestedNextStep);
    if (cleaned) steps.push(cleaned);
  }

  return [...new Set(steps.map((s) => sanitizePatientReportText(s.trim())).filter(Boolean))].slice(0, 6);
}

function pickPhoto(
  photosByCategory: Record<string, { signedUrl: string | null; label: string }[]> | undefined,
  categoryKeys: string[]
): { url: string | null; label: string | null; key: string | null } {
  if (!photosByCategory) return { url: null, label: null, key: null };
  for (const key of categoryKeys) {
    const items = photosByCategory[key];
    if (!items?.length) continue;
    const withUrl = items.find((p) => p.signedUrl);
    if (withUrl?.signedUrl) {
      return { url: withUrl.signedUrl, label: withUrl.label, key };
    }
  }
  return { url: null, label: null, key: null };
}

function buildImageAssessments(
  forensic: Record<string, unknown> | null,
  bundle: HairAuditIntelligenceBundle | null | undefined,
  donorStrength: string,
  crownLabel: string,
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>
): PreSurgeryImageAssessment[] {
  const photoObs = Array.isArray(forensic?.photo_observations) ? forensic.photo_observations : [];

  const frontObs = photoObs.find((p) => {
    if (!isRecord(p)) return false;
    const cat = String(p.category ?? p.view ?? "").toLowerCase();
    return cat.includes("front") || cat.includes("hairline");
  });
  const crownObs = photoObs.find((p) => {
    if (!isRecord(p)) return false;
    const cat = String(p.category ?? p.view ?? "").toLowerCase();
    return cat.includes("top") || cat.includes("crown") || cat.includes("vertex");
  });
  const donorObs = photoObs.find((p) => {
    if (!isRecord(p)) return false;
    const cat = String(p.category ?? p.view ?? "").toLowerCase();
    return cat.includes("donor") || cat.includes("rear");
  });

  const frontPhoto = pickPhoto(photosByCategory, [
    "preop_front",
    "patient_current_front",
    "preop_hairline_closeup",
  ]);
  const crownPhoto = pickPhoto(photosByCategory, [
    "preop_top",
    "preop_wet_top",
    "patient_current_top",
  ]);
  const donorPhoto = pickPhoto(photosByCategory, [
    "preop_donor_rear",
    "preop_donor_closeup",
    "patient_current_donor_rear",
  ]);

  const defaultFront =
    bundle?.hairLossClassification?.patientSafeSummary?.trim() ||
    "Visible frontal recession pattern appears suitable for conservative planning.";
  const defaultCrown =
    `Crown involvement appears ${crownLabel.toLowerCase()} based on visible image evidence.`;
  const defaultDonor =
    bundle?.donorIntelligence?.patientSafeSummary?.trim() ||
    `Donor region appears ${donorStrength.toLowerCase()} based on visible image evidence.`;

  return [
    {
      viewKey: "front",
      photoCategoryKey: frontPhoto.key,
      imageUrl: frontPhoto.url,
      imageLabel: frontPhoto.label ?? "Front hairline view",
      assessment: sanitizePatientReportText(
        (isRecord(frontObs) ? String(frontObs.observation ?? frontObs.summary ?? "").trim() : "") ||
          defaultFront
      ),
    },
    {
      viewKey: "crown",
      photoCategoryKey: crownPhoto.key,
      imageUrl: crownPhoto.url,
      imageLabel: crownPhoto.label ?? "Crown / top view",
      assessment: sanitizePatientReportText(
        (isRecord(crownObs) ? String(crownObs.observation ?? crownObs.summary ?? "").trim() : "") ||
          defaultCrown
      ),
    },
    {
      viewKey: "donor",
      photoCategoryKey: donorPhoto.key,
      imageUrl: donorPhoto.url,
      imageLabel: donorPhoto.label ?? "Donor view",
      assessment: sanitizePatientReportText(
        (isRecord(donorObs) ? String(donorObs.observation ?? donorObs.summary ?? "").trim() : "") ||
          defaultDonor
      ),
    },
  ];
}

function crownInvolvementLabel(crown: CrownProgressionEstimate): string {
  switch (crown) {
    case "none_observed":
      return "Mild";
    case "early":
      return "Mild";
    case "moderate":
      return "Moderate";
    case "advanced":
      return "Advanced";
    default:
      return "Under review";
  }
}

function buildReviewSections(
  forensic: Record<string, unknown> | null,
  bundle: HairAuditIntelligenceBundle | null | undefined,
  patientSummary: PatientSafeReportSummary,
  graftRange: { min: number; max: number } | null,
  graftCaveat: string,
  suitabilityLabel: string,
  outcomeId: PreSurgeryPlanningOutcomeId
): PreSurgeryReviewSection[] {
  const findings = [
    ...(Array.isArray(forensic?.key_findings) ? forensic.key_findings : []),
    ...(Array.isArray(forensic?.red_flags) ? forensic.red_flags : []),
  ];

  const summaryText =
    typeof forensic?.summary === "string" ? sanitizePatientReportText(forensic.summary.trim()) : "";
  const overallDefault =
    summaryText ||
    sanitizePatientReportText(patientSummary.plainEnglishSummary) ||
    "Your submitted images suggest a pattern that may be suitable for hair restoration planning, provided long-term donor preservation and future hair loss progression are considered.";

  const hairLossDefault =
    bundle?.hairLossClassification?.patientSafeSummary?.trim() ||
    "Your images show visible hair loss patterns that should be planned carefully so any hairline design remains natural as future hair loss may progress.";

  const donorDefault =
    bundle?.donorIntelligence?.patientSafeSummary?.trim() ||
    "The donor region appears suitable for planning, although additional close-up review may be useful before deciding graft numbers.";

  const graftDefault = graftRange
    ? `Based on the visible areas of concern, a preliminary planning range may sit around ${formatGraftRange(graftRange)}. ${graftCaveat}`
    : `A preliminary graft range could not be estimated from available images alone. ${graftCaveat}`;

  const suitabilityDefault = (() => {
    switch (outcomeId) {
      case "strong_surgical_candidate":
        return "Surgery may appear reasonable to consider, provided donor measurement and long-term planning are completed in person.";
      case "medical_stabilisation_recommended_first":
        return "Surgery may be reasonable to consider eventually, but long-term medical stabilisation should be discussed before committing to a final hairline design.";
      case "donor_limitations_identified":
        return "Surgery may still be considered with caution — conservative planning and donor preservation should be prioritised given visible donor limitations.";
      case "further_professional_review_recommended":
        return "Further professional review is recommended before deciding on surgery — available images may not provide enough evidence on their own.";
      default:
        return `Restoration suitability appears ${suitabilityLabel.toLowerCase()} — any surgical plan should account for future progression and donor limits.`;
    }
  })();

  const progressionDefault =
    bundle?.hairLossClassification?.patientSafeSummary?.trim() ||
    "Because future progression may continue, any surgical plan should avoid using too much donor supply too early.";

  const medicalDefault =
    "Medical stabilisation may be worth discussing with a qualified medical professional. Non-surgical treatment may improve long-term planning. Scalp or inflammatory factors and bloodwork may be useful where relevant — discuss with a qualified medical professional.";

  return [
    {
      id: "overall_planning",
      finding: buildSectionFinding(overallDefault, ["planning", "suitable", "pattern"], findings),
    },
    {
      id: "hair_loss_pattern",
      finding: buildSectionFinding(
        hairLossDefault,
        ["frontal", "crown", "recession", "thinning", "pattern"],
        findings
      ),
    },
    {
      id: "donor_area",
      finding: buildSectionFinding(donorDefault, ["donor", "density", "reserve"], findings),
    },
    { id: "estimated_graft_requirement", finding: sanitizePatientReportText(graftDefault) },
    {
      id: "surgical_suitability",
      finding: buildSectionFinding(suitabilityDefault, ["surgery", "suitable", "restoration"], findings),
    },
    {
      id: "future_progression",
      finding: buildSectionFinding(
        progressionDefault,
        ["progression", "future", "long-term", "preservation"],
        findings
      ),
    },
    {
      id: "medical_treatment",
      finding: buildSectionFinding(medicalDefault, ["medical", "stabilisation", "treatment"], findings),
    },
  ];
}

const GRAFT_ESTIMATE_CAVEAT =
  "This preliminary range should be confirmed through in-person donor measurement and surgical planning with a qualified clinician.";

/**
 * Build the pre-surgery planning report from forensic summary + intelligence bundle.
 */
export function generatePreSurgeryPlanningReport(
  input: GeneratePreSurgeryPlanningReportInput
): PreSurgeryPlanningReport {
  const pathway = normalizePatientReviewPathway(
    input.patientReviewPathway ??
      input.summary.patient_review_pathway ??
      (isRecord(input.summary.metadata) ? input.summary.metadata.patientReviewPathway : undefined)
  );

  const forensic = isRecord(input.summary.forensic_audit)
    ? input.summary.forensic_audit
    : isRecord(input.summary.forensic)
      ? input.summary.forensic
      : null;

  const patientSafeSummary = buildPatientSafeReportSummary(
    forensic
      ? {
          key_findings: forensic.key_findings,
          red_flags: forensic.red_flags,
          patient_review_pathway: pathway,
        }
      : input.summary,
    { patientReviewPathway: pathway }
  );

  const bundle =
    input.intelligenceBundle ??
    (isRecord(input.summary.metadata) &&
    isRecord((input.summary.metadata as Record<string, unknown>).hairAuditIntelligence)
      ? ((input.summary.metadata as Record<string, unknown>).hairAuditIntelligence as HairAuditIntelligenceBundle)
      : null);

  const norwood = bundle?.hairLossClassification?.fields?.norwoodStage ?? "not_assessable";
  const crown = bundle?.hairLossClassification?.fields?.crownProgression ?? "not_assessable";
  const diffuse = bundle?.hairLossClassification?.fields?.diffuseThinningPattern;
  const donorBand = bundle?.donorIntelligence?.fields?.donorDensityBand ?? "not_assessable";
  const donorReserveRisk = bundle?.donorIntelligence?.fields?.donorReserveRisk;
  const miniaturisation = bundle?.donorIntelligence?.fields?.miniaturisationSuspicion;
  const confidence = bundle?.overallConfidence;

  const progression = progressionRiskLabel(norwood, crown);
  const donorStrength = donorStrengthLabel(donorBand);
  const stabilisation = stabilisationPriorityLabel(norwood, diffuse, miniaturisation);
  const suitability = restorationSuitabilityLabel(donorBand, norwood, stabilisation.band);
  const preservation = preservationScoreLabel(donorReserveRisk, norwood);
  const graftRange = deriveGraftRange(norwood, crown);

  const planningOutcomeId = derivePlanningOutcome(
    suitability.band,
    donorBand,
    stabilisation.band,
    norwood,
    confidence
  );

  const scorecards: PreSurgeryScorecardMetric[] = [
    {
      id: "hair_loss_progression_risk",
      percentScore: progression.percent ?? null,
      qualitativeLabel: progression.band,
      displayValue: progression.percent != null ? `${progression.label} (${progression.percent}%)` : progression.label,
    },
    {
      id: "donor_area_strength",
      qualitativeLabel: donorStrength.band,
      displayValue: donorStrength.label,
    },
    {
      id: "restoration_suitability",
      qualitativeLabel: suitability.band,
      displayValue: suitability.label,
    },
    {
      id: "estimated_graft_requirement",
      displayValue: formatGraftRange(graftRange),
    },
    {
      id: "long_term_preservation_score",
      qualitativeLabel: preservation.band,
      displayValue: preservation.label,
    },
    {
      id: "treatment_stabilisation_priority",
      qualitativeLabel: stabilisation.band,
      displayValue: stabilisation.label,
    },
  ];

  const sections = buildReviewSections(
    forensic,
    bundle,
    patientSafeSummary,
    graftRange,
    GRAFT_ESTIMATE_CAVEAT,
    suitability.label,
    planningOutcomeId
  );

  const imageAssessments = buildImageAssessments(
    forensic,
    bundle,
    donorStrength.label,
    crownInvolvementLabel(crown),
    input.photosByCategory
  );

  const recommendedNextSteps = buildRecommendedNextSteps(
    planningOutcomeId,
    stabilisation.band,
    patientSafeSummary,
    bundle
  );

  const version = input.reportVersion ?? 1;
  const reportId = `${input.caseId}-v${version}`;

  return {
    version: PRE_SURGERY_PLANNING_REPORT_VERSION,
    pathway: "pre_surgery",
    reportId,
    generatedAt: new Date().toISOString(),
    planningOutcomeId,
    scorecards,
    sections,
    imageAssessments,
    recommendedNextSteps,
    graftEstimateRange: graftRange,
    graftEstimateCaveat: GRAFT_ESTIMATE_CAVEAT,
    longTermPreservation: buildLongTermHairPreservationContent("pre_surgery"),
    futureHairLossRisk: buildFutureHairLossProgressionRisk({
      pathway: "pre_surgery",
      intelligenceBundle: bundle,
      clinicalHistory: input.clinicalHistory ?? null,
      summary: input.summary,
    }),
    patientSafeSummary,
  };
}

export function isPreSurgeryPlanningReport(value: unknown): value is PreSurgeryPlanningReport {
  if (!isRecord(value)) return false;
  return (
    value.pathway === "pre_surgery" &&
    value.version === PRE_SURGERY_PLANNING_REPORT_VERSION &&
    Array.isArray(value.scorecards) &&
    Array.isArray(value.sections)
  );
}

export function resolvePreSurgeryPlanningReport(
  summary: Record<string, unknown> | null | undefined,
  opts: {
    caseId: string;
    reportVersion?: number;
    patientReviewPathway?: PatientReviewPathway | unknown;
    photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
    clinicalHistory?: ClinicalHistorySnapshot | null;
  }
): PreSurgeryPlanningReport | null {
  const pathway = normalizePatientReviewPathway(
    opts.patientReviewPathway ??
      summary?.patient_review_pathway ??
      (isRecord(summary?.metadata) ? summary.metadata.patientReviewPathway : undefined)
  );
  if (pathway !== "pre_surgery") return null;

  const stored = summary?.pre_surgery_planning_report;
  if (isPreSurgeryPlanningReport(stored)) {
    return {
      ...stored,
      longTermPreservation: isLongTermHairPreservationContent(stored.longTermPreservation)
        ? stored.longTermPreservation
        : buildLongTermHairPreservationContent("pre_surgery"),
      futureHairLossRisk: isFutureHairLossRiskResult(stored.futureHairLossRisk)
        ? stored.futureHairLossRisk
        : buildFutureHairLossProgressionRisk({
            pathway: "pre_surgery",
            intelligenceBundle:
              isRecord(summary?.metadata) &&
              isRecord((summary.metadata as Record<string, unknown>).hairAuditIntelligence)
                ? ((summary.metadata as Record<string, unknown>)
                    .hairAuditIntelligence as HairAuditIntelligenceBundle)
                : null,
            clinicalHistory: opts.clinicalHistory ?? null,
            summary: summary ?? undefined,
          }),
    };
  }

  if (!summary) return null;

  return generatePreSurgeryPlanningReport({
    summary,
    caseId: opts.caseId,
    reportVersion: opts.reportVersion,
    patientReviewPathway: pathway,
    photosByCategory: opts.photosByCategory,
    clinicalHistory: opts.clinicalHistory ?? null,
  });
}

export function shouldUsePreSurgeryReportTemplate(
  pathway: PatientReviewPathway | unknown,
  auditMode?: string | null
): boolean {
  return normalizePatientReviewPathway(pathway) === "pre_surgery" && auditMode === "patient";
}

export function resolvePatientReportTemplateName(
  pathway: PatientReviewPathway | unknown,
  auditMode?: string | null
): "post-surgery-audit" | "pre-surgery-planning" | "elite" {
  if (auditMode !== "patient") return "elite";
  const normalized = normalizePatientReviewPathway(pathway);
  if (normalized === "post_surgery") return "post-surgery-audit";
  if (normalized === "pre_surgery") return "pre-surgery-planning";
  return "elite";
}
