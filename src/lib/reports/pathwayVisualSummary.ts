/**
 * HA-PDF-VISUAL-2 — Patient-safe visual domain summary for pathway reports.
 * Shared model + HTML renderer for web shell and PDF HTML.
 */

import type { PostSurgeryAuditReport, PostSurgeryScorecardMetric } from "./postSurgeryAuditReport";
import type { PreSurgeryPlanningReport, PreSurgeryScorecardMetric } from "./preSurgeryPlanningReport";
import { getPatientDomainAssessment } from "./patientDomainAssessment";
import { renderRadarSvg, clamp100 } from "./radarSvg";

export const PATHWAY_VISUAL_SUMMARY_MIN_DOMAINS = 3 as const;

export type PathwayVisualDomain = {
  id: string;
  label: string;
  /** 0–100 chart position (higher = more favorable on the chart). */
  chartValue: number;
  qualitativeLabel: string;
};

export type PathwayVisualSummaryStatus = "ready" | "insufficient";

export type PathwayVisualSummary = {
  status: PathwayVisualSummaryStatus;
  title: string;
  subtitle: string;
  domains: PathwayVisualDomain[];
  centerLabel: string;
  emptyMessage: string;
  radarSvg: string | null;
};

export type PathwayVisualSummaryLabels = {
  title: string;
  subtitle: string;
  emptyMessage: string;
  domainLabels: Record<string, string>;
};

export const PATHWAY_VISUAL_SUMMARY_LABELS_EN: PathwayVisualSummaryLabels = {
  title: "Review overview by area",
  subtitle: "Based on submitted images and information",
  emptyMessage:
    "A visual overview will appear here once enough review areas have been assessed from your submitted materials.",
  domainLabels: {
    donor_preservation: "Donor preservation",
    extraction_pattern: "Extraction pattern",
    density_distribution: "Density distribution",
    recipient_area: "Recipient area",
    healing_quality: "Healing quality",
    hair_loss_progression_risk: "Progression risk",
    donor_area_strength: "Donor strength",
    restoration_suitability: "Restoration suitability",
    long_term_preservation_score: "Long-term preservation",
    treatment_stabilisation_priority: "Stabilisation priority",
  },
};

export function buildPathwayVisualSummaryLabelsEn(): PathwayVisualSummaryLabels {
  return PATHWAY_VISUAL_SUMMARY_LABELS_EN;
}

function clampChartValue(n: number): number {
  return clamp100(n);
}

function avgChartValues(values: number[]): number {
  const valid = values.filter((n) => Number.isFinite(n));
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function qualitativeBandToChartValue(band: string | null | undefined): number | null {
  switch (band) {
    case "strong":
    case "high":
    case "good":
      return 82;
    case "moderate":
      return 62;
    case "elevated":
      return 52;
    case "limited":
    case "caution":
    case "concerning":
    case "needs_monitoring":
      return 42;
    case "low":
      return 38;
    default:
      return null;
  }
}

function postSurgeryQualitativeLabel(band: string | null | undefined, displayValue: string): string {
  switch (band) {
    case "good":
      return "Generally acceptable";
    case "strong":
      return "Within expected range";
    case "moderate":
      return "Worth discussing with your clinician";
    case "concerning":
    case "needs_monitoring":
      return "May benefit from follow-up";
    case "low":
      return "Low";
    case "elevated":
      return "Elevated";
    default:
      return displayValue === "Under review" ? "Under review" : displayValue;
  }
}

function preSurgeryQualitativeLabel(band: string | null | undefined, displayValue: string): string {
  if (displayValue === "Under review" || displayValue === "Preliminary range pending review") {
    return "Under review";
  }
  switch (band) {
    case "strong":
    case "high":
      return "Within expected range";
    case "moderate":
      return "Generally acceptable";
    case "elevated":
    case "caution":
    case "limited":
      return "Worth discussing with your clinician";
    case "low":
      return "May benefit from follow-up";
    default:
      return displayValue;
  }
}

function resolvePostSurgeryDomain(
  card: PostSurgeryScorecardMetric,
  label: string
): PathwayVisualDomain | null {
  if (card.percentScore != null && Number.isFinite(card.percentScore)) {
    const chartValue = clampChartValue(card.percentScore);
    const assessment = getPatientDomainAssessment(card.percentScore);
    return {
      id: card.id,
      label,
      chartValue,
      qualitativeLabel: assessment.label,
    };
  }

  const chartValue = qualitativeBandToChartValue(card.qualitativeLabel);
  if (chartValue == null) return null;

  return {
    id: card.id,
    label,
    chartValue,
    qualitativeLabel: postSurgeryQualitativeLabel(card.qualitativeLabel, card.displayValue),
  };
}

function resolvePreSurgeryDomain(
  card: PreSurgeryScorecardMetric,
  label: string
): PathwayVisualDomain | null {
  if (card.id === "estimated_graft_requirement") return null;

  if (card.id === "hair_loss_progression_risk") {
    if (card.percentScore != null && Number.isFinite(card.percentScore)) {
      const chartValue = clampChartValue(100 - card.percentScore);
      return {
        id: card.id,
        label,
        chartValue,
        qualitativeLabel: preSurgeryQualitativeLabel(card.qualitativeLabel, card.displayValue),
      };
    }
    const chartValue = qualitativeBandToChartValue(card.qualitativeLabel);
    if (chartValue == null) return null;
    return {
      id: card.id,
      label,
      chartValue: clampChartValue(100 - chartValue),
      qualitativeLabel: preSurgeryQualitativeLabel(card.qualitativeLabel, card.displayValue),
    };
  }

  if (card.id === "treatment_stabilisation_priority") {
    const band = card.qualitativeLabel;
    const chartValue =
      band === "elevated" ? 42 : band === "moderate" ? 62 : band === "low" ? 82 : null;
    if (chartValue == null) return null;
    return {
      id: card.id,
      label,
      chartValue,
      qualitativeLabel: preSurgeryQualitativeLabel(band, card.displayValue),
    };
  }

  if (card.percentScore != null && Number.isFinite(card.percentScore)) {
    const chartValue = clampChartValue(card.percentScore);
    return {
      id: card.id,
      label,
      chartValue,
      qualitativeLabel: preSurgeryQualitativeLabel(card.qualitativeLabel, card.displayValue),
    };
  }

  const chartValue = qualitativeBandToChartValue(card.qualitativeLabel);
  if (chartValue == null || card.displayValue === "Under review") return null;

  return {
    id: card.id,
    label,
    chartValue,
    qualitativeLabel: preSurgeryQualitativeLabel(card.qualitativeLabel, card.displayValue),
  };
}

function finalizeVisualSummary(
  domains: PathwayVisualDomain[],
  labels: PathwayVisualSummaryLabels,
  confidence: number
): PathwayVisualSummary {
  const validDomains = domains.filter(
    (d) => Number.isFinite(d.chartValue) && d.qualitativeLabel !== "Under review"
  );

  if (validDomains.length < PATHWAY_VISUAL_SUMMARY_MIN_DOMAINS) {
    return {
      status: "insufficient",
      title: labels.title,
      subtitle: labels.subtitle,
      domains: validDomains,
      centerLabel: "",
      emptyMessage: labels.emptyMessage,
      radarSvg: null,
    };
  }

  const avg = avgChartValues(validDomains.map((d) => d.chartValue));
  const centerLabel = getPatientDomainAssessment(avg).label;

  const radarSvg = renderRadarSvg({
    labels: validDomains.map((d) => d.label),
    values: validDomains.map((d) => d.chartValue),
    size: 720,
    levels: 5,
    overall: avg,
    confidence,
    patientSafe: { centerLabel },
  });

  return {
    status: "ready",
    title: labels.title,
    subtitle: labels.subtitle,
    domains: validDomains,
    centerLabel,
    emptyMessage: labels.emptyMessage,
    radarSvg,
  };
}

export function buildPostSurgeryVisualSummary(
  report: PostSurgeryAuditReport,
  opts?: {
    labels?: PathwayVisualSummaryLabels;
    confidence?: number;
  }
): PathwayVisualSummary {
  const labels = opts?.labels ?? PATHWAY_VISUAL_SUMMARY_LABELS_EN;
  const confidence = opts?.confidence ?? 0.65;

  const chartableIds = [
    "donor_preservation",
    "extraction_pattern",
    "density_distribution",
    "recipient_area",
    "healing_quality",
  ] as const;

  const scorecardById = new Map(report.scorecards.map((c) => [c.id, c]));
  const domains: PathwayVisualDomain[] = [];

  for (const id of chartableIds) {
    const card = scorecardById.get(id);
    if (!card) continue;
    const domainLabel = labels.domainLabels[id] ?? id;
    const resolved = resolvePostSurgeryDomain(card, domainLabel);
    if (resolved) domains.push(resolved);
  }

  return finalizeVisualSummary(domains, labels, confidence);
}

export function buildPreSurgeryVisualSummary(
  report: PreSurgeryPlanningReport,
  opts?: {
    labels?: PathwayVisualSummaryLabels;
    confidence?: number;
  }
): PathwayVisualSummary {
  const labels = opts?.labels ?? PATHWAY_VISUAL_SUMMARY_LABELS_EN;
  const confidence = opts?.confidence ?? 0.65;

  const chartableIds = [
    "hair_loss_progression_risk",
    "donor_area_strength",
    "restoration_suitability",
    "long_term_preservation_score",
    "treatment_stabilisation_priority",
  ] as const;

  const scorecardById = new Map(report.scorecards.map((c) => [c.id, c]));
  const domains: PathwayVisualDomain[] = [];

  for (const id of chartableIds) {
    const card = scorecardById.get(id);
    if (!card) continue;
    const domainLabel = labels.domainLabels[id] ?? id;
    const resolved = resolvePreSurgeryDomain(card, domainLabel);
    if (resolved) domains.push(resolved);
  }

  return finalizeVisualSummary(domains, labels, confidence);
}

function escHtml(s: string): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const PATHWAY_VISUAL_SUMMARY_CSS = `
  .pathwayVisualSummarySection {
    margin-top: 22px;
    padding: 18px;
    border: 1px solid #d5e2f2;
    border-radius: 14px;
    background: linear-gradient(180deg, #fafdff 0%, #ffffff 100%);
    page-break-inside: avoid;
  }
  .pathwayVisualSummarySection h2 {
    margin: 0;
    font-size: 17px;
    letter-spacing: -0.01em;
    color: #0b1a33;
  }
  .pathwayVisualSummaryLead {
    margin: 8px 0 0;
    color: #4a5f7d;
    font-size: 11px;
    line-height: 1.5;
  }
  .pathwayVisualSummaryLayout {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 16px;
    margin-top: 14px;
    align-items: start;
  }
  .pathwayVisualRadarWrap {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 8px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #0b1226;
  }
  .pathwayVisualRadarWrap svg {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
    border-radius: 12px;
  }
  .pathwayVisualLegend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .pathwayVisualLegendItem {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px 12px;
    background: #fff;
  }
  .pathwayVisualLegendLabel {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
  }
  .pathwayVisualLegendValue {
    margin-top: 4px;
    font-size: 12px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.4;
  }
  .pathwayVisualEmpty {
    margin-top: 12px;
    padding: 14px 16px;
    border-radius: 10px;
    border: 1px dashed #cbd5e1;
    background: #f8fafc;
    color: #475569;
    font-size: 11px;
    line-height: 1.55;
  }
  @media print {
    .pathwayVisualSummaryLayout { grid-template-columns: 1fr; }
  }
`;

export function renderPathwayVisualSummaryHtml(summary: PathwayVisualSummary): string {
  if (summary.status !== "ready" || !summary.radarSvg) {
    return `
    <div class="pathwayVisualSummarySection" data-section="pathwayVisualSummary">
      <h2>${escHtml(summary.title)}</h2>
      <p class="pathwayVisualSummaryLead">${escHtml(summary.subtitle)}</p>
      <div class="pathwayVisualEmpty">${escHtml(summary.emptyMessage)}</div>
    </div>`;
  }

  const legendHtml = summary.domains
    .map(
      (domain) => `
      <li class="pathwayVisualLegendItem">
        <div class="pathwayVisualLegendLabel">${escHtml(domain.label)}</div>
        <div class="pathwayVisualLegendValue">${escHtml(domain.qualitativeLabel)}</div>
      </li>`
    )
    .join("");

  return `
    <div class="pathwayVisualSummarySection" data-section="pathwayVisualSummary">
      <h2>${escHtml(summary.title)}</h2>
      <p class="pathwayVisualSummaryLead">${escHtml(summary.subtitle)}</p>
      <div class="pathwayVisualSummaryLayout">
        <div class="pathwayVisualRadarWrap">${summary.radarSvg}</div>
        <ul class="pathwayVisualLegend">${legendHtml}</ul>
      </div>
    </div>`;
}
