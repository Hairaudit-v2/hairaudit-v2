/**
 * HA-PROJECTION-1A — Convert forensic AI / metadata into ObservedFeature objects.
 *
 * Scores inform confidence bands only. No numeric density/cm² or future-result claims.
 */

import type {
  ObservedFeature,
  ReconstructionConfidence,
  SurgeryDayEvidenceRole,
} from "./types";
import { sanitizeObservedText } from "./surgeryDayReconstructionSafety";
import { describeTreatmentExtent, type NormalizedZone, uniqueNormalizedZones } from "./surgeryDayZones";

export type ForensicAuditLike = {
  section_scores?: Partial<Record<string, number>> | null;
  section_score_evidence?: Partial<Record<string, string[]>> | null;
  key_findings?: Array<{
    title?: string;
    impact?: string;
    severity?: string;
  }> | null;
  confidence_label?: string | null;
  data_quality?: { limitations?: string[] } | null;
};

function scoreToConfidence(score: number | null | undefined): ReconstructionConfidence {
  if (score == null || !Number.isFinite(score)) return "low";
  if (score >= 75) return "high";
  if (score >= 55) return "moderate";
  return "low";
}

function firstSafeEvidence(lines: string[] | undefined, fallback: string): string {
  for (const line of lines ?? []) {
    const safe = sanitizeObservedText(line);
    if (safe) return safe;
  }
  return fallback;
}

function feature(
  key: string,
  label: string,
  observation: string,
  confidence: ReconstructionConfidence,
  evidenceRoles: SurgeryDayEvidenceRole[],
  source: ObservedFeature["source"] = "forensic_ai"
): ObservedFeature {
  return { key, label, observation, confidence, evidenceRoles, source };
}

const HAIRLINE_FALLBACK =
  "Visible hairline characteristics are documented from surgery-day images where the contour and transition are in view.";
const PLACEMENT_FALLBACK =
  "The visible recipient pattern shows placement distribution characteristics in the available surgery-day images.";
const DENSITY_FALLBACK =
  "Relative density appearance is described qualitatively from the photographs; exact grafts/cm² are not measured.";
const DONOR_FALLBACK =
  "Surgery-day donor images show extraction distribution characteristics where the harvested area is visible.";
const NATURALNESS_FALLBACK =
  "Symmetry and transition characteristics are described from visible macro patterns in the submitted images.";

export type BuiltObservedFeatures = {
  hairlineDesign: ObservedFeature | null;
  recipientPlacement: ObservedFeature | null;
  densityDistribution: ObservedFeature | null;
  directionAndAngulation: ObservedFeature | null;
  symmetryAndTransition: ObservedFeature | null;
  extractionPattern: ObservedFeature | null;
  extractionDistribution: ObservedFeature | null;
  visibleDonorConcerns: ObservedFeature[];
  overallObservations: ObservedFeature[];
  treatmentExtentLabel: string;
  observedTreatedAreas: string[];
};

export function buildObservedFeaturesFromForensic(input: {
  forensic: ForensicAuditLike | null | undefined;
  presentRoles: SurgeryDayEvidenceRole[];
  treatedAreaZones: NormalizedZone[];
  hasDonorEvidence: boolean;
  hasBaseline: boolean;
}): BuiltObservedFeatures {
  const scores = input.forensic?.section_scores ?? {};
  const evidence = input.forensic?.section_score_evidence ?? {};
  const hasRecipient = input.presentRoles.includes("surgery_day_recipient");

  const zones = uniqueNormalizedZones(input.treatedAreaZones);
  const treatmentExtentLabel = describeTreatmentExtent(zones);
  const observedTreatedAreas = zones.length ? zones : [];

  const hairlineDesign = hasRecipient
    ? feature(
        "hairline_design",
        "Hairline design (observed)",
        firstSafeEvidence(
          evidence.hairline_design,
          scores.hairline_design != null && scores.hairline_design >= 70
            ? "The hairline demonstrates visible irregularity rather than a uniform straight edge, where the contour is in view."
            : HAIRLINE_FALLBACK
        ),
        scoreToConfidence(scores.hairline_design),
        ["surgery_day_recipient", "surgery_day_design"].filter((r) =>
          input.presentRoles.includes(r as SurgeryDayEvidenceRole)
        ) as SurgeryDayEvidenceRole[]
      )
    : null;

  const recipientPlacement = hasRecipient
    ? feature(
        "recipient_placement",
        "Recipient placement (observed)",
        firstSafeEvidence(
          evidence.recipient_placement,
          scores.recipient_placement != null && scores.recipient_placement >= 70
            ? "The visible recipient pattern appears relatively consistent in spacing across the photographed treated region."
            : PLACEMENT_FALLBACK
        ),
        scoreToConfidence(scores.recipient_placement),
        ["surgery_day_recipient"]
      )
    : null;

  const densityDistribution = hasRecipient
    ? feature(
        "density_distribution",
        "Density distribution (qualitative)",
        firstSafeEvidence(
          evidence.density_distribution,
          scores.density_distribution != null && scores.density_distribution >= 70
            ? "The visible recipient pattern appears denser through the frontal region than posteriorly, where both regions are in view."
            : DENSITY_FALLBACK
        ),
        scoreToConfidence(scores.density_distribution),
        ["surgery_day_recipient"]
      )
    : null;

  // Direction: only when forensic evidence mentions direction/angle/native; else light rule from naturalness
  const directionLine = [...(evidence.recipient_placement ?? []), ...(evidence.naturalness_and_aesthetics ?? [])]
    .map((l) => sanitizeObservedText(l))
    .find((l) => l && /direction|angle|angulation|native flow|orientation/i.test(l));

  const directionAndAngulation = hasRecipient
    ? feature(
        "direction_and_angulation",
        "Direction and angulation (observed)",
        directionLine ??
          "Direction and angulation are described only where graft orientation is clearly visible; no exact angles are measured.",
        directionLine ? "moderate" : "low",
        ["surgery_day_recipient"],
        directionLine ? "forensic_ai" : "rule"
      )
    : null;

  const symmetryAndTransition = hasRecipient
    ? feature(
        "symmetry_and_transition",
        "Symmetry and transition (observed)",
        firstSafeEvidence(
          evidence.naturalness_and_aesthetics,
          NATURALNESS_FALLBACK
        ),
        scoreToConfidence(scores.naturalness_and_aesthetics),
        ["surgery_day_recipient"]
      )
    : null;

  let extractionPattern: ObservedFeature | null = null;
  let extractionDistribution: ObservedFeature | null = null;
  const visibleDonorConcerns: ObservedFeature[] = [];

  if (input.hasDonorEvidence) {
    extractionPattern = feature(
      "extraction_pattern",
      "Extraction pattern (observed)",
      firstSafeEvidence(evidence.extraction_quality, DONOR_FALLBACK),
      scoreToConfidence(scores.extraction_quality),
      ["surgery_day_donor"]
    );
    extractionDistribution = feature(
      "extraction_distribution",
      "Extraction distribution (observed)",
      firstSafeEvidence(
        evidence.donor_management,
        "Surgery-day donor images show the relative spread of extraction sites across the visible harvested area."
      ),
      scoreToConfidence(scores.donor_management),
      ["surgery_day_donor"]
    );

    const donorScore = scores.donor_management;
    if (donorScore != null && donorScore < 55) {
      visibleDonorConcerns.push(
        feature(
          "donor_visible_concern",
          "Visible donor concern",
          "Visible extraction distribution shows focal concentration or uneven spacing in the available surgery-day donor images. Long-term depletion and mature scarring are not assessed at this stage.",
          "moderate",
          ["surgery_day_donor"],
          "rule"
        )
      );
    }
  }

  const overallObservations: ObservedFeature[] = [];
  if (treatmentExtentLabel !== "unspecified") {
    overallObservations.push(
      feature(
        "treatment_extent",
        "Apparent treatment extent",
        `Reported or observed treated areas are consistent with a ${treatmentExtentLabel} distribution.`,
        zones.length ? "moderate" : "low",
        hasRecipient ? ["surgery_day_recipient"] : [],
        zones.length ? "procedure_metadata" : "rule"
      )
    );
  }

  // Key findings → overall observed (sanitized)
  for (const kf of input.forensic?.key_findings ?? []) {
    const title = sanitizeObservedText(kf.title ?? "");
    const impact = sanitizeObservedText(kf.impact ?? "");
    const observation = [title, impact].filter(Boolean).join(" — ");
    if (!observation) continue;
    overallObservations.push(
      feature(
        `key_finding_${overallObservations.length}`,
        title ?? "Observed finding",
        observation,
        kf.severity === "high" || kf.severity === "critical" ? "moderate" : "low",
        hasRecipient ? ["surgery_day_recipient"] : [],
        "forensic_ai"
      )
    );
  }

  if (input.hasBaseline) {
    overallObservations.push(
      feature(
        "baseline_available",
        "Baseline comparison available",
        "A verified preoperative baseline is available for comparison with surgery-day recipient evidence.",
        "moderate",
        ["preop_front"],
        "rule"
      )
    );
  }

  return {
    hairlineDesign,
    recipientPlacement,
    densityDistribution,
    directionAndAngulation,
    symmetryAndTransition,
    extractionPattern,
    extractionDistribution,
    visibleDonorConcerns,
    overallObservations,
    treatmentExtentLabel,
    observedTreatedAreas,
  };
}

export function buildBaselineComparisonFeatures(input: {
  hasBaseline: boolean;
  treatedAreas: string[];
  presentBaselineRoles: SurgeryDayEvidenceRole[];
}): {
  nativeHairPattern: ObservedFeature | null;
  treatmentRelationship: ObservedFeature | null;
  limitations: string[];
} {
  if (!input.hasBaseline) {
    return {
      nativeHairPattern: null,
      treatmentRelationship: null,
      limitations: ["No verified preoperative baseline was available."],
    };
  }

  const areas = input.treatedAreas.map((a) => a.toLowerCase());
  const includesTemples = areas.some((a) => a.includes("temple"));
  const includesCrown = areas.some((a) => a.includes("crown"));
  const includesFrontal = areas.some((a) => /hairline|frontal|forelock/.test(a));

  const nativeHairPattern = feature(
    "native_hair_pattern",
    "Native hair pattern (baseline comparison)",
    "Preoperative images show the native hair pattern prior to surgery-day placement. Native hair remaining through untreated or partially treated regions is noted only where both baseline and surgery-day views support the comparison.",
    "moderate",
    input.presentBaselineRoles.length ? input.presentBaselineRoles : ["preop_front"],
    "rule"
  );

  const parts: string[] = [];
  if (includesFrontal) {
    parts.push(
      "Transplantation appears concentrated through the frontal region relative to the preoperative recession pattern where both views are available."
    );
  }
  if (includesTemples) {
    parts.push("Temple regions appear included in the treated area based on available evidence.");
  } else {
    parts.push("Temple involvement is not clearly documented in the available treated-area metadata.");
  }
  if (includesCrown) {
    parts.push("Crown treatment is indicated in the procedure metadata or image set.");
  } else {
    parts.push("Crown appears untreated or not documented in the available evidence.");
  }
  parts.push(
    "Native hair may remain visible through mid-scalp or other regions; this is an observed comparison, not a growth forecast."
  );

  const treatmentRelationship = feature(
    "treatment_relationship",
    "Treatment versus baseline (observed)",
    parts.join(" "),
    "moderate",
    ["surgery_day_recipient", ...input.presentBaselineRoles],
    "mixed"
  );

  return {
    nativeHairPattern,
    treatmentRelationship,
    limitations: [],
  };
}
