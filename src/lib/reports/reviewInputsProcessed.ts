/**
 * HA-REPORT-5C — What We Reviewed (patient-safe intelligence transparency layer).
 */

import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import type { PostSurgeryAuditReport } from "./postSurgeryAuditReport";
import type { PreSurgeryPlanningReport } from "./preSurgeryPlanningReport";
import {
  buildClinicalEvidenceImagesFromPhotosByCategory,
  buildClinicalEvidenceUploadDescriptors,
} from "./clinicalEvidenceGallery";

export type ReviewInputId =
  | "clinical_images"
  | "procedure_data"
  | "clinical_notes"
  | "support_documentation"
  | "graft_count_data"
  | "donor_analysis"
  | "recipient_assessment"
  | "hairline_design"
  | "extraction_pattern"
  | "density_review"
  | "healing_patterns"
  | "repair_probability"
  | "procedural_consistency"
  | "future_risk"
  | "sustainability"
  | "hair_loss_pattern"
  | "donor_reserve"
  | "surgical_candidacy"
  | "future_planning"
  | "medical_treatment_context";

export type ReviewInputChecklistItem = {
  id: ReviewInputId;
  imageCount?: number;
};

export type ReviewInputsProcessedLabels = {
  title: string;
  subtitle: string;
  summary: string;
  summarySecondary: string;
  itemLabels: Record<ReviewInputId, string>;
};

export type ReviewInputsProcessedContent = {
  title: string;
  subtitle: string;
  items: ReviewInputChecklistItem[];
  resolvedLabels: string[];
  summaryStatement: string;
  secondarySummary: string;
};

type UploadLike = {
  id?: string;
  type?: string | null;
  storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
};

const POST_SURGERY_ITEM_ORDER: ReviewInputId[] = [
  "clinical_images",
  "procedure_data",
  "clinical_notes",
  "support_documentation",
  "graft_count_data",
  "donor_analysis",
  "recipient_assessment",
  "hairline_design",
  "extraction_pattern",
  "density_review",
  "healing_patterns",
  "repair_probability",
  "procedural_consistency",
  "future_risk",
  "sustainability",
];

const PRE_SURGERY_ITEM_ORDER: ReviewInputId[] = [
  "clinical_images",
  "procedure_data",
  "clinical_notes",
  "support_documentation",
  "hair_loss_pattern",
  "donor_reserve",
  "surgical_candidacy",
  "graft_count_data",
  "future_planning",
  "future_risk",
  "sustainability",
  "medical_treatment_context",
];

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hasSection(
  sections: Array<{ id: string }> | undefined,
  id: string
): boolean {
  return Boolean(sections?.some((s) => s.id === id));
}

function hasScorecard(
  scorecards: Array<{ id: string }> | undefined,
  id: string
): boolean {
  return Boolean(scorecards?.some((s) => s.id === id));
}

function textBlob(values: Array<string | undefined | null>): string {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function mentionsGraft(...parts: Array<string | undefined | null>): boolean {
  return textBlob(parts).includes("graft");
}

function hasSupportDocumentationUploads(uploads?: UploadLike[]): boolean {
  if (!uploads?.length) return false;
  return uploads.some((upload) => {
    const type = String(upload.type ?? "").toLowerCase();
    if (!type) return false;
    if (type.startsWith("patient_photo:")) return false;
    return (
      type.includes("clinic_quote") ||
      type.includes("graft_count") ||
      type.includes("document") ||
      type.includes("pdf") ||
      type.includes("support")
    );
  });
}

function resolveClinicalImageCount(input: {
  uploads?: UploadLike[];
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
}): number {
  const fromUploads = buildClinicalEvidenceUploadDescriptors(input.uploads).length;
  if (fromUploads > 0) return fromUploads;

  return buildClinicalEvidenceImagesFromPhotosByCategory(input.photosByCategory).length;
}

function buildPostSurgeryAvailability(
  report: PostSurgeryAuditReport,
  clinicalImageCount: number,
  hasSupportDocs: boolean
): Partial<Record<ReviewInputId, ReviewInputChecklistItem>> {
  const { sections, scorecards, imageAssessments, patientSafeSummary } = report;
  const findingsBlob = textBlob(sections.map((s) => s.finding));
  const assessmentBlob = textBlob(imageAssessments.map((i) => i.assessment));
  const contextBlob = textBlob(patientSafeSummary.knownClinicalContext ?? []);

  const available: Partial<Record<ReviewInputId, ReviewInputChecklistItem>> = {
    procedure_data: { id: "procedure_data" },
  };

  if (clinicalImageCount > 0) {
    available.clinical_images = { id: "clinical_images", imageCount: clinicalImageCount };
  }
  if ((patientSafeSummary.knownClinicalContext?.length ?? 0) > 0) {
    available.clinical_notes = { id: "clinical_notes" };
  }
  if (hasSupportDocs || patientSafeSummary.imageLimitedNotice?.includes("supporting documentation")) {
    available.support_documentation = { id: "support_documentation" };
  }
  if (mentionsGraft(findingsBlob, assessmentBlob, contextBlob)) {
    available.graft_count_data = { id: "graft_count_data" };
  }
  if (hasSection(sections, "donor_area") || hasScorecard(scorecards, "donor_preservation")) {
    available.donor_analysis = { id: "donor_analysis" };
  }
  if (hasSection(sections, "recipient_area") || hasScorecard(scorecards, "recipient_area")) {
    available.recipient_assessment = { id: "recipient_assessment" };
  }
  if (
    imageAssessments.some((i) => i.viewKey === "front") ||
    findingsBlob.includes("hairline") ||
    findingsBlob.includes("frontal")
  ) {
    available.hairline_design = { id: "hairline_design" };
  }
  if (hasSection(sections, "extraction_pattern") || hasScorecard(scorecards, "extraction_pattern")) {
    available.extraction_pattern = { id: "extraction_pattern" };
  }
  if (hasSection(sections, "density_distribution") || hasScorecard(scorecards, "density_distribution")) {
    available.density_review = { id: "density_review" };
  }
  if (hasScorecard(scorecards, "healing_quality")) {
    available.healing_patterns = { id: "healing_patterns" };
  }
  if (hasScorecard(scorecards, "repair_probability") || hasSection(sections, "repair_considerations")) {
    available.repair_probability = { id: "repair_probability" };
  }
  if (hasSection(sections, "procedural_integrity")) {
    available.procedural_consistency = { id: "procedural_consistency" };
  }
  if (hasSection(sections, "long_term_risk")) {
    available.future_risk = { id: "future_risk" };
  }
  if (report.longTermPreservation || hasSection(sections, "long_term_risk")) {
    available.sustainability = { id: "sustainability" };
  }

  return available;
}

function buildPreSurgeryAvailability(
  report: PreSurgeryPlanningReport,
  clinicalImageCount: number,
  hasSupportDocs: boolean
): Partial<Record<ReviewInputId, ReviewInputChecklistItem>> {
  const { sections, scorecards, patientSafeSummary } = report;

  const available: Partial<Record<ReviewInputId, ReviewInputChecklistItem>> = {
    procedure_data: { id: "procedure_data" },
  };

  if (clinicalImageCount > 0) {
    available.clinical_images = { id: "clinical_images", imageCount: clinicalImageCount };
  }
  if ((patientSafeSummary.knownClinicalContext?.length ?? 0) > 0) {
    available.clinical_notes = { id: "clinical_notes" };
  }
  if (hasSupportDocs) {
    available.support_documentation = { id: "support_documentation" };
  }
  if (hasSection(sections, "hair_loss_pattern") || hasScorecard(scorecards, "hair_loss_progression_risk")) {
    available.hair_loss_pattern = { id: "hair_loss_pattern" };
  }
  if (hasSection(sections, "donor_area") || hasScorecard(scorecards, "donor_area_strength")) {
    available.donor_reserve = { id: "donor_reserve" };
  }
  if (hasSection(sections, "surgical_suitability") || hasScorecard(scorecards, "restoration_suitability")) {
    available.surgical_candidacy = { id: "surgical_candidacy" };
  }
  if (
    report.graftEstimateRange != null ||
    hasSection(sections, "estimated_graft_requirement") ||
    hasScorecard(scorecards, "estimated_graft_requirement")
  ) {
    available.graft_count_data = { id: "graft_count_data" };
  }
  if (hasSection(sections, "future_progression")) {
    available.future_planning = { id: "future_planning" };
  }
  if (hasScorecard(scorecards, "hair_loss_progression_risk") || hasSection(sections, "future_progression")) {
    available.future_risk = { id: "future_risk" };
  }
  if (
    report.longTermPreservation ||
    hasScorecard(scorecards, "long_term_preservation_score") ||
    hasSection(sections, "future_progression")
  ) {
    available.sustainability = { id: "sustainability" };
  }
  if (hasSection(sections, "medical_treatment") || hasScorecard(scorecards, "treatment_stabilisation_priority")) {
    available.medical_treatment_context = { id: "medical_treatment_context" };
  }

  return available;
}

function resolveItemLabel(
  item: ReviewInputChecklistItem,
  labels: ReviewInputsProcessedLabels
): string {
  const template = labels.itemLabels[item.id] ?? item.id;
  if (item.id === "clinical_images" && item.imageCount != null) {
    return template.replace("{{count}}", String(item.imageCount));
  }
  return template;
}

export function buildReviewInputsProcessedLabelsEn(): ReviewInputsProcessedLabels {
  return {
    title: "What We Reviewed",
    subtitle:
      "HairAudit independently processes multiple forms of clinical information when generating your assessment. The following data sources contributed to this report.",
    summary:
      "This report was generated using multiple layers of procedural review, image analysis, clinical context, and long-term restoration modelling.",
    summarySecondary:
      "HairAudit independently reviews each submitted case using structured clinical assessment protocols.",
    itemLabels: {
      clinical_images: "{{count}} clinical images reviewed",
      procedure_data: "Procedural information provided by patient",
      clinical_notes: "Clinical notes and context supplied by patient",
      support_documentation: "Support documentation uploaded",
      graft_count_data: "Graft count information reviewed",
      donor_analysis: "Donor preservation analysis completed",
      recipient_assessment: "Recipient zone placement reviewed",
      hairline_design: "Hairline design reviewed",
      extraction_pattern: "Extraction pattern consistency reviewed",
      density_review: "Density distribution patterns assessed",
      healing_patterns: "Healing patterns assessed",
      repair_probability: "Long-term repair probability analysed",
      procedural_consistency: "Procedural consistency reviewed",
      future_risk: "Future hair loss progression factors reviewed",
      sustainability: "Hair restoration sustainability modelling completed",
      hair_loss_pattern: "Hair loss pattern progression reviewed",
      donor_reserve: "Donor reserve suitability assessed",
      surgical_candidacy: "Surgical candidacy factors analysed",
      future_planning: "Future planning considerations modelled",
      medical_treatment_context: "Medical treatment context reviewed",
    },
  };
}

export type BuildReviewInputsProcessedParams = {
  pathway: PatientReviewPathway;
  postReport?: PostSurgeryAuditReport | null;
  preReport?: PreSurgeryPlanningReport | null;
  uploads?: UploadLike[];
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
  labels?: ReviewInputsProcessedLabels;
};

export function buildReviewInputsProcessed(
  params: BuildReviewInputsProcessedParams
): ReviewInputsProcessedContent {
  const labels = params.labels ?? buildReviewInputsProcessedLabelsEn();
  const hasSupportDocs = hasSupportDocumentationUploads(params.uploads);

  let available: Partial<Record<ReviewInputId, ReviewInputChecklistItem>> = {};
  let order = POST_SURGERY_ITEM_ORDER;

  if (params.pathway === "post_surgery" && params.postReport) {
    const imageCount = resolveClinicalImageCount({
      uploads: params.uploads,
      photosByCategory: params.photosByCategory,
    });
    available = buildPostSurgeryAvailability(params.postReport, imageCount, hasSupportDocs);
    order = POST_SURGERY_ITEM_ORDER;
  } else if (params.pathway === "pre_surgery" && params.preReport) {
    const imageCount = resolveClinicalImageCount({
      uploads: params.uploads,
      photosByCategory: params.photosByCategory,
    });
    available = buildPreSurgeryAvailability(params.preReport, imageCount, hasSupportDocs);
    order = PRE_SURGERY_ITEM_ORDER;
  }

  const items = order
    .map((id) => available[id])
    .filter((item): item is ReviewInputChecklistItem => Boolean(item));

  const resolvedLabels = items.map((item) => resolveItemLabel(item, labels));

  return {
    title: labels.title,
    subtitle: labels.subtitle,
    items,
    resolvedLabels,
    summaryStatement: labels.summary,
    secondarySummary: labels.summarySecondary,
  };
}

export const REVIEW_INPUTS_PROCESSED_CSS = `
  .reviewInputsSection {
    background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
    border: 1px solid #cbd5e1;
    page-break-inside: avoid;
  }
  .reviewInputsLead { margin: 8px 0 0; color: #475569; max-width: 72ch; }
  .reviewInputsGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 16px;
    margin-top: 14px;
  }
  @media print and (max-width: 180mm) {
    .reviewInputsGrid { grid-template-columns: 1fr; }
  }
  .reviewInputsItem {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: #0f172a;
    font-size: 11px;
    line-height: 1.45;
  }
  .reviewInputsCheck {
    flex-shrink: 0;
    color: #047857;
    font-weight: 800;
  }
  .reviewInputsSummary {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    color: #334155;
    font-size: 10px;
    line-height: 1.55;
  }
  .reviewInputsSummary p { margin: 0 0 8px; }
  .reviewInputsSummary p:last-child { margin-bottom: 0; }
`;

export function renderReviewInputsProcessedHtml(content: ReviewInputsProcessedContent): string {
  if (content.items.length === 0) return "";

  const checklistHtml = content.resolvedLabels
    .map(
      (label) => `
      <div class="reviewInputsItem">
        <span class="reviewInputsCheck" aria-hidden="true">✓</span>
        <span>${esc(label)}</span>
      </div>`
    )
    .join("");

  return `
    <div class="section reviewInputsSection">
      <div class="sectionHead"><h2>${esc(content.title)}</h2></div>
      <p class="reviewInputsLead">${esc(content.subtitle)}</p>
      <div class="reviewInputsGrid">${checklistHtml}</div>
      <div class="reviewInputsSummary">
        <p>${esc(content.summaryStatement)}</p>
        <p>${esc(content.secondarySummary)}</p>
      </div>
    </div>`;
}
