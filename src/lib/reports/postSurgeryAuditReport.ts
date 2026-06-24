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
  buildLongTermHairPreservationContent,
  isLongTermHairPreservationContent,
  type LongTermHairPreservationContent,
} from "./longTermHairPreservation";
import {
  buildFutureHairLossProgressionRisk,
  isFutureHairLossRiskResult,
  type FutureHairLossRiskResult,
} from "./futureHairLossProgressionRisk";
import {
  buildPostSurgeryRecommendedNextSteps,
  buildRepairPlanningGuidance,
  enrichSectionFinding,
  sanitizePatientReportText,
} from "./postSurgeryPatientText";
import {
  mapSeverityToConcernBand,
  normalizeForensicSeverity,
  type PatientConcernBand,
} from "./patientConcernBands";
import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";

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
  /** Long-term hair preservation educational guidance for patient PDF */
  longTermPreservation: LongTermHairPreservationContent;
  /** Deterministic future hair loss progression risk estimate */
  futureHairLossRisk: FutureHairLossRiskResult;
  /** Repair / refinement planning guidance for patient PDF */
  repairPlanningGuidance: string[];
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
  clinicalHistory?: ClinicalHistorySnapshot | null;
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
      text: sanitizePatientReportText(item.text),
      severity: mapConcernSeverity(item.concernBand ?? "needs_review", item.isRedFlag),
    });
  }

  for (const entry of patientSummary.attentionItems.slice(0, 2)) {
    if (flags.length >= 5) break;
    flags.push({
      text: sanitizePatientReportText(entry.text),
      severity: mapConcernSeverity(entry.concernBand ?? "minor", entry.isRedFlag),
    });
  }

  for (const entry of patientSummary.observations.filter((o) => o.isRedFlag).slice(0, 2)) {
    if (flags.length >= 5) break;
    const text = sanitizePatientReportText(entry.text);
    if (flags.some((f) => f.text === text)) continue;
    flags.push({
      text,
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
      text: sanitizePatientReportText(donorNote),
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
      text: sanitizePatientReportText(repairNote),
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
  const steps = buildPostSurgeryRecommendedNextSteps(repairId);

  for (const step of patientSummary.whatHappensNext.steps) {
    const cleaned = sanitizePatientReportText(step);
    if (cleaned && !steps.includes(cleaned)) steps.push(cleaned);
  }

  if (repairId === "moderate_consultation") {
    steps.push("Repair-focused consultation may be beneficial to discuss long-term planning options.");
  }
  if (repairId === "significant_planning") {
    steps.push(
      "Significant repair planning may be beneficial — discuss donor preservation before any further procedures."
    );
  }
  const donorStep = bundle?.donorIntelligence?.suggestedNextStep;
  if (donorStep) {
    const cleaned = sanitizePatientReportText(donorStep);
    if (cleaned) steps.push(cleaned);
  }

  return [...new Set(steps.map((s) => s.trim()).filter(Boolean))].slice(0, 8);
}

function canonicalPhotoLookupKey(canonical: string): string {
  const group =
    canonical.startsWith("preop_") ? "Pre-op" :
    canonical.startsWith("current_") || canonical.startsWith("patient_current_") ? "Current" :
    canonical.startsWith("postop_") ? "Post-op" :
    canonical.includes("donor") && canonical.includes("day0") ? "Day-of Donor" :
    "Other";
  const normalized = canonical.replace(/^patient_/, "").replaceAll("_", " ");
  return `${group} - ${normalized}`;
}

function pickPhoto(
  photosByCategory: Record<string, { signedUrl: string | null; label: string }[]> | undefined,
  categoryKeys: string[]
): { url: string | null; label: string | null; key: string | null } {
  if (!photosByCategory) return { url: null, label: null, key: null };

  const lookupKeys = new Set<string>();
  for (const canonical of categoryKeys) {
    lookupKeys.add(canonical);
    lookupKeys.add(canonicalPhotoLookupKey(canonical));
    lookupKeys.add(canonical.replace(/^patient_/, ""));
    lookupKeys.add(canonical.replaceAll("_", " "));
  }

  for (const key of lookupKeys) {
    const items = photosByCategory[key];
    if (!items?.length) continue;
    const withUrl = items.find((p) => p.signedUrl);
    if (withUrl?.signedUrl) {
      return { url: withUrl.signedUrl, label: withUrl.label, key };
    }
  }

  for (const [categoryKey, items] of Object.entries(photosByCategory)) {
    const normalizedCat = categoryKey.toLowerCase().replace(/-/g, " ");
    for (const canonical of categoryKeys) {
      const needle = canonical.replace(/^patient_/, "").replaceAll("_", " ").toLowerCase();
      if (!normalizedCat.includes(needle)) continue;
      const withUrl = items.find((p) => p.signedUrl);
      if (withUrl?.signedUrl) {
        return { url: withUrl.signedUrl, label: withUrl.label, key: categoryKey };
      }
    }
  }

  return { url: null, label: null, key: null };
}

export function mergePostSurgeryImageAssessmentsWithPhotos(
  assessments: PostSurgeryImageAssessment[],
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>
): PostSurgeryImageAssessment[] {
  if (!photosByCategory || !Object.keys(photosByCategory).length) return assessments;

  const frontKeys = ["patient_current_front", "preop_front", "current_front", "followup_front"];
  const donorKeys = [
    "patient_current_donor_rear",
    "preop_donor_rear",
    "current_donor_rear",
    "followup_donor",
    "postop_healed_donor",
  ];

  return assessments.map((img) => {
    if (img.imageUrl) return img;
    const keys = img.viewKey === "front" ? frontKeys : donorKeys;
    const photo = pickPhoto(photosByCategory, keys);
    if (!photo.url) return img;
    return {
      ...img,
      imageUrl: photo.url,
      imageLabel: photo.label ?? img.imageLabel,
      photoCategoryKey: photo.key ?? img.photoCategoryKey,
    };
  });
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

  const frontAssessment = sanitizePatientReportText(
    (isRecord(frontObs) ? String(frontObs.observation ?? frontObs.summary ?? "").trim() : "") ||
      defaultFront
  );
  const donorAssessment = sanitizePatientReportText(
    (isRecord(donorObs) ? String(donorObs.observation ?? donorObs.summary ?? "").trim() : "") ||
      defaultDonor
  );

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

  const summaryText =
    typeof forensic?.summary === "string" ? sanitizePatientReportText(forensic.summary.trim()) : "";
  const overallDefault = enrichSectionFinding(
    summaryText ||
      patientSummary.plainEnglishSummary ||
      "Independent review indicates generally acceptable procedural quality with areas that may benefit from continued observation.",
    {
      sectionTitle: "Overall procedure assessment",
      reviewed: "Your submitted images, clinical context, and procedural documentation were reviewed for overall execution quality.",
      observed: "The overall procedural pattern appears generally within expected ranges for a post-operative review.",
      meaning: "This suggests routine follow-up with your treating clinician remains appropriate while growth continues.",
      nextCheck: "Continue scheduled follow-up and compare progress photos over the coming months.",
    }
  );

  const donorDefault = enrichSectionFinding(
    bundle?.donorIntelligence?.patientSafeSummary?.trim() ||
      (donorScore != null && donorScore < 60
        ? "Donor region shows moderate extraction irregularity with uneven extraction distribution visible in reviewed donor zones."
        : "Donor preservation appears generally acceptable with routine long-term monitoring recommended."),
    {
      sectionTitle: "Donor area review",
      reviewed: "Donor rear and lateral views were reviewed for extraction spacing, scarring, and signs of over-harvesting.",
      observed:
        donorScore != null && donorScore < 60
          ? "Some uneven extraction distribution may be visible in reviewed donor zones."
          : "Donor appearance appears generally consistent with conservative extraction in available views.",
      meaning:
        donorScore != null && donorScore < 60
          ? "This may indicate donor reserve should be monitored carefully before any further extraction."
          : "Long-term donor sustainability appears acceptable based on available imagery.",
      nextCheck: "Ask your clinician to assess donor reserve formally if further surgery is being considered.",
    }
  );

  const extractionDefault = enrichSectionFinding(
    extractionScore != null && extractionScore < 60
      ? "Extraction patterns appear inconsistent in isolated donor regions, suggesting reduced extraction uniformity."
      : "Extraction spacing and punch distribution appear generally consistent across reviewed donor areas.",
    {
      sectionTitle: "Extraction pattern analysis",
      reviewed: "Extraction pattern uniformity, punch spacing, and visible scarring were assessed in donor imagery.",
      observed:
        extractionScore != null && extractionScore < 60
          ? "Isolated regions show inconsistent extraction spacing or visible clustering."
          : "Extraction spacing appears generally even across the reviewed donor areas.",
      meaning:
        extractionScore != null && extractionScore < 60
          ? "Irregular extraction may affect future donor flexibility and should be discussed with your clinician."
          : "Consistent extraction patterns support better long-term donor management.",
      nextCheck: "Request donor mapping if repair or further extraction is planned.",
    }
  );

  const densityDefault = enrichSectionFinding(
    bundle?.proceduralIntelligence?.patientSafeSummary?.trim() ||
      (densityScore != null && densityScore < 60
        ? "Recipient density distribution shows moderate variation in frontal density concentration."
        : "Recipient density distribution appears generally consistent with moderate variation in frontal density concentration."),
    {
      sectionTitle: "Density distribution review",
      reviewed: "Frontal and recipient-zone imagery was reviewed for density distribution relative to stated graft counts.",
      observed:
        densityScore != null && densityScore < 60
          ? "Density appears variable across frontal zones in available views."
          : "Density distribution appears generally even for the growth stage visible in submitted photos.",
      meaning:
        "Final density assessment often requires adequate maturation time — early views may not reflect final outcome.",
      nextCheck: "Continue interval photos and revisit density expectations at your follow-up appointments.",
    }
  );

  const recipientDefault = enrichSectionFinding(
    buildSectionFinding(
      recipientScore != null && recipientScore < 60
        ? "Recipient area demonstrates acceptable placement symmetry with mild density inconsistency in frontal zones."
        : "Recipient area demonstrates acceptable placement symmetry with density patterns within expected ranges.",
      ["recipient", "hairline", "hairline", "placement", "frontal"],
      findings
    ),
    {
      sectionTitle: "Recipient area assessment",
      reviewed: "Recipient-zone and hairline views were reviewed for placement symmetry, direction, and natural appearance.",
      observed:
        recipientScore != null && recipientScore < 60
          ? "Mild density or symmetry variation may be visible in frontal zones."
          : "Placement symmetry and hairline contour appear generally acceptable in available views.",
      meaning: "Recipient appearance should be interpreted in context of your growth timeline and stated graft plan.",
      nextCheck: "Discuss hairline design and density goals with your clinician at follow-up.",
    }
  );

  const integrityDefault = enrichSectionFinding(
    bundle?.proceduralIntelligence?.patientSafeSummary?.trim() ||
      "Overall procedural execution appears acceptable with evidence suggesting conservative donor preservation should remain a priority.",
    {
      sectionTitle: "Procedural integrity review",
      reviewed: "Available documentation and imagery were reviewed for procedural consistency and handling quality.",
      observed: "Procedural handling appears generally consistent with acceptable standards in submitted materials.",
      meaning: "Some fine procedural details cannot always be confirmed from photos alone.",
      nextCheck: "Discuss any specific procedural questions with your treating team using this report as reference.",
    }
  );

  const longTermDefault = enrichSectionFinding(
    bundle?.donorIntelligence?.fields?.donorReserveRisk === "elevated"
      ? "Current donor preservation patterns may reduce future extraction flexibility if additional surgery is required."
      : "Long-term donor sustainability appears acceptable based on available imagery — continued monitoring is recommended.",
    {
      sectionTitle: "Long-term risk assessment",
      reviewed: "Donor reserve, scarring, and procedural patterns were considered for long-term restoration planning.",
      observed:
        bundle?.donorIntelligence?.fields?.donorReserveRisk === "elevated"
          ? "Patterns suggest donor reserve may be more limited for future procedures."
          : "No major long-term donor concerns were identified from available materials.",
      meaning: "Future restoration options depend heavily on preserved donor capacity and realistic density goals.",
      nextCheck: "Review long-term planning with your clinician before committing to further surgery.",
    }
  );

  const repairDefault = enrichSectionFinding(
    (() => {
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
    })(),
    {
      sectionTitle: "Repair considerations",
      reviewed: "Findings were reviewed for implications on future refinement or repair planning.",
      observed:
        repairId === "no_repair_concerns" || repairId === "minor_observation"
          ? "No immediate repair indicators were identified from available materials."
          : "Some patterns may benefit from structured repair or refinement planning.",
      meaning: "Repair decisions should balance aesthetic goals with donor preservation and realistic expectations.",
      nextCheck: "Seek a repair consultation with donor mapping if refinement is being considered.",
    }
  );

  return [
    { id: "overall_procedure", finding: overallDefault },
    {
      id: "donor_area",
      finding: enrichSectionFinding(
        buildSectionFinding(donorDefault, ["donor", "extraction", "harvest"], findings),
        {
          sectionTitle: "Donor area review",
          reviewed: "Donor rear and lateral views were reviewed for extraction spacing, scarring, and signs of over-harvesting.",
          observed: donorDefault,
          meaning: "Donor health is central to any future restoration planning.",
          nextCheck: "Monitor donor appearance over time and discuss reserve with your clinician.",
        }
      ),
    },
    {
      id: "extraction_pattern",
      finding: enrichSectionFinding(
        buildSectionFinding(extractionDefault, ["extraction", "punch", "spacing"], findings),
        {
          sectionTitle: "Extraction pattern analysis",
          reviewed: "Extraction pattern uniformity and punch distribution were assessed.",
          observed: extractionDefault,
          meaning: "Even extraction supports better long-term outcomes.",
          nextCheck: "Confirm punch size and extraction method details with your clinic if unclear.",
        }
      ),
    },
    {
      id: "density_distribution",
      finding: enrichSectionFinding(
        buildSectionFinding(densityDefault, ["density", "spacing", "graft"], findings),
        {
          sectionTitle: "Density distribution review",
          reviewed: "Recipient density distribution was assessed relative to available views.",
          observed: densityDefault,
          meaning: "Density should be interpreted within your growth timeline.",
          nextCheck: "Reassess density expectations after adequate maturation.",
        }
      ),
    },
    { id: "recipient_area", finding: recipientDefault },
    {
      id: "procedural_integrity",
      finding: enrichSectionFinding(
        buildSectionFinding(integrityDefault, ["procedural", "integrity", "execution"], findings),
        {
          sectionTitle: "Procedural integrity review",
          reviewed: "Procedural handling and execution consistency were reviewed.",
          observed: integrityDefault,
          meaning: "Photo-based review has inherent limits for fine procedural detail.",
          nextCheck: "Raise specific procedural questions with your treating team.",
        }
      ),
    },
    {
      id: "long_term_risk",
      finding: enrichSectionFinding(
        buildSectionFinding(longTermDefault, ["long-term", "future", "reserve", "sustainability"], findings),
        {
          sectionTitle: "Long-term risk assessment",
          reviewed: "Long-term donor and restoration risks were considered.",
          observed: longTermDefault,
          meaning: "Early planning protects future options.",
          nextCheck: "Discuss long-term goals and donor reserve at follow-up.",
        }
      ),
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
          forensic_audit: forensic,
        }
      : input.summary,
    { patientReviewPathway: pathway, clinicalHistory: input.clinicalHistory ?? null }
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
  const longTermPreservation = buildLongTermHairPreservationContent("post_surgery");
  const futureHairLossRisk = buildFutureHairLossProgressionRisk({
    pathway: "post_surgery",
    intelligenceBundle: bundle,
    clinicalHistory: input.clinicalHistory ?? null,
    summary: input.summary,
  });
  const repairPlanningGuidance = buildRepairPlanningGuidance(bundle, repairConsiderationId);

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
    longTermPreservation,
    futureHairLossRisk,
    repairPlanningGuidance,
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
    clinicalHistory?: ClinicalHistorySnapshot | null;
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
    const merged = {
      ...stored,
      imageAssessments: mergePostSurgeryImageAssessmentsWithPhotos(
        stored.imageAssessments,
        opts.photosByCategory
      ),
      longTermPreservation: isLongTermHairPreservationContent(stored.longTermPreservation)
        ? stored.longTermPreservation
        : buildLongTermHairPreservationContent("post_surgery"),
      futureHairLossRisk: isFutureHairLossRiskResult(stored.futureHairLossRisk)
        ? stored.futureHairLossRisk
        : buildFutureHairLossProgressionRisk({
            pathway: "post_surgery",
            intelligenceBundle:
              isRecord(summary?.metadata) &&
              isRecord((summary.metadata as Record<string, unknown>).hairAuditIntelligence)
                ? ((summary.metadata as Record<string, unknown>)
                    .hairAuditIntelligence as HairAuditIntelligenceBundle)
                : null,
            clinicalHistory: opts.clinicalHistory ?? null,
            summary: summary ?? undefined,
          }),
      repairPlanningGuidance:
        stored.repairPlanningGuidance?.length
          ? stored.repairPlanningGuidance
          : buildRepairPlanningGuidance(
              null,
              stored.repairConsiderationId ?? "no_repair_concerns"
            ),
    };
    return merged;
  }

  if (!summary) return null;

  return generatePostSurgeryAuditReport({
    summary,
    caseId: opts.caseId,
    reportVersion: opts.reportVersion,
    patientReviewPathway: pathway,
    photosByCategory: opts.photosByCategory,
    clinicalHistory: opts.clinicalHistory ?? null,
  });
}

export function shouldUsePostSurgeryReportTemplate(
  pathway: PatientReviewPathway | unknown,
  auditMode?: string | null
): boolean {
  return normalizePatientReviewPathway(pathway) === "post_surgery" && auditMode === "patient";
}
