/**
 * HA-REPORT-5D.1 — Assessment Improvement Recommendations.
 * Shown when confidence is Moderate or Limited; hidden when High.
 */

import type { AssessmentConfidenceBand, AssessmentConfidenceResult } from "./assessmentConfidence";
import {
  resolveAssessmentEvidenceSnapshot,
  type BuildAssessmentConfidenceParams,
} from "./assessmentConfidence";

export type AssessmentImprovementItemId =
  | "additionalPhotos"
  | "donorPhotos"
  | "crownPhotos"
  | "recipientCloseup"
  | "graftCount"
  | "procedureType"
  | "procedureTiming"
  | "patientNotes"
  | "supportingDocuments";

export type AssessmentImprovementRecommendation = {
  itemIds: AssessmentImprovementItemId[];
  recommendations: string[];
};

export type AssessmentImprovementLabels = {
  title: string;
  subtitle: string;
  footer: string;
  highCoverageMessage: string;
  items: Record<AssessmentImprovementItemId, string>;
};

const MAX_RECOMMENDATIONS = 4;

export function buildAssessmentImprovementLabelsEn(): AssessmentImprovementLabels {
  return {
    title: "How To Improve Assessment Accuracy",
    subtitle:
      "Additional information may help improve the depth and completeness of future HairAudit assessments.",
    footer:
      "Improved evidence may allow more detailed procedural analysis and more accurate long-term planning observations.",
    highCoverageMessage:
      "Your submitted evidence provided strong assessment coverage and allowed a comprehensive procedural review.",
    items: {
      additionalPhotos: "Upload additional photos from multiple scalp angles.",
      donorPhotos:
        "Include donor area photographs showing the back and sides of the scalp.",
      crownPhotos:
        "Provide top-down or crown photographs to allow better density and progression assessment.",
      recipientCloseup:
        "Provide close-up recipient area photographs to improve placement and density review accuracy.",
      graftCount: "Provide approximate graft count information if known.",
      procedureType:
        "Share your procedure type (such as FUE, DHI, FUT, or repair surgery) if known.",
      procedureTiming:
        "Include information about how long ago your procedure was performed.",
      patientNotes:
        "Include additional background information about your concerns or surgery history.",
      supportingDocuments:
        "Upload supporting documents such as clinic procedure summaries if available.",
    },
  };
}

export function resolveAssessmentImprovementTexts(
  itemIds: AssessmentImprovementItemId[],
  labels: AssessmentImprovementLabels = buildAssessmentImprovementLabelsEn()
): string[] {
  return itemIds.map((id) => labels.items[id]);
}

export type BuildAssessmentImprovementParams = Omit<
  BuildAssessmentConfidenceParams,
  "labels"
> & {
  confidence: AssessmentConfidenceResult;
  labels?: AssessmentImprovementLabels;
};

export function buildAssessmentImprovementRecommendations(
  params: BuildAssessmentImprovementParams
): AssessmentImprovementRecommendation {
  const labels = params.labels ?? buildAssessmentImprovementLabelsEn();

  if (params.confidence.band === "high") {
    return { itemIds: [], recommendations: [] };
  }

  const evidence = resolveAssessmentEvidenceSnapshot(params);
  const candidates: AssessmentImprovementItemId[] = [];

  if (evidence.hasMissingRequiredViews || evidence.imageCount < 6) {
    candidates.push("additionalPhotos");
  }
  if (!evidence.hasDonorView) {
    candidates.push("donorPhotos");
  }
  if (evidence.pathway === "post_surgery" && !evidence.hasRecipientCloseup) {
    candidates.push("recipientCloseup");
  }
  if (!evidence.hasCrownView) {
    candidates.push("crownPhotos");
  }
  if (!evidence.graftCountPresent) {
    candidates.push("graftCount");
  }
  if (!evidence.procedureTypePresent) {
    candidates.push("procedureType");
  }
  if (evidence.pathway === "post_surgery" && !evidence.timingPresent) {
    candidates.push("procedureTiming");
  }
  if (!evidence.patientNotesPresent) {
    candidates.push("patientNotes");
  }
  if (!evidence.documentAssisted) {
    candidates.push("supportingDocuments");
  }

  const seen = new Set<AssessmentImprovementItemId>();
  const itemIds: AssessmentImprovementItemId[] = [];
  for (const id of candidates) {
    if (seen.has(id)) continue;
    seen.add(id);
    itemIds.push(id);
    if (itemIds.length >= MAX_RECOMMENDATIONS) break;
  }

  return {
    itemIds,
    recommendations: resolveAssessmentImprovementTexts(itemIds, labels),
  };
}

export const ASSESSMENT_IMPROVEMENT_CSS = `
  .assessmentImprovementSection {
    background: #fff;
    border: 1px solid #e2e8f0;
    page-break-inside: avoid;
  }
  .assessmentImprovementLead {
    margin: 8px 0 0;
    color: #475569;
    font-size: 11px;
    line-height: 1.55;
    max-width: 72ch;
  }
  .assessmentImprovementList {
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }
  .assessmentImprovementList li {
    display: flex;
    gap: 8px;
    margin-bottom: 7px;
    font-size: 11px;
    line-height: 1.45;
    color: #0f172a;
  }
  .assessmentImprovementBullet {
    flex-shrink: 0;
    font-weight: 800;
    color: #0369a1;
  }
  .assessmentImprovementFooter {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    color: #475569;
    font-size: 10px;
    line-height: 1.5;
  }
  .assessmentImprovementHighMessage {
    margin-top: 10px;
    color: #334155;
    font-size: 11px;
    line-height: 1.55;
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

export function renderAssessmentImprovementHtml(args: {
  band: AssessmentConfidenceBand;
  recommendations: AssessmentImprovementRecommendation;
  labels: AssessmentImprovementLabels;
}): string {
  const { band, recommendations, labels } = args;

  if (band === "high") {
    return `
    <div class="section assessmentImprovementSection" data-testid="assessment-improvement-section">
      <div class="sectionHead"><h2>${esc(labels.title)}</h2></div>
      <p class="assessmentImprovementHighMessage">${esc(labels.highCoverageMessage)}</p>
    </div>`;
  }

  if (recommendations.recommendations.length === 0) return "";

  const listHtml = recommendations.recommendations
    .map(
      (item) =>
        `<li><span class="assessmentImprovementBullet" aria-hidden="true">•</span><span>${esc(item)}</span></li>`
    )
    .join("");

  return `
    <div class="section assessmentImprovementSection" data-testid="assessment-improvement-section">
      <div class="sectionHead"><h2>${esc(labels.title)}</h2></div>
      <p class="assessmentImprovementLead">${esc(labels.subtitle)}</p>
      <ul class="assessmentImprovementList">${listHtml}</ul>
      <p class="assessmentImprovementFooter">${esc(labels.footer)}</p>
    </div>`;
}
