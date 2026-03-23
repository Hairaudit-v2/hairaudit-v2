/**
 * Human-readable copy for evidence gaps (PDF / reports). Additive; no scoring changes.
 */

import type { EvidenceEvaluationResult } from "./evidenceEvaluator";
import type { EvidenceRequirementKey, SurgicalMetricId } from "./evidenceRequirements";

export const EVIDENCE_KEY_DISPLAY_LABELS: Record<EvidenceRequirementKey, string> = {
  recipient_day0_macro: "Day 0 recipient macro images",
  recipient_day0_angle: "Angled / lateral recipient views",
  recipient_mid_range: "Mid-range recovery recipient views",
  hairline_frontal_macro: "Frontal hairline macro images",
  hairline_oblique: "Oblique hairline images",
  extraction_phase_closeup: "Extraction phase close-up images",
  graft_macro: "Graft macro inspection images",
  donor_preop: "Pre-op donor images",
  donor_shaved_macro: "Shaved donor macro images",
  donor_postop_shaved: "Post-op shaved donor images",
  donor_healed: "Healed donor / follow-up donor images",
  graft_tray_overview: "Graft tray overview",
  graft_tray_closeup: "Graft tray close-up images",
};

/** Elite PDF domain cards: which surgical evidence metrics inform each card when the domain score is absent. */
export const DOMAIN_CARD_EVIDENCE_METRIC_IDS: Record<string, SurgicalMetricId[]> = {
  "Donor Management": ["donor_quality", "transection_risk"],
  "Recipient Site Design": ["hairline_naturalness", "implant_density"],
  "Graft Handling": ["graft_handling"],
  "Implantation Technique": ["implant_density"],
};

function humanizeEvidenceKey(key: string): string {
  return key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatMissingRequiredEvidenceLine(missing: readonly EvidenceRequirementKey[]): string | null {
  if (!missing.length) return null;
  const parts = missing.map((k) => EVIDENCE_KEY_DISPLAY_LABELS[k] ?? humanizeEvidenceKey(k));
  return `Missing required evidence: ${parts.join(", ")}`;
}

export function unionMissingEvidenceKeys(
  metricIds: readonly SurgicalMetricId[],
  evaluation: EvidenceEvaluationResult
): EvidenceRequirementKey[] {
  const seen = new Set<EvidenceRequirementKey>();
  const out: EvidenceRequirementKey[] = [];
  for (const id of metricIds) {
    const miss = evaluation.metricCoverage[id]?.missing;
    if (!Array.isArray(miss)) continue;
    for (const k of miss) {
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

/** Values that mean “no substantive metric text” (print normalizer, legacy “—”, etc.). */
export function isGenericInsufficientMetricText(text: string): boolean {
  const t = String(text ?? "")
    .trim()
    .toLowerCase();
  return (
    t === "" ||
    t === "insufficient evidence" ||
    t === "—" ||
    t === "-" ||
    t === "unknown" ||
    t === "n/a"
  );
}

/**
 * When the normalized key-metric string is a generic insufficient placeholder, replace with evaluator-backed detail.
 */
export function enrichInsufficientKeyMetricText(
  normalizedMetricText: string,
  metricId: SurgicalMetricId,
  evaluation: EvidenceEvaluationResult | null | undefined
): string {
  if (!isGenericInsufficientMetricText(normalizedMetricText)) {
    return normalizedMetricText;
  }
  if (!evaluation) return normalizedMetricText;
  const missing = evaluation.metricCoverage[metricId]?.missing;
  if (!missing?.length) return normalizedMetricText;
  return formatMissingRequiredEvidenceLine(missing) ?? normalizedMetricText;
}

export function domainCardScoreLabelWhenNoScore(
  domainTitle: string,
  evaluation: EvidenceEvaluationResult | null | undefined
): string {
  if (!evaluation) return "Insufficient evidence";
  const metricIds = DOMAIN_CARD_EVIDENCE_METRIC_IDS[domainTitle];
  if (!metricIds?.length) return "Insufficient evidence";
  const keys = unionMissingEvidenceKeys(metricIds, evaluation);
  return formatMissingRequiredEvidenceLine(keys) ?? "Insufficient evidence";
}

export type KeyMetricsStrings = {
  donorQuality: string;
  graftSurvival: string;
  transectionRisk: string;
  implantationDensity: string;
  hairlineNaturalness: string;
  donorScarVisibility: string;
};

/** After `normalizeMetric`, swap generic insufficient placeholders for evaluator-backed copy when possible. */
export function enrichKeyMetricsAfterNormalize(
  metrics: KeyMetricsStrings,
  evaluation: EvidenceEvaluationResult | null | undefined
): KeyMetricsStrings {
  return {
    donorQuality: enrichInsufficientKeyMetricText(metrics.donorQuality, "donor_quality", evaluation),
    graftSurvival: enrichInsufficientKeyMetricText(metrics.graftSurvival, "graft_handling", evaluation),
    transectionRisk: enrichInsufficientKeyMetricText(metrics.transectionRisk, "transection_risk", evaluation),
    implantationDensity: enrichInsufficientKeyMetricText(metrics.implantationDensity, "implant_density", evaluation),
    hairlineNaturalness: enrichInsufficientKeyMetricText(metrics.hairlineNaturalness, "hairline_naturalness", evaluation),
    donorScarVisibility: enrichInsufficientKeyMetricText(metrics.donorScarVisibility, "donor_scar_visibility", evaluation),
  };
}

export type LegacyKeyMetricsRecord = {
  donor_quality: string;
  graft_survival_estimate: string;
  transection_risk: string;
  implantation_density: string;
  hairline_naturalness: string;
  donor_scar_visibility: string;
};

export function enrichLegacyKeyMetricsRecord(
  metrics: LegacyKeyMetricsRecord,
  evaluation: EvidenceEvaluationResult | null | undefined
): LegacyKeyMetricsRecord {
  const e = enrichKeyMetricsAfterNormalize(
    {
      donorQuality: metrics.donor_quality,
      graftSurvival: metrics.graft_survival_estimate,
      transectionRisk: metrics.transection_risk,
      implantationDensity: metrics.implantation_density,
      hairlineNaturalness: metrics.hairline_naturalness,
      donorScarVisibility: metrics.donor_scar_visibility,
    },
    evaluation
  );
  return {
    donor_quality: e.donorQuality,
    graft_survival_estimate: e.graftSurvival,
    transection_risk: e.transectionRisk,
    implantation_density: e.implantationDensity,
    hairline_naturalness: e.hairlineNaturalness,
    donor_scar_visibility: e.donorScarVisibility,
  };
}
