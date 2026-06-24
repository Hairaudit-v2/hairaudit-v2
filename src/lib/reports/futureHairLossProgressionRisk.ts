/**
 * HA-REPORT-5E — Future Hair Loss Progression Risk Engine.
 * Deterministic, patient-safe educational scoring — not a diagnosis or prediction.
 */

import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import type {
  CrownProgressionEstimate,
  DiffuseThinningEstimate,
  DonorReserveRisk,
  HairAuditIntelligenceBundle,
  MiniaturisationSuspicion,
  NorwoodStageEstimate,
} from "@/lib/hairaudit-intelligence/types";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

export type FutureHairLossRiskBand = "low" | "moderate" | "elevated";

export type FutureHairLossRiskResult = {
  score: number;
  band: FutureHairLossRiskBand;
  summary: string;
  contributingFactors: string[];
  recommendations: string[];
};

export type FutureHairLossProgressionRiskInput = {
  pathway: PatientReviewPathway;
  intelligenceBundle?: HairAuditIntelligenceBundle | null;
  patientAge?: number | null;
  clinicalHistory?: ClinicalHistorySnapshot | null;
  summary?: Record<string, unknown> | null;
};

export type FutureHairLossRiskLabels = {
  title: string;
  subtitle: string;
  bandLabels: Record<FutureHairLossRiskBand, string>;
  contributingFactorsTitle: string;
  recommendationsTitle: string;
  summaries: Record<PatientReviewPathway, Record<FutureHairLossRiskBand, string>>;
  contributingFactors: {
    youngerAge: string;
    surroundingThinning: string;
    crownThinning: string;
    progressivePattern: string;
    noPreservationStrategy: string;
    monitoringBeneficial: string;
  };
  recommendations: Record<
    FutureHairLossRiskBand,
    { pre_surgery: string[]; post_surgery: string[] }
  >;
};

const MAX_CONTRIBUTING_FACTORS = 4;
const MAX_RECOMMENDATIONS = 4;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toIntOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function bracketToAgeMidpoint(bracket: string): number | null {
  switch (bracket) {
    case "lt_25":
      return 23;
    case "25_30":
      return 27;
    case "31_35":
      return 33;
    case "36_40":
      return 38;
    case "41_50":
      return 45;
    case "51_60":
      return 55;
    case "gt_60":
      return 62;
    default:
      return null;
  }
}

export function resolvePatientAgeForRisk(input: {
  patientAge?: number | null;
  summary?: Record<string, unknown> | null;
}): number | null {
  const direct = toIntOrNull(input.patientAge);
  if (direct != null) return direct;

  const summary = input.summary;
  if (!summary) return null;

  const patientAnswers = isRecord(summary.patient_answers) ? summary.patient_answers : null;
  if (patientAnswers) {
    const enhanced = isRecord(patientAnswers.enhanced_patient_answers)
      ? patientAnswers.enhanced_patient_answers
      : null;
    const baseline =
      (enhanced && isRecord(enhanced.baseline) ? enhanced.baseline : null) ??
      (isRecord(patientAnswers.patient_baseline) ? patientAnswers.patient_baseline : null);

    const fromBaseline = toIntOrNull(baseline?.patient_age ?? baseline?.patientAge);
    if (fromBaseline != null) return fromBaseline;

    const flatAge = toIntOrNull(
      (patientAnswers as Record<string, unknown>)["enhanced_patient_answers.baseline.patient_age"]
    );
    if (flatAge != null) return flatAge;
  }

  for (const key of ["doctor_answers", "clinic_answers"] as const) {
    const answers = isRecord(summary[key]) ? summary[key] : null;
    if (!answers) continue;
    const numericAge = toIntOrNull(answers.patientAge ?? answers.patient_age);
    if (numericAge != null) return numericAge;
    const bracket = String(answers.patient_age_bracket ?? "").trim();
    const midpoint = bracketToAgeMidpoint(bracket);
    if (midpoint != null) return midpoint;
  }

  return null;
}

function scoreAge(age: number | null): number {
  if (age == null) return 10;
  if (age < 25) return 20;
  if (age <= 35) return 16;
  if (age <= 45) return 11;
  if (age <= 55) return 6;
  return 3;
}

type ThinningLevel = "strong" | "moderate" | "mild" | "none" | "unknown";

function classifyVisibleThinning(
  diffuse: DiffuseThinningEstimate | undefined,
  miniaturisation: MiniaturisationSuspicion | undefined
): ThinningLevel {
  if (diffuse === "not_assessable" && miniaturisation === "not_assessable") return "unknown";
  if (diffuse === "likely" || miniaturisation === "elevated_suspicion") return "strong";
  if (diffuse === "possible" || miniaturisation === "possible") return "moderate";
  if (diffuse === "none_suggested" && miniaturisation === "none_suggested") return "none";
  if (diffuse === "none_suggested" || miniaturisation === "none_suggested") return "mild";
  return "unknown";
}

function scoreVisibleThinning(level: ThinningLevel): number {
  switch (level) {
    case "strong":
      return 25;
    case "moderate":
      return 18;
    case "mild":
      return 10;
    case "none":
      return 3;
    default:
      return 8;
  }
}

function scoreCrownProgression(crown: CrownProgressionEstimate | undefined): number {
  switch (crown) {
    case "advanced":
    case "moderate":
      return crown === "advanced" ? 15 : 8;
    case "early":
      return 8;
    case "none_observed":
      return 2;
    default:
      return 5;
  }
}

type PatternLevel = "advanced" | "moderate" | "mild" | "unknown";

function classifyHairLossPattern(norwood: NorwoodStageEstimate | undefined): PatternLevel {
  switch (norwood) {
    case "V":
    case "VI":
    case "VII":
      return "advanced";
    case "IV":
    case "III_vertex":
      return "moderate";
    case "I":
    case "II":
    case "III":
      return "mild";
    default:
      return "unknown";
  }
}

function scoreHairLossPattern(level: PatternLevel): number {
  switch (level) {
    case "advanced":
      return 15;
    case "moderate":
      return 9;
    case "mild":
      return 4;
    default:
      return 6;
  }
}

function classifyPostSurgerySurroundingDensity(
  diffuse: DiffuseThinningEstimate | undefined,
  miniaturisation: MiniaturisationSuspicion | undefined
): "ongoing" | "some" | "stable" | "unknown" {
  const thinning = classifyVisibleThinning(diffuse, miniaturisation);
  if (thinning === "strong") return "ongoing";
  if (thinning === "moderate" || thinning === "mild") return "some";
  if (thinning === "none") return "stable";
  return "unknown";
}

function classifyPreSurgeryProgressionSignals(
  donorReserveRisk: DonorReserveRisk | undefined,
  norwood: NorwoodStageEstimate | undefined,
  crown: CrownProgressionEstimate | undefined
): "ongoing" | "some" | "stable" | "unknown" {
  if (donorReserveRisk === "elevated" || crown === "advanced") return "ongoing";
  if (
    donorReserveRisk === "moderate" ||
    crown === "moderate" ||
    crown === "early" ||
    classifyHairLossPattern(norwood) === "moderate" ||
    classifyHairLossPattern(norwood) === "advanced"
  ) {
    return "some";
  }
  if (donorReserveRisk === "low") return "stable";
  return "unknown";
}

function scoreSurroundingDensitySignal(
  signal: "ongoing" | "some" | "stable" | "unknown"
): number {
  switch (signal) {
    case "ongoing":
      return 15;
    case "some":
      return 9;
    case "stable":
      return 3;
    default:
      return 6;
  }
}

type PreservationStrategyLevel = "none" | "some" | "active" | "unknown";

function classifyPreservationStrategy(input: {
  clinicalHistory?: ClinicalHistorySnapshot | null;
  summary?: Record<string, unknown> | null;
}): PreservationStrategyLevel {
  const meds = input.clinicalHistory?.medicationHistory;
  if (meds) {
    const activeKeys = [
      "finasteride",
      "dutasteride",
      "topical_minoxidil",
      "oral_minoxidil",
      "prp",
      "exosomes",
    ] as const;
    const hasActive = activeKeys.some((k) => meds[k] === true);
    if (hasActive) return "active";

    const hasSome =
      meds.saw_palmetto === true ||
      (typeof meds.other === "string" && meds.other.trim().length > 0);
    if (hasSome) return "some";

    if (meds.none_unknown === true) return "none";
  }

  const patientAnswers = isRecord(input.summary?.patient_answers)
    ? input.summary.patient_answers
    : null;
  const enhanced = patientAnswers && isRecord(patientAnswers.enhanced_patient_answers)
    ? patientAnswers.enhanced_patient_answers
    : null;
  const hairBiology = enhanced && isRecord(enhanced.hair_biology) ? enhanced.hair_biology : null;
  const medicationText = String(hairBiology?.current_medications_for_hair ?? "").trim().toLowerCase();
  if (medicationText) {
    if (
      /finasteride|dutasteride|minoxidil|rogaine|prp|exosome/.test(medicationText)
    ) {
      return "active";
    }
    if (!/none|no medication|not using|n\/a/.test(medicationText)) {
      return "some";
    }
    return "none";
  }

  if (hairBiology?.previous_prp_or_exosomes === true) return "some";

  return "unknown";
}

function scorePreservationStrategy(level: PreservationStrategyLevel): number {
  switch (level) {
    case "none":
      return 20;
    case "some":
      return 8;
    case "active":
      return 3;
    default:
      return 8;
  }
}

function resolveBand(score: number): FutureHairLossRiskBand {
  if (score >= 70) return "elevated";
  if (score >= 35) return "moderate";
  return "low";
}

export function buildFutureHairLossProgressionRiskLabelsEn(): FutureHairLossRiskLabels {
  return {
    title: "Future Hair Loss Progression Risk",
    subtitle:
      "Hair transplantation restores existing hair loss, but surrounding non-transplanted hair may continue changing over time depending on genetic, age-related, and long-term progression factors. This section helps estimate whether future monitoring or preventative planning may be beneficial.",
    bandLabels: {
      low: "Low",
      moderate: "Moderate",
      elevated: "Elevated",
    },
    contributingFactorsTitle: "Contributing factors",
    recommendationsTitle: "Recommendations",
    summaries: {
      pre_surgery: {
        low: "Current visible patterns suggest relatively stable long-term hair characteristics for planning purposes, though periodic monitoring remains valuable.",
        moderate:
          "Some visible or clinical factors suggest future hair loss progression may continue over time. Ongoing monitoring and preventative planning before surgery may be beneficial.",
        elevated:
          "Several current factors suggest future hair loss progression may remain active over time. Long-term candidacy planning and preventative discussions with your clinician may be worth considering.",
      },
      post_surgery: {
        low: "Current visible patterns suggest relatively stable long-term hair characteristics surrounding your transplant, though periodic monitoring remains valuable.",
        moderate:
          "Some visible or clinical factors suggest future hair loss progression may continue over time. Ongoing monitoring and preventative planning may help protect surrounding native hair.",
        elevated:
          "Several current factors suggest future hair loss progression may remain active over time. Long-term planning and preventative discussions with your clinician may help preserve transplant aesthetic balance.",
      },
    },
    contributingFactors: {
      youngerAge: "Younger age may allow more years of ongoing progression.",
      surroundingThinning: "Surrounding native hair shows signs of continued thinning.",
      crownThinning: "Visible crown thinning may suggest progressive pattern development.",
      progressivePattern: "Current pattern suggests future monitoring may be beneficial.",
      noPreservationStrategy: "Long-term hair preservation strategies were not indicated.",
      monitoringBeneficial: "Current pattern suggests future monitoring may be beneficial.",
    },
    recommendations: {
      low: {
        pre_surgery: [
          "Continue monitoring with periodic progress photos before pursuing surgery.",
          "Review changes over time with your clinician if concerns develop.",
        ],
        post_surgery: [
          "Continue monitoring with periodic progress photos.",
          "Review changes over time with your clinician if concerns develop.",
        ],
      },
      moderate: {
        pre_surgery: [
          "Consider discussing long-term hair preservation strategies with your clinician before surgery.",
          "Monitor crown and surrounding native hair density regularly.",
          "Consider preventative planning to preserve surrounding hair during candidacy review.",
        ],
        post_surgery: [
          "Consider discussing long-term hair preservation strategies with your clinician.",
          "Monitor crown and surrounding native hair density regularly.",
          "Consider preventative planning to preserve surrounding hair.",
        ],
      },
      elevated: {
        pre_surgery: [
          "Consider a dedicated long-term hair preservation discussion with your treating clinician before surgery.",
          "Review preventative options such as medication or supportive therapies with your doctor.",
          "Monitor surrounding native hair progression closely over time.",
          "Long-term planning may help reduce future density imbalance before restoration.",
        ],
        post_surgery: [
          "Consider a dedicated long-term hair preservation discussion with your treating clinician.",
          "Review preventative options such as medication or supportive therapies with your doctor.",
          "Monitor surrounding native hair progression closely over time.",
          "Long-term planning may help reduce future density imbalance.",
        ],
      },
    },
  };
}

function buildContributingFactors(args: {
  ageScore: number;
  thinningLevel: ThinningLevel;
  crown: CrownProgressionEstimate | undefined;
  patternLevel: PatternLevel;
  preservationLevel: PreservationStrategyLevel;
  labels: FutureHairLossRiskLabels;
}): string[] {
  const factors: string[] = [];
  const { labels } = args;

  if (args.ageScore >= 16) {
    factors.push(labels.contributingFactors.youngerAge);
  }
  if (args.thinningLevel === "strong" || args.thinningLevel === "moderate") {
    factors.push(labels.contributingFactors.surroundingThinning);
  }
  if (args.crown === "advanced" || args.crown === "moderate" || args.crown === "early") {
    factors.push(labels.contributingFactors.crownThinning);
  }
  if (args.preservationLevel === "none") {
    factors.push(labels.contributingFactors.noPreservationStrategy);
  }
  if (args.patternLevel === "advanced" || args.patternLevel === "moderate") {
    factors.push(labels.contributingFactors.progressivePattern);
  }

  const unique = [...new Set(factors)];
  return unique.slice(0, MAX_CONTRIBUTING_FACTORS);
}

function buildRecommendations(
  band: FutureHairLossRiskBand,
  pathway: PatientReviewPathway,
  labels: FutureHairLossRiskLabels
): string[] {
  return labels.recommendations[band][pathway].slice(0, MAX_RECOMMENDATIONS);
}

export function buildFutureHairLossProgressionRisk(
  input: FutureHairLossProgressionRiskInput,
  labels: FutureHairLossRiskLabels = buildFutureHairLossProgressionRiskLabelsEn()
): FutureHairLossRiskResult {
  const bundle = input.intelligenceBundle;
  const hairLoss = bundle?.hairLossClassification?.fields;
  const donor = bundle?.donorIntelligence?.fields;

  const age = resolvePatientAgeForRisk({
    patientAge: input.patientAge,
    summary: input.summary,
  });
  const ageScore = scoreAge(age);

  const thinningLevel = classifyVisibleThinning(
    hairLoss?.diffuseThinningPattern,
    donor?.miniaturisationSuspicion
  );
  const thinningScore = scoreVisibleThinning(thinningLevel);

  const crown = hairLoss?.crownProgression;
  const crownScore = scoreCrownProgression(crown);

  const patternLevel = classifyHairLossPattern(hairLoss?.norwoodStage);
  const patternScore = scoreHairLossPattern(patternLevel);

  const densitySignal =
    input.pathway === "post_surgery"
      ? classifyPostSurgerySurroundingDensity(
          hairLoss?.diffuseThinningPattern,
          donor?.miniaturisationSuspicion
        )
      : classifyPreSurgeryProgressionSignals(
          donor?.donorReserveRisk,
          hairLoss?.norwoodStage,
          crown
        );
  const densityScore = scoreSurroundingDensitySignal(densitySignal);

  const preservationLevel = classifyPreservationStrategy({
    clinicalHistory: input.clinicalHistory,
    summary: input.summary,
  });
  const preservationScore = scorePreservationStrategy(preservationLevel);

  const rawScore =
    ageScore + thinningScore + crownScore + patternScore + densityScore + preservationScore;
  const score = clampScore(rawScore);
  const band = resolveBand(score);
  const pathway = input.pathway === "post_surgery" ? "post_surgery" : "pre_surgery";

  return {
    score,
    band,
    summary: labels.summaries[pathway][band],
    contributingFactors: buildContributingFactors({
      ageScore,
      thinningLevel,
      crown,
      patternLevel,
      preservationLevel,
      labels,
    }),
    recommendations: buildRecommendations(band, pathway, labels),
  };
}

export function isFutureHairLossRiskResult(value: unknown): value is FutureHairLossRiskResult {
  if (!isRecord(value)) return false;
  const band = value.band;
  return (
    typeof value.score === "number" &&
    (band === "low" || band === "moderate" || band === "elevated") &&
    typeof value.summary === "string" &&
    Array.isArray(value.contributingFactors) &&
    Array.isArray(value.recommendations)
  );
}

export const FUTURE_HAIR_LOSS_RISK_CSS = `
  .futureRiskSection {
    background: #f8fafc;
    border-color: #cbd5e1;
    page-break-inside: avoid;
  }
  .futureRiskHeader {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-top: 8px;
  }
  .futureRiskBand {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
    color: var(--ink);
  }
  .futureRiskScore {
    font-size: 22px;
    font-weight: 900;
    color: #0369a1;
    letter-spacing: -0.02em;
  }
  .futureRiskSubtitle {
    margin: 8px 0 0;
    color: #475569;
    font-size: 10px;
    line-height: 1.55;
    max-width: 72ch;
  }
  .futureRiskSummary {
    margin: 12px 0 0;
    color: #0f172a;
    font-size: 11px;
    line-height: 1.55;
    max-width: 72ch;
  }
  .futureRiskColumns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 14px;
  }
  @media (max-width: 640px) {
    .futureRiskColumns { grid-template-columns: 1fr; }
  }
  .futureRiskListTitle {
    margin: 0;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
  }
  .futureRiskList {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }
  .futureRiskList li {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 10px;
    line-height: 1.45;
    color: #0f172a;
  }
  .futureRiskBullet {
    flex-shrink: 0;
    font-weight: 800;
    color: #0369a1;
  }
`;

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderFutureHairLossProgressionRiskHtml(
  result: FutureHairLossRiskResult,
  labels: FutureHairLossRiskLabels = buildFutureHairLossProgressionRiskLabelsEn()
): string {
  const factorsHtml =
    result.contributingFactors.length > 0
      ? `
      <div>
        <p class="futureRiskListTitle">${esc(labels.contributingFactorsTitle)}</p>
        <ul class="futureRiskList">
          ${result.contributingFactors
            .map(
              (item) =>
                `<li><span class="futureRiskBullet" aria-hidden="true">•</span><span>${esc(item)}</span></li>`
            )
            .join("")}
        </ul>
      </div>`
      : "";

  const recommendationsHtml =
    result.recommendations.length > 0
      ? `
      <div>
        <p class="futureRiskListTitle">${esc(labels.recommendationsTitle)}</p>
        <ul class="futureRiskList">
          ${result.recommendations
            .map(
              (item) =>
                `<li><span class="futureRiskBullet" aria-hidden="true">•</span><span>${esc(item)}</span></li>`
            )
            .join("")}
        </ul>
      </div>`
      : "";

  const columnsHtml =
    factorsHtml || recommendationsHtml
      ? `<div class="futureRiskColumns">${factorsHtml}${recommendationsHtml}</div>`
      : "";

  return `
    <div class="section futureRiskSection" data-testid="future-hair-loss-risk-section">
      <div class="sectionHead"><h2>${esc(labels.title)}</h2></div>
      <p class="futureRiskSubtitle">${esc(labels.subtitle)}</p>
      <div class="futureRiskHeader">
        <p class="futureRiskBand">${esc(labels.bandLabels[result.band])}</p>
        <div class="futureRiskScore">${result.score}%</div>
      </div>
      <p class="futureRiskSummary">${esc(result.summary)}</p>
      ${columnsHtml}
    </div>`;
}
