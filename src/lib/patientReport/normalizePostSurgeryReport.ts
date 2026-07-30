/**
 * HA-PATIENT-REPORT-UI-1B — Normalize legacy / partial Post-Surgery Audit inputs.
 * Pure helpers — do not mutate stored snapshots.
 */

import type {
  PostSurgeryAuditReport,
  PostSurgeryConcernFlag,
  PostSurgeryImageAssessment,
  PostSurgeryReviewSection,
  PostSurgeryScorecardMetric,
} from "@/lib/reports/postSurgeryAuditReport";
import type {
  PatientReportFindingEvidenceStrength,
  PatientReportPhotoGroup,
} from "@/lib/patientReport/types";
import { groupUploadsIntoPatientReportPhotos } from "@/lib/patientReport/photoGrouping";
import {
  POST_SURGERY_SECTION_DOMAIN_LABELS,
} from "@/lib/patientReport/postSurgeryPatientCopy";
import { MONTHS_BAND_LABELS_EXPORT } from "@/lib/patientReport/healingStageLabels";

export type NormalizedPostSurgeryTiming = {
  procedureDate: string | null;
  monthsSinceBand: string | null;
  stageLabel: string;
  timingKnown: boolean;
  timingLimitationCopy: string | null;
};

export type NormalizedPostSurgeryFinding = {
  sectionId: string;
  domain: string;
  observation: string;
  evidenceStrength: PatientReportFindingEvidenceStrength;
};

export type NormalizedPostSurgeryReport = {
  outcomeId: PostSurgeryAuditReport["proceduralOutcomeId"];
  repairId: PostSurgeryAuditReport["repairConsiderationId"];
  plainEnglishSummary: string;
  clinicalDisclaimer: string;
  sections: PostSurgeryReviewSection[];
  scorecards: PostSurgeryScorecardMetric[];
  concernFlags: PostSurgeryConcernFlag[];
  imageAssessments: PostSurgeryImageAssessment[];
  recommendedNextSteps: string[];
  repairPlanningGuidance: string[];
  longTermBody: string | null;
  futureRiskBody: string | null;
  hasScores: boolean;
  hasRecipientFindings: boolean;
  hasDonorFindings: boolean;
  hasDensityFindings: boolean;
  hasProceduralFindings: boolean;
  generatedAt: string | null;
};

type UploadLike = {
  id?: string;
  type?: string | null;
  storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
};

const EARLY_STAGE_BANDS = new Set([
  "under_3",
  "days_1_3",
  "days_4_7",
  "days_8_14",
  "weeks_3_8",
]);

function trimText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function strengthFromConcern(
  flags: PostSurgeryConcernFlag[],
  sectionId: string
): PatientReportFindingEvidenceStrength {
  const related = flags.filter((f) => {
    const t = f.text.toLowerCase();
    if (sectionId.includes("donor") && t.includes("donor")) return true;
    if (sectionId.includes("recipient") && (t.includes("recipient") || t.includes("hairline")))
      return true;
    if (sectionId.includes("density") && t.includes("density")) return true;
    if (sectionId.includes("extraction") && (t.includes("extraction") || t.includes("harvest")))
      return true;
    if (sectionId.includes("procedural") && t.includes("procedur")) return true;
    return false;
  });
  if (related.some((f) => f.severity === "significant" || f.severity === "elevated")) {
    return "high";
  }
  if (related.some((f) => f.severity === "moderate")) return "moderate";
  if (flags.length === 0) return "moderate";
  return "limited";
}

/**
 * Normalize timing from procedure date / months-since band without a second timing engine.
 */
export function normalizePostSurgeryTiming(input: {
  procedureDate?: string | null;
  monthsSinceBand?: string | null;
}): NormalizedPostSurgeryTiming {
  const procedureDate = trimText(input.procedureDate) || null;
  const monthsSinceBand = trimText(input.monthsSinceBand)?.toLowerCase() || null;
  const bandLabel =
    monthsSinceBand && MONTHS_BAND_LABELS_EXPORT[monthsSinceBand]
      ? MONTHS_BAND_LABELS_EXPORT[monthsSinceBand]
      : null;

  if (!procedureDate && !bandLabel) {
    return {
      procedureDate: null,
      monthsSinceBand: null,
      stageLabel: "Timing not confirmed",
      timingKnown: false,
      timingLimitationCopy:
        "Procedure timing was not available, so stage-specific interpretation is limited.",
    };
  }

  return {
    procedureDate,
    monthsSinceBand,
    stageLabel: bandLabel ?? (procedureDate ? "Procedure date on record" : "Timing not confirmed"),
    timingKnown: true,
    timingLimitationCopy: null,
  };
}

export function isEarlyPostSurgeryStage(monthsSinceBand: string | null | undefined): boolean {
  if (!monthsSinceBand) return false;
  return EARLY_STAGE_BANDS.has(monthsSinceBand.trim().toLowerCase());
}

/**
 * Normalize findings from report sections — skips empty observations.
 */
export function normalizePostSurgeryFindings(
  report: PostSurgeryAuditReport
): NormalizedPostSurgeryFinding[] {
  const flags = Array.isArray(report.concernFlags) ? report.concernFlags : [];
  const out: NormalizedPostSurgeryFinding[] = [];

  for (const section of report.sections ?? []) {
    const observation = trimText(section.finding);
    if (!observation) continue;
    const domain =
      POST_SURGERY_SECTION_DOMAIN_LABELS[section.id] ??
      section.id.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
    out.push({
      sectionId: section.id,
      domain,
      observation,
      evidenceStrength: strengthFromConcern(flags, section.id),
    });
  }

  return out;
}

/**
 * Group uploads into patient-safe photo groups. Empty when no usable photos.
 */
export function normalizePostSurgeryPhotos(uploads: UploadLike[] | null | undefined): PatientReportPhotoGroup[] {
  return groupUploadsIntoPatientReportPhotos(uploads ?? []);
}

/**
 * Read-only normalization of a stored or generated PostSurgeryAuditReport.
 * Does not mutate the input object.
 */
export function normalizePostSurgeryReportSnapshot(
  report: PostSurgeryAuditReport
): NormalizedPostSurgeryReport {
  const sections = (report.sections ?? []).filter((s) => trimText(s.finding));
  const scorecards = (report.scorecards ?? []).filter((s) => trimText(s.displayValue));
  const concernFlags = (report.concernFlags ?? []).filter((f) => trimText(f.text));
  const imageAssessments = (report.imageAssessments ?? []).filter((a) => trimText(a.assessment));
  const recommendedNextSteps = (report.recommendedNextSteps ?? [])
    .map((s) => trimText(s))
    .filter(Boolean);
  const repairPlanningGuidance = (report.repairPlanningGuidance ?? [])
    .map((s) => trimText(s))
    .filter(Boolean);

  const sectionIds = new Set(sections.map((s) => s.id));
  const plainEnglishSummary =
    trimText(report.patientSafeSummary?.plainEnglishSummary) ||
    sections.find((s) => s.id === "overall_procedure")?.finding ||
    "Your Post-Surgery Audit summary is ready for review.";

  const clinicalDisclaimer =
    trimText(report.patientSafeSummary?.clinicalDisclaimer) ||
    "This report is based on uploaded images and questionnaire answers only. It is not a medical diagnosis.";

  const longTerm = report.longTermPreservation;
  const longTermBody = longTerm
    ? [
        ...(Array.isArray(longTerm.introParagraphs) ? longTerm.introParagraphs.map(trimText) : []),
        trimText(longTerm.safetyStatement),
      ]
        .filter(Boolean)
        .join(" ") || null
    : null;

  const futureRiskBody = report.futureHairLossRisk
    ? trimText(report.futureHairLossRisk.summary) || null
    : null;

  return {
    outcomeId: report.proceduralOutcomeId,
    repairId: report.repairConsiderationId,
    plainEnglishSummary,
    clinicalDisclaimer,
    sections,
    scorecards,
    concernFlags,
    imageAssessments,
    recommendedNextSteps,
    repairPlanningGuidance,
    longTermBody,
    futureRiskBody,
    hasScores: scorecards.length > 0,
    hasRecipientFindings: sectionIds.has("recipient_area"),
    hasDonorFindings: sectionIds.has("donor_area") || sectionIds.has("extraction_pattern"),
    hasDensityFindings: sectionIds.has("density_distribution"),
    hasProceduralFindings: sectionIds.has("procedural_integrity"),
    generatedAt: trimText(report.generatedAt) || null,
  };
}

/** Strip internal-looking tokens from patient-visible text (defensive). */
export function stripInternalIdsFromPatientText(text: string): string {
  return text
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "")
    .replace(/\bsnapshot[_-]?id\b/gi, "")
    .replace(/\bstorage_path\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
