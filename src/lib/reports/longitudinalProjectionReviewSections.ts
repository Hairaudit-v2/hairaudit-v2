/**
 * HA-PROJECTION-1G — Patient-safe section helpers for longitudinal projection review.
 *
 * Presentation mapping only. Does not recalculate 1F comparison statuses.
 */

import type {
  ComparisonConfidence,
  LongitudinalOutcomeStage,
  LongitudinalOutcomeObservation,
  ProjectedOutcomeDomain,
  ProjectionComparisonStatus,
  ProjectionConfidence,
  ObservationConfidence,
  SurgeryDayProcedureReconstruction,
  SurgeryDayProjectedOutcome,
} from "@/lib/projection/types";
import {
  buildTreatmentAreaRows,
  formatConfidenceLabel,
  type ConfidenceDisplay,
  type TreatmentAreaRow,
} from "./surgeryDayProjectionSections";

export type PatientComparisonStatusLabel =
  | "Broadly consistent"
  | "Partially consistent"
  | "Different from original projection"
  | "Not yet assessable"
  | "More evidence needed";

export type PatientOverallComparisonLabel =
  | "Broadly consistent"
  | "Mixed / partially consistent"
  | "Some characteristics differ from the original projection"
  | "Too early for overall comparison"
  | "More evidence needed for comparison";

export type LongitudinalDomainTitle =
  | "Frontal Framing"
  | "Density Distribution"
  | "Transition Characteristics"
  | "Native Hair Dependency"
  | "Untreated / Lower-Treatment Areas";

export type TimelineStageEntry = {
  stage: LongitudinalOutcomeStage | "surgery_day";
  label: string;
  description: string;
  captured: boolean;
  isCurrent: boolean;
};

export type NextReviewRecommendation = {
  label: string;
  description: string;
};

export type LongitudinalImagePair = {
  viewLabel: string;
  surgeryDay: { url: string; label: string } | null;
  followUp: { url: string; label: string } | null;
};

export type LongitudinalImageGroup = {
  id: "preoperative_baseline" | "surgery_day" | "follow_up" | "side_by_side";
  title: string;
  images: Array<{ url: string; label: string }>;
  pairs?: LongitudinalImagePair[];
};

export const LONGITUDINAL_REVIEW_CONFIDENCE_EXPLANATION =
  "Confidence reflects evidence quality, completeness and stage suitability, not the probability of a successful outcome.";

export const LONGITUDINAL_REVIEW_NOTICE =
  "This review compares the characteristics documented in your original surgery-day projection with what can be observed in your current follow-up evidence. It does not measure graft survival or determine surgical success.";

export const EARLY_STAGE_ASSESSABILITY_NOTICE =
  "Some projected characteristics cannot yet be fairly assessed because hair growth and maturation are still developing.";

export const MONTH3_NORMAL_NOTICE =
  "At Month 3, several cosmetic characteristics are still too early to assess reliably. This is expected at this stage.";

export const IMAGE_COMPARISON_CAVEAT =
  "Visual comparisons can be influenced by lighting, angle, hair length and styling. HairAudit uses submitted images as supporting evidence rather than treating photographs as exact calibrated measurements.";

export const LONGITUDINAL_CLINICAL_DISCLAIMER =
  "This longitudinal projection review is an independent educational comparison of frozen surgery-day projection characteristics with submitted follow-up evidence. It is not a medical diagnosis or treatment plan, does not measure graft survival, and does not determine surgical success. Discuss healing concerns and ongoing care with your treating clinic.";

/** Preferred domain card order — only render domains present in frozen 1F. */
export const LONGITUDINAL_DOMAIN_ORDER: readonly ProjectedOutcomeDomain[] = [
  "frontal_framing",
  "density_distribution",
  "transition_characteristics",
  "native_hair_dependency",
  "untreated_or_lower_treatment_areas",
] as const;

const DOMAIN_TITLES: Record<ProjectedOutcomeDomain, LongitudinalDomainTitle> = {
  frontal_framing: "Frontal Framing",
  density_distribution: "Density Distribution",
  transition_characteristics: "Transition Characteristics",
  native_hair_dependency: "Native Hair Dependency",
  untreated_or_lower_treatment_areas: "Untreated / Lower-Treatment Areas",
};

export function mapDomainTitle(domain: ProjectedOutcomeDomain): LongitudinalDomainTitle {
  return DOMAIN_TITLES[domain];
}

export function mapComparisonStatusLabel(
  status: ProjectionComparisonStatus
): PatientComparisonStatusLabel {
  switch (status) {
    case "consistent":
      return "Broadly consistent";
    case "partially_consistent":
      return "Partially consistent";
    case "divergent":
      return "Different from original projection";
    case "not_yet_assessable":
      return "Not yet assessable";
    case "insufficient_evidence":
      return "More evidence needed";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function mapOverallComparisonLabel(
  status: ProjectionComparisonStatus
): PatientOverallComparisonLabel {
  switch (status) {
    case "consistent":
      return "Broadly consistent";
    case "partially_consistent":
      return "Mixed / partially consistent";
    case "divergent":
      return "Some characteristics differ from the original projection";
    case "not_yet_assessable":
      return "Too early for overall comparison";
    case "insufficient_evidence":
      return "More evidence needed for comparison";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function formatStageLabel(stage: LongitudinalOutcomeStage): string {
  switch (stage) {
    case "month_3":
      return "Month 3";
    case "month_6":
      return "Month 6";
    case "month_9":
      return "Month 9";
    case "month_12":
      return "Month 12";
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

export function formatStageSubtitle(stage: LongitudinalOutcomeStage): string {
  return `${formatStageLabel(stage)} Review`;
}

export function formatObservedAtLabel(stage: LongitudinalOutcomeStage): string {
  return `Observed at ${formatStageLabel(stage)}`;
}

/**
 * Presentation-only overall comparison confidence from frozen 1F domain confidences.
 * Does not invent a new score — surfaces existing domain confidences as one display label.
 */
export function deriveComparisonConfidenceDisplay(
  domainConfidences: ComparisonConfidence[]
): ConfidenceDisplay {
  if (!domainConfidences.length) return "Low";
  if (domainConfidences.every((c) => c === "high")) return "High";
  if (domainConfidences.some((c) => c === "low")) return "Low";
  return "Moderate";
}

export function formatTrioConfidence(
  value: ProjectionConfidence | ObservationConfidence | ComparisonConfidence | string
): ConfidenceDisplay {
  return formatConfidenceLabel(value);
}

export function buildLongitudinalTreatmentAreaRows(
  reconstruction: SurgeryDayProcedureReconstruction
): TreatmentAreaRow[] {
  return buildTreatmentAreaRows(reconstruction);
}

export function buildProjectionSummaryText(
  projectedOutcome: SurgeryDayProjectedOutcome
): string | null {
  const summary = projectedOutcome.summary?.trim();
  if (summary) return summary;
  const lines = projectedOutcome.projectedCharacteristics
    .map((c) => c.projection?.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  return lines.slice(0, 3).join(" ");
}

export function buildObservationSummaryText(
  observation: LongitudinalOutcomeObservation
): string | null {
  const parts: string[] = [];
  const recipient = observation.recipient;
  for (const f of [
    recipient.frontalAppearance,
    recipient.densityAppearance,
    recipient.transitionAppearance,
    recipient.directionalAppearance,
    recipient.crownAppearance,
  ]) {
    if (f?.observation?.trim()) parts.push(f.observation.trim());
  }
  for (const f of observation.overallObservations) {
    if (f.observation?.trim()) parts.push(f.observation.trim());
  }
  if (!parts.length) return null;
  return parts.slice(0, 4).join(" ");
}

export function buildDonorObservationLines(
  observation: LongitudinalOutcomeObservation,
  reconstruction: SurgeryDayProcedureReconstruction
): {
  surgeryDay: string[];
  followUp: string[];
} {
  const surgeryDay: string[] = [];
  if (reconstruction.donor?.extractionPattern?.observation) {
    surgeryDay.push(reconstruction.donor.extractionPattern.observation.trim());
  }
  if (reconstruction.donor?.extractionDistribution?.observation) {
    surgeryDay.push(reconstruction.donor.extractionDistribution.observation.trim());
  }
  for (const c of reconstruction.donor?.visibleConcerns ?? []) {
    if (c.observation?.trim()) surgeryDay.push(c.observation.trim());
  }

  const followUp: string[] = [];
  if (!observation.donor) {
    return { surgeryDay, followUp };
  }
  if (observation.donor.donorAppearance?.observation?.trim()) {
    followUp.push(observation.donor.donorAppearance.observation.trim());
  }
  if (observation.donor.visibleDepletionPattern?.observation?.trim()) {
    followUp.push(observation.donor.visibleDepletionPattern.observation.trim());
  }
  if (observation.donor.visibleScarring?.observation?.trim()) {
    followUp.push(observation.donor.visibleScarring.observation.trim());
  }
  return { surgeryDay, followUp };
}

export function buildFollowUpTimeline(args: {
  currentStage: LongitudinalOutcomeStage;
  capturedStages?: LongitudinalOutcomeStage[];
  projectionCreated: boolean;
}): TimelineStageEntry[] {
  const captured = new Set(args.capturedStages ?? [args.currentStage]);
  const stages: LongitudinalOutcomeStage[] = [
    "month_3",
    "month_6",
    "month_9",
    "month_12",
  ];

  const entries: TimelineStageEntry[] = [
    {
      stage: "surgery_day",
      label: "Surgery Day",
      description: args.projectionCreated
        ? "Projection created"
        : "Projection not captured",
      captured: args.projectionCreated,
      isCurrent: false,
    },
  ];

  for (const stage of stages) {
    const isCurrent = stage === args.currentStage;
    const isCaptured = captured.has(stage);
    entries.push({
      stage,
      label: formatStageLabel(stage),
      description: isCaptured
        ? isCurrent
          ? "Observed review (this report)"
          : "Observed review"
        : "Not yet captured",
      captured: isCaptured,
      isCurrent,
    });
  }
  return entries;
}

export function buildNextReviewRecommendation(
  stage: LongitudinalOutcomeStage
): NextReviewRecommendation {
  switch (stage) {
    case "month_3":
      return {
        label: "Month 6",
        description:
          "The next recommended HairAudit follow-up capture point is Month 6, when more characteristics may become partially assessable.",
      };
    case "month_6":
      return {
        label: "Month 9",
        description:
          "The next recommended HairAudit follow-up capture point is Month 9, when maturation typically supports a broader comparison.",
      };
    case "month_9":
      return {
        label: "Month 12",
        description:
          "The next recommended HairAudit follow-up capture point is Month 12, when most supported domains may be assessable if evidence is adequate.",
      };
    case "month_12":
      return {
        label: "Long-term review",
        description:
          "Month 12 completes the primary longitudinal comparison window. A later long-term review may be useful if your clinic's HairAudit pathway supports it — this is optional guidance, not a medical appointment obligation.",
      };
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

function firstSigned(
  photosByCategory: Record<string, { signedUrl: string | null; label: string }[]> | undefined,
  hints: RegExp[]
): { url: string; label: string } | null {
  if (!photosByCategory) return null;
  for (const [key, entries] of Object.entries(photosByCategory)) {
    if (!hints.some((re) => re.test(key))) continue;
    for (const e of entries ?? []) {
      const url = String(e.signedUrl ?? "").trim();
      if (!url) continue;
      if (/^(storage:|s3:|gs:)/i.test(url)) continue;
      if (/\bbucket\b/i.test(url) && !/^https?:\/\//i.test(url)) continue;
      return { url, label: e.label || key };
    }
  }
  return null;
}

/**
 * Build image groups from already-signed print URLs.
 * Does not query storage or invent analytics overlays.
 */
export function buildLongitudinalImageGroups(args: {
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
  stage: LongitudinalOutcomeStage;
  includeBaseline?: boolean;
}): LongitudinalImageGroup[] {
  const photos = args.photosByCategory;
  if (!photos || !Object.keys(photos).length) return [];

  const stageMonth = args.stage.replace("month_", "");
  const groups: LongitudinalImageGroup[] = [];

  if (args.includeBaseline) {
    const baselineImages: Array<{ url: string; label: string }> = [];
    for (const view of [
      { hints: [/preop_front/i, /pre[-_]?op.*front/i], label: "Preoperative front" },
      { hints: [/preop_top/i, /pre[-_]?op.*top/i], label: "Preoperative top" },
      { hints: [/preop_donor/i, /pre[-_]?op.*donor/i], label: "Preoperative donor" },
    ]) {
      const hit = firstSigned(photos, view.hints);
      if (hit) baselineImages.push({ url: hit.url, label: view.label });
    }
    if (baselineImages.length) {
      groups.push({
        id: "preoperative_baseline",
        title: "Preoperative Baseline",
        images: baselineImages,
      });
    }
  }

  const surgeryViews = [
    {
      viewLabel: "Front",
      surgeryHints: [/day0_recipient/i, /immediate_postop_recipient/i, /surgery.?day.*front/i],
      followHints: [
        new RegExp(`postop_month${stageMonth}_front`, "i"),
        /followup_front/i,
        /patient_current_front/i,
      ],
    },
    {
      viewLabel: "Top",
      surgeryHints: [/day0.*top/i, /immediate_postop.*top/i, /surgery.?day.*top/i],
      followHints: [
        new RegExp(`postop_month${stageMonth}_top`, "i"),
        /followup_top/i,
        /patient_current_top/i,
      ],
    },
    {
      viewLabel: "Crown",
      surgeryHints: [/day0.*crown/i, /immediate_postop.*crown/i],
      followHints: [
        new RegExp(`postop_month${stageMonth}_crown`, "i"),
        /followup_crown/i,
        /patient_current_crown/i,
      ],
    },
    {
      viewLabel: "Donor",
      surgeryHints: [/day0_donor/i, /immediate_postop_donor/i, /surgery.?day.*donor/i],
      followHints: [
        new RegExp(`postop_month${stageMonth}_donor`, "i"),
        /followup_donor/i,
        /patient_current_donor/i,
      ],
    },
  ];

  const surgeryImages: Array<{ url: string; label: string }> = [];
  const followImages: Array<{ url: string; label: string }> = [];
  const pairs: LongitudinalImagePair[] = [];

  for (const v of surgeryViews) {
    const surgery = firstSigned(photos, v.surgeryHints);
    const followUp = firstSigned(photos, v.followHints);
    if (surgery) {
      surgeryImages.push({
        url: surgery.url,
        label: `Surgery Day — ${v.viewLabel}`,
      });
    }
    if (followUp) {
      followImages.push({
        url: followUp.url,
        label: `${formatStageLabel(args.stage)} — ${v.viewLabel}`,
      });
    }
    if (surgery || followUp) {
      pairs.push({
        viewLabel: v.viewLabel,
        surgeryDay: surgery
          ? { url: surgery.url, label: `Surgery Day — ${v.viewLabel}` }
          : null,
        followUp: followUp
          ? {
              url: followUp.url,
              label: `${formatStageLabel(args.stage)} — ${v.viewLabel}`,
            }
          : null,
      });
    }
  }

  if (surgeryImages.length) {
    groups.push({
      id: "surgery_day",
      title: "Original Surgery-Day Evidence",
      images: surgeryImages,
    });
  }
  if (followImages.length) {
    groups.push({
      id: "follow_up",
      title: `Current Follow-Up Evidence (${formatStageLabel(args.stage)})`,
      images: followImages,
    });
  }
  if (pairs.some((p) => p.surgeryDay && p.followUp)) {
    groups.push({
      id: "side_by_side",
      title: "Matched Views (where available)",
      images: [],
      pairs: pairs.filter((p) => p.surgeryDay || p.followUp),
    });
  }

  return groups;
}

export function sortDomainComparisonsByPreferredOrder<T extends { domain: ProjectedOutcomeDomain }>(
  domains: T[]
): T[] {
  const rank = new Map(LONGITUDINAL_DOMAIN_ORDER.map((d, i) => [d, i]));
  return [...domains].sort(
    (a, b) => (rank.get(a.domain) ?? 99) - (rank.get(b.domain) ?? 99)
  );
}

export function formatDisplayDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
