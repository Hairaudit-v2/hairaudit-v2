/**
 * HA-REPORT-4B — Independent post-surgery procedural review report.
 * Separate from pre-surgery reporting; patient-safe language only.
 */

import type { HairAuditIntelligenceBundle } from "@/lib/hairaudit-intelligence/types";
import {
  normalizePatientReviewPathway,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import {
  buildPatientSafeReportSummary,
  type PatientSafeReportSummary,
} from "./patientSafeSummary";
import {
  mapSeverityToConcernBand,
  normalizeForensicSeverity,
  type PatientConcernBand,
} from "./patientConcernBands";

export const POST_SURGERY_AUDIT_REPORT_VERSION = 1 as const;

export type PostSurgeryConcernSeverity = "low" | "moderate" | "elevated" | "significant";

export type PostSurgeryProceduralOutcomeId =
  | "strong_outcome"
  | "moderate_concerns"
  | "donor_preservation_concerns"
  | "significant_concerns";

export type PostSurgeryRepairConsiderationId =
  | "no_repair_concerns"
  | "minor_observation"
  | "moderate_consultation"
  | "significant_planning";

export type PostSurgeryQualitativeBand = "good" | "moderate" | "concerning" | "strong" | "needs_monitoring";

export type PostSurgeryScorecardMetricId =
  | "donor_preservation"
  | "extraction_pattern"
  | "density_distribution"
  | "recipient_area"
  | "healing_quality"
  | "repair_probability";

export type PostSurgeryReviewSectionId =
  | "overall_procedure"
  | "donor_area"
  | "extraction_pattern"
  | "density_distribution"
  | "recipient_area"
  | "procedural_integrity"
  | "long_term_risk"
  | "repair_considerations";

export type PostSurgeryScorecardMetric = {
  id: PostSurgeryScorecardMetricId;
  /** Percentage 0–100 when numeric presentation is appropriate */
  percentScore?: number | null;
  /** Qualitative label for non-percent metrics */
  qualitativeLabel?: string | null;
  displayValue: string;
};

export type PostSurgeryReviewSection = {
  id: PostSurgeryReviewSectionId;
  finding: string;
};

export type PostSurgeryConcernFlag = {
  text: string;
  severity: PostSurgeryConcernSeverity;
};

export type PostSurgeryImageAssessment = {
  viewKey: "front" | "donor";
  photoCategoryKey?: string | null;
  imageUrl?: string | null;
  imageLabel?: string | null;
  assessment: string;
};

export type PostSurgeryAuditReport = {
  version: typeof POST_SURGERY_AUDIT_REPORT_VERSION;
  pathway: "post_surgery";
  reportId: string;
  generatedAt: string;
  proceduralOutcomeId: PostSurgeryProceduralOutcomeId;
  repairConsiderationId: PostSurgeryRepairConsiderationId;
  scorecards: PostSurgeryScorecardMetric[];
  sections: PostSurgeryReviewSection[];
  concernFlags: PostSurgeryConcernFlag[];
  imageAssessments: PostSurgeryImageAssessment[];
  recommendedNextSteps: string[];
  /** Embedded patient-safe summary for backward-compatible surfaces */
  patientSafeSummary: PatientSafeReportSummary;
};

export type GeneratePostSurgeryAuditReportInput = {
  summary: Record<string, unknown>;
  intelligenceBundle?: HairAuditIntelligenceBundle | null;
  caseId: string;
  reportVersion?: number;
  patientReviewPathway?: PatientReviewPathway | unknown;
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function avg(nums: number[]): number | null {
  const valid = nums.filter((n) => Number.isFinite(n));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function scoreFromSectionScores(
  forensic: Record<string, unknown> | null,
  keys: string[]
): number | null {
  const sections = isRecord(forensic?.section_scores) ? (forensic.section_scores as Record<string, unknown>) : null;
  if (!sections) return null;
  const values = keys
    .map((k) => Number(sections[k]))
    .filter((n) => Number.isFinite(n));
  if (!values.length) return null;
  return avg(values);
}

function formatPercent(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "Under review";
  return `${clampScore(score)}%`;
}

function recipientQualitative(score: number | null): PostSurgeryQualitativeBand {
  if (score == null) return "moderate";
  if (score >= 75) return "good";
  if (score >= 55) return "moderate";
  return "concerning";
}

function healingQualitative(score: number | null): PostSurgeryQualitativeBand {
  if (score == null) return "moderate";
  if (score >= 75) return "strong";
  if (score >= 55) return "moderate";
  return "needs_monitoring";
}

function repairProbabilityLabel(
  bundle: HairAuditIntelligenceBundle | null | undefined,
  concernBand: PatientConcernBand
): { label: string; band: "low" | "moderate" | "elevated" } {
  const complexity = bundle?.repairSurgery?.fields?.repairComplexityBand;
  if (complexity === "high") return { label: "Elevated", band: "elevated" };
  if (complexity === "moderate" || concernBand === "significant" || concernBand === "urgent") {
    return { label: "Moderate", band: "moderate" };
  }
  if (concernBand === "needs_review") return { label: "Moderate", band: "moderate" };
  return { label: "Low", band: "low" };
}

function deriveProceduralOutcome(
  donorScore: number | null,
  overallScore: number | null,
  concernBand: PatientConcernBand,
  bundle: HairAuditIntelligenceBundle | null | undefined
): PostSurgeryProceduralOutcomeId {
  const donorRisk = bundle?.donorIntelligence?.fields?.donorReserveRisk;
  const overharvest = bundle?.repairSurgery?.fields?.overharvestingIndicators;

  if (
    concernBand === "urgent" ||
    concernBand === "significant" ||
    (donorScore != null && donorScore < 50) ||
    donorRisk === "elevated" ||
    overharvest === "likely"
  ) {
    return "donor_preservation_concerns";
  }
  if (
    concernBand === "needs_review" ||
    (overallScore != null && overallScore < 65) ||
    donorRisk === "moderate" ||
    overharvest === "possible"
  ) {
    return "moderate_concerns";
  }
  if (
    overallScore != null &&
    overallScore >= 75 &&
    (concernBand === "none" || concernBand === "minor")
  ) {
    return "strong_outcome";
  }
  if (overallScore != null && overallScore >= 70) return "strong_outcome";
  return "moderate_concerns";
}

function deriveRepairConsideration(
  bundle: HairAuditIntelligenceBundle | null | undefined,
  concernBand: PatientConcernBand
): PostSurgeryRepairConsiderationId {
  const complexity = bundle?.repairSurgery?.fields?.repairComplexityBand;
  if (complexity === "high" || concernBand === "urgent") return "significant_planning";
  if (complexity === "moderate" || concernBand === "significant") return "moderate_consultation";
  if (concernBand === "needs_review" || concernBand === "minor") return "minor_observation";
  return "no_repair_concerns";
}

function mapConcernSeverity(
  band: PatientConcernBand,
  isRedFlag?: boolean
): PostSurgeryConcernSeverity {
  if (band === "urgent" || band === "significant") return isRedFlag ? "significant" : "elevated";
  if (band === "needs_review") return "moderate";
  return "low";
}

function extractFindingText(entry: unknown): string {
  if (typeof entry === "string") return entry.trim();
  if (!isRecord(entry)) return "";
  const title = String(entry.title ?? entry.flag ?? "").trim();
  return title;
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
    if (keywords.some((k) => lower.includes(k))) return text;
  }
  return defaultText;
}

function buildConcernFlags(
  patientSummary: PatientSafeReportSummary,
  bundle: HairAuditIntelligenceBundle | null | undefined
): PostSurgeryConcernFlag[] {
  const flags: PostSurgeryConcernFlag[] = [];

  for (const item of patientSummary.concernItems.slice(0, 4)) {
    flags.push({
      text: item.text,
      severity: mapConcernSeverity(item.concernBand ?? "needs_review", item.isRedFlag),
    });
  }

  for (const entry of patientSummary.attentionItems.slice(0, 2)) {
    if (flags.length >= 5) break;
    flags.push({
      text: entry.text,
      severity: mapConcernSeverity(entry.concernBand ?? "minor", entry.isRedFlag),
    });
  }

  for (const entry of patientSummary.observations.filter((o) => o.isRedFlag).slice(0, 2)) {
    if (flags.length >= 5) break;
    if (flags.some((f) => f.text === entry.text)) continue;
    flags.push({
      text: entry.text,
      severity: mapConcernSeverity(entry.concernBand ?? "needs_review", true),
    });
  }

  const donorNote = bundle?.donorIntelligence?.patientSafeSummary?.trim();
  if (
    donorNote &&
    flags.length < 5 &&
    (bundle?.donorIntelligence?.severity === "moderate" ||
      bundle?.donorIntelligence?.severity === "significant" ||
      bundle?.donorIntelligence?.severity === "critical")
  ) {
    flags.push({
      text: donorNote,
      severity: mapConcernSeverity(
        mapSeverityToConcernBand(
          normalizeForensicSeverity(bundle.donorIntelligence.severity === "critical" ? "critical" : "high")
        )
      ),
    });
  }

  const repairNote = bundle?.repairSurgery?.patientSafeSummary?.trim();
  if (
    repairNote &&
    flags.length < 5 &&
    bundle?.repairSurgery?.fields?.repairComplexityBand !== "low"
  ) {
    flags.push({
      text: repairNote,
      severity:
        bundle?.repairSurgery?.fields?.repairComplexityBand === "high" ? "significant" : "moderate",
    });
  }

  return flags.slice(0, 5);
}

function buildRecommendedNextSteps(
  patientSummary: PatientSafeReportSummary,
  repairId: PostSurgeryRepairConsiderationId,
  bundle: HairAuditIntelligenceBundle | null | undefined
): string[] {
  const steps = [...patientSummary.whatHappensNext.steps];

  if (repairId === "moderate_consultation") {
    steps.push("Repair-focused consultation may be beneficial to discuss long-term planning options.");
  }
  if (repairId === "significant_planning") {
    steps.push("Significant repair planning may be beneficial — discuss donor preservation before any further procedures.");
  }
  if (bundle?.donorIntelligence?.suggestedNextStep) {
    steps.push(bundle.donorIntelligence.suggestedNextStep);
  }

  const unique = [...new Set(steps.map((s) => s.trim()).filter(Boolean))];
  return unique.slice(0, 6);
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
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>
): PostSurgeryImageAssessment[] {
  const photoObs = Array.isArray(forensic?.photo_observations) ? forensic.photo_observations : [];
  const frontObs = photoObs.find((p) => {
    if (!isRecord(p)) return false;
    const cat = String(p.category ?? p.view ?? "").toLowerCase();
    return cat.includes("front") || cat.includes("recipient");
  });
  const donorObs = photoObs.find((p) => {
    if (!isRecord(p)) return false;
    const cat = String(p.category ?? p.view ?? "").toLowerCase();
    return cat.includes("donor") || cat.includes("rear");
  });

  const frontPhoto = pickPhoto(photosByCategory, [
    "patient_current_front",
    "preop_front",
    "current_front",
    "followup_front",
  ]);
  const donorPhoto = pickPhoto(photosByCategory, [
    "patient_current_donor_rear",
    "preop_donor_rear",
    "current_donor_rear",
    "followup_donor",
  ]);

  const defaultFront =
    bundle?.proceduralIntelligence?.patientSafeSummary?.trim() ||
    "Recipient views were reviewed for density distribution and placement uniformity relative to your stated graft count.";
  const defaultDonor =
    bundle?.donorIntelligence?.patientSafeSummary?.trim() ||
    "Donor views were reviewed for extraction pattern consistency and signs of uneven harvesting.";

  const frontAssessment =
    (isRecord(frontObs) ? String(frontObs.observation ?? frontObs.summary ?? "").trim() : "") ||
    defaultFront;
  const donorAssessment =
    (isRecord(donorObs) ? String(donorObs.observation ?? donorObs.summary ?? "").trim() : "") ||
    defaultDonor;

  return [
    {
      viewKey: "front",
      photoCategoryKey: frontPhoto.key,
      imageUrl: frontPhoto.url,
      imageLabel: frontPhoto.label ?? "Front view",
      assessment: frontAssessment,
    },
    {
      viewKey: "donor",
      photoCategoryKey: donorPhoto.key,
      imageUrl: donorPhoto.url,
      imageLabel: donorPhoto.label ?? "Donor view",
      assessment: donorAssessment,
    },
  ];
}

function buildReviewSections(
  forensic: Record<string, unknown> | null,
  bundle: HairAuditIntelligenceBundle | null | undefined,
  patientSummary: PatientSafeReportSummary,
  donorScore: number | null,
  extractionScore: number | null,
  densityScore: number | null,
  recipientScore: number | null,
  repairId: PostSurgeryRepairConsiderationId
): PostSurgeryReviewSection[] {
  const findings = [
    ...(Array.isArray(forensic?.key_findings) ? forensic.key_findings : []),
    ...(Array.isArray(forensic?.red_flags) ? forensic.red_flags : []),
  ];

  const summaryText = typeof forensic?.summary === "string" ? forensic.summary.trim() : "";
  const overallDefault =
    summaryText ||
    patientSummary.plainEnglishSummary ||
    "Independent review indicates generally acceptable procedural quality with areas that may benefit from continued observation.";

  const donorDefault =
    bundle?.donorIntelligence?.patientSafeSummary?.trim() ||
    (donorScore != null && donorScore < 60
      ? "Donor region shows moderate extraction irregularity with uneven extraction distribution visible in reviewed donor zones."
      : "Donor preservation appears generally acceptable with routine long-term monitoring recommended.");

  const extractionDefault =
    extractionScore != null && extractionScore < 60
      ? "Extraction patterns appear inconsistent in isolated donor regions, suggesting reduced extraction uniformity."
      : "Extraction spacing and punch distribution appear generally consistent across reviewed donor areas.";

  const densityDefault =
    bundle?.proceduralIntelligence?.patientSafeSummary?.trim() ||
    (densityScore != null && densityScore < 60
      ? "Recipient density distribution shows moderate variation in frontal density concentration."
      : "Recipient density distribution appears generally consistent with moderate variation in frontal density concentration.");

  const recipientDefault = buildSectionFinding(
    recipientScore != null && recipientScore < 60
      ? "Recipient area demonstrates acceptable placement symmetry with mild density inconsistency in frontal zones."
      : "Recipient area demonstrates acceptable placement symmetry with density patterns within expected ranges.",
    ["recipient", "hairline", "placement", "frontal"],
    findings
  );

  const integrityDefault =
    bundle?.proceduralIntelligence?.clinicianNotes?.trim() ||
    "Overall procedural execution appears acceptable with evidence suggesting conservative donor preservation should remain a priority.";

  const longTermDefault =
    bundle?.donorIntelligence?.fields?.donorReserveRisk === "elevated"
      ? "Current donor preservation patterns may reduce future extraction flexibility if additional surgery is required."
      : "Long-term donor sustainability appears acceptable based on available imagery — continued monitoring is recommended.";

  const repairDefault = (() => {
    switch (repairId) {
      case "no_repair_concerns":
        return "Current findings suggest no immediate repair concerns, though long-term donor preservation should be monitored.";
      case "minor_observation":
        return "Minor concerns were identified that warrant observation rather than immediate repair planning.";
      case "moderate_consultation":
        return "Moderate repair consultation may be beneficial to discuss density refinement and donor reserve.";
      case "significant_planning":
        return "Significant repair planning may be beneficial given donor and density patterns observed in this review.";
      default:
        return "Repair considerations should be discussed with a qualified clinician if future procedures are planned.";
    }
  })();

  return [
    { id: "overall_procedure", finding: overallDefault },
    {
      id: "donor_area",
      finding: buildSectionFinding(donorDefault, ["donor", "extraction", "harvest"], findings),
    },
    {
      id: "extraction_pattern",
      finding: buildSectionFinding(extractionDefault, ["extraction", "punch", "spacing"], findings),
    },
    {
      id: "density_distribution",
      finding: buildSectionFinding(densityDefault, ["density", "spacing", "graft"], findings),
    },
    { id: "recipient_area", finding: recipientDefault },
    {
      id: "procedural_integrity",
      finding: buildSectionFinding(integrityDefault, ["procedural", "integrity", "execution"], findings),
    },
    {
      id: "long_term_risk",
      finding: buildSectionFinding(longTermDefault, ["long-term", "future", "reserve", "sustainability"], findings),
    },
    { id: "repair_considerations", finding: repairDefault },
  ];
}

/**
 * Build the post-surgery audit report from forensic summary + intelligence bundle.
 */
export function generatePostSurgeryAuditReport(
  input: GeneratePostSurgeryAuditReportInput
): PostSurgeryAuditReport {
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

  const donorScore = scoreFromSectionScores(forensic, ["donor_management"]);
  const extractionScore = scoreFromSectionScores(forensic, ["extraction_quality"]);
  const densityScore = scoreFromSectionScores(forensic, ["density_distribution"]);
  const recipientScore = scoreFromSectionScores(forensic, [
    "recipient_placement",
    "hairline_design",
    "naturalness_and_aesthetics",
  ]);
  const healingScore = scoreFromSectionScores(forensic, ["post_op_course_and_aftercare"]);

  const overallScore = Number.isFinite(Number(forensic?.overall_score))
    ? Number(forensic?.overall_score)
    : avg(
        [donorScore, extractionScore, densityScore, recipientScore, healingScore].filter(
          (n): n is number => n != null
        )
      );

  const concernBand = patientSafeSummary.overallConcernBand;
  const proceduralOutcomeId = deriveProceduralOutcome(
    donorScore,
    overallScore,
    concernBand,
    bundle
  );
  const repairConsiderationId = deriveRepairConsideration(bundle, concernBand);
  const repairProb = repairProbabilityLabel(bundle, concernBand);

  const recipientBand = recipientQualitative(recipientScore);
  const healingBand = healingQualitative(healingScore);

  const scorecards: PostSurgeryScorecardMetric[] = [
    {
      id: "donor_preservation",
      percentScore: donorScore,
      displayValue: formatPercent(donorScore),
    },
    {
      id: "extraction_pattern",
      percentScore: extractionScore,
      displayValue: formatPercent(extractionScore),
    },
    {
      id: "density_distribution",
      percentScore: densityScore,
      displayValue: formatPercent(densityScore),
    },
    {
      id: "recipient_area",
      qualitativeLabel: recipientBand,
      displayValue:
        recipientBand === "good"
          ? "Good"
          : recipientBand === "moderate"
            ? "Moderate"
            : "Concerning",
    },
    {
      id: "healing_quality",
      qualitativeLabel: healingBand,
      displayValue:
        healingBand === "strong"
          ? "Strong"
          : healingBand === "moderate"
            ? "Moderate"
            : "Needs monitoring",
    },
    {
      id: "repair_probability",
      qualitativeLabel: repairProb.band,
      displayValue: repairProb.label,
    },
  ];

  const sections = buildReviewSections(
    forensic,
    bundle,
    patientSafeSummary,
    donorScore,
    extractionScore,
    densityScore,
    recipientScore,
    repairConsiderationId
  );

  const concernFlags = buildConcernFlags(patientSafeSummary, bundle);
  const imageAssessments = buildImageAssessments(forensic, bundle, input.photosByCategory);
  const recommendedNextSteps = buildRecommendedNextSteps(
    patientSafeSummary,
    repairConsiderationId,
    bundle
  );

  const version = input.reportVersion ?? 1;
  const reportId = `${input.caseId}-v${version}`;

  return {
    version: POST_SURGERY_AUDIT_REPORT_VERSION,
    pathway: "post_surgery",
    reportId,
    generatedAt: new Date().toISOString(),
    proceduralOutcomeId,
    repairConsiderationId,
    scorecards,
    sections,
    concernFlags,
    imageAssessments,
    recommendedNextSteps,
    patientSafeSummary,
  };
}

export function isPostSurgeryAuditReport(value: unknown): value is PostSurgeryAuditReport {
  if (!isRecord(value)) return false;
  return (
    value.pathway === "post_surgery" &&
    value.version === POST_SURGERY_AUDIT_REPORT_VERSION &&
    Array.isArray(value.scorecards) &&
    Array.isArray(value.sections)
  );
}

/**
 * Resolve stored report or generate on demand for legacy summaries.
 */
export function resolvePostSurgeryAuditReport(
  summary: Record<string, unknown> | null | undefined,
  opts: {
    caseId: string;
    reportVersion?: number;
    patientReviewPathway?: PatientReviewPathway | unknown;
    photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
  }
): PostSurgeryAuditReport | null {
  const pathway = normalizePatientReviewPathway(
    opts.patientReviewPathway ??
      summary?.patient_review_pathway ??
      (isRecord(summary?.metadata) ? summary.metadata.patientReviewPathway : undefined)
  );
  if (pathway !== "post_surgery") return null;

  const stored = summary?.post_surgery_audit_report;
  if (isPostSurgeryAuditReport(stored)) {
    return stored;
  }

  if (!summary) return null;

  return generatePostSurgeryAuditReport({
    summary,
    caseId: opts.caseId,
    reportVersion: opts.reportVersion,
    patientReviewPathway: pathway,
    photosByCategory: opts.photosByCategory,
  });
}

export function shouldUsePostSurgeryReportTemplate(
  pathway: PatientReviewPathway | unknown,
  auditMode?: string | null
): boolean {
  return normalizePatientReviewPathway(pathway) === "post_surgery" && auditMode === "patient";
}
