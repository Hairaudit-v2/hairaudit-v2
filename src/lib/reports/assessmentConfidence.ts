/**
 * HA-REPORT-5D — Assessment Confidence (evidence completeness indicator).
 * Patient-safe; not a clinical outcome or diagnostic certainty score.
 */

import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import { inferCanonicalPhotoCategory } from "@/lib/photos/classification";
import {
  buildClinicalEvidenceImagesFromPhotosByCategory,
  buildClinicalEvidenceUploadDescriptors,
} from "./clinicalEvidenceGallery";
import type { PostSurgeryAuditReport } from "./postSurgeryAuditReport";
import type { PreSurgeryPlanningReport } from "./preSurgeryPlanningReport";

export type AssessmentConfidenceBand = "high" | "moderate" | "limited";

export type AssessmentConfidenceResult = {
  score: number;
  band: AssessmentConfidenceBand;
  title: string;
  summary: string;
  strengths: string[];
  limitations: string[];
};

export type AssessmentConfidenceLabels = {
  title: string;
  helper: string;
  bandLabels: Record<AssessmentConfidenceBand, string>;
  strengthsTitle: string;
  limitationsTitle: string;
  summaries: Record<
    PatientReviewPathway,
    Record<AssessmentConfidenceBand, string>
  >;
  strengths: {
    multipleImages: string;
    requiredViewsPost: string;
    requiredViewsPre: string;
    procedureDetails: string;
    clinicalContext: string;
  };
  limitations: {
    missingViews: string;
    imageLimited: string;
    limitedProcedure: string;
    noClinicalContext: string;
  };
};

type UploadLike = {
  id?: string;
  type?: string | null;
  storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ViewGroup = { id: string; matchers: (cat: string) => boolean };

const POST_SURGERY_VIEW_GROUPS: ViewGroup[] = [
  {
    id: "front",
    matchers: (c) =>
      /front|hairline/.test(c) && !/donor|rear|left|right/.test(c),
  },
  {
    id: "recipient_closeup",
    matchers: (c) =>
      /recipient|day0_recipient|hairline_closeup|hairline/.test(c),
  },
  {
    id: "crown_top",
    matchers: (c) => /top|crown|vertex/.test(c),
  },
  {
    id: "donor_area",
    matchers: (c) =>
      /donor_rear|day0_donor|postop.*donor|preop_donor_rear|current_donor/.test(c),
  },
  {
    id: "donor_closeup",
    matchers: (c) => /donor_closeup|donor.*close/.test(c),
  },
];

const PRE_SURGERY_VIEW_GROUPS: ViewGroup[] = [
  {
    id: "front",
    matchers: (c) =>
      /front|hairline/.test(c) && !/donor|rear|left|right/.test(c),
  },
  {
    id: "left_temple",
    matchers: (c) => /preop_left|current_left|left/.test(c) && !/right/.test(c),
  },
  {
    id: "right_temple",
    matchers: (c) => /preop_right|current_right|right/.test(c) && !/left/.test(c),
  },
  {
    id: "crown_top",
    matchers: (c) => /top|crown|vertex/.test(c),
  },
  {
    id: "donor_back",
    matchers: (c) => /donor_rear|donor_rear|preop_donor|current_donor/.test(c),
  },
];

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isImageUploadType(type: string): boolean {
  const t = type.toLowerCase();
  return (
    t.startsWith("patient_photo:") ||
    t.includes("image") ||
    t.includes("photo") ||
    t.includes("jpg") ||
    t.includes("jpeg") ||
    t.includes("png") ||
    t.includes("webp")
  );
}

function extractCanonicalFromCategoryKey(categoryKey: string): string | null {
  const sep = categoryKey.lastIndexOf(" - ");
  const raw = sep === -1 ? categoryKey : categoryKey.slice(sep + 3);
  return raw.trim().replaceAll(" ", "_").toLowerCase();
}

function resolveClinicalImageCount(input: {
  uploads?: UploadLike[];
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
}): number {
  const fromUploads = buildClinicalEvidenceUploadDescriptors(input.uploads).length;
  if (fromUploads > 0) return fromUploads;
  return buildClinicalEvidenceImagesFromPhotosByCategory(input.photosByCategory).length;
}

function collectCanonicalCategories(input: {
  uploads?: UploadLike[];
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
  postReport?: PostSurgeryAuditReport | null;
  preReport?: PreSurgeryPlanningReport | null;
}): Set<string> {
  const categories = new Set<string>();

  for (const upload of input.uploads ?? []) {
    const type = String(upload.type ?? "");
    if (!isImageUploadType(type)) continue;
    categories.add(inferCanonicalPhotoCategory(upload));
  }

  for (const [key, items] of Object.entries(input.photosByCategory ?? {})) {
    if (!items.some((p) => p.signedUrl)) continue;
    const fromKey = extractCanonicalFromCategoryKey(key);
    if (fromKey) categories.add(fromKey);
    for (const item of items) {
      if (item.label) categories.add(item.label.toLowerCase().replaceAll(" ", "_"));
    }
  }

  const assessments =
    input.postReport?.imageAssessments ?? input.preReport?.imageAssessments ?? [];
  for (const assessment of assessments) {
    if (assessment.photoCategoryKey) {
      categories.add(assessment.photoCategoryKey.toLowerCase());
    }
    categories.add(assessment.viewKey);
  }

  return categories;
}

function countCoveredViewGroups(
  categories: Set<string>,
  groups: ViewGroup[]
): number {
  let covered = 0;
  for (const group of groups) {
    const hasMatch = [...categories].some((cat) => group.matchers(cat));
    if (hasMatch) covered += 1;
  }
  return covered;
}

function scoreImageCount(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 8;
  if (count <= 5) return 18;
  if (count <= 8) return 26;
  return 35;
}

function scoreViewCoverage(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 8;
  if (count === 3) return 15;
  if (count === 4) return 21;
  return 25;
}

function hasMedicationContext(history: ClinicalHistorySnapshot | null | undefined): boolean {
  if (!history?.medicationHistory) return false;
  return Object.values(history.medicationHistory).some(
    (v) => v === true || (typeof v === "string" && v.trim().length > 0)
  );
}

function scoreProceduralDetails(input: {
  clinicalHistory?: ClinicalHistorySnapshot | null;
  postReport?: PostSurgeryAuditReport | null;
  preReport?: PreSurgeryPlanningReport | null;
}): { score: number; detailCount: number } {
  const history = input.clinicalHistory;
  let score = 0;
  let detailCount = 0;

  const graftPresent =
    (history?.priorGraftCount != null && history.priorGraftCount > 0) ||
    input.preReport?.graftEstimateRange != null ||
    Boolean(
      input.postReport?.sections.some((s) => s.finding.toLowerCase().includes("graft")) ||
        input.preReport?.sections.some((s) => s.finding.toLowerCase().includes("graft"))
    );
  if (graftPresent) {
    score += 6;
    detailCount += 1;
  }

  const hairCountPresent =
    history?.estimatedHairCount != null && history.estimatedHairCount > 0;
  if (hairCountPresent) {
    score += 4;
    detailCount += 1;
  }

  const procedureTypePresent =
    Boolean(history?.priorProcedureType && history.priorProcedureType !== "unknown") ||
    Boolean(history?.extractionMethod && history.extractionMethod !== "unknown");
  if (procedureTypePresent) {
    score += 4;
    detailCount += 1;
  }

  const timingPresent =
    Boolean(history?.priorSurgeryDate?.trim()) ||
    Boolean(history?.priorSurgeryTimingNote?.trim());
  if (timingPresent) {
    score += 3;
    detailCount += 1;
  }

  const medicationPresent = hasMedicationContext(history);
  if (medicationPresent) {
    score += 3;
    detailCount += 1;
  }

  return { score: Math.min(20, score), detailCount };
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

function scoreClinicalContext(input: {
  clinicalHistory?: ClinicalHistorySnapshot | null;
  uploads?: UploadLike[];
  postReport?: PostSurgeryAuditReport | null;
  preReport?: PreSurgeryPlanningReport | null;
  documentAssistedAssessment?: boolean;
}): { score: number; hasPatientNotes: boolean; hasClinicianNotes: boolean; hasDocuments: boolean } {
  const history = input.clinicalHistory;
  const contextLines =
    input.postReport?.patientSafeSummary.knownClinicalContext ??
    input.preReport?.patientSafeSummary.knownClinicalContext ??
    [];

  const hasPatientNotes =
    Boolean(history?.supportingDocumentNotes?.trim()) ||
    contextLines.some((line) => /patient|submitted|provided/i.test(line));
  const hasClinicianNotes = Boolean(history?.clinicianSummary?.trim());
  const hasDocuments =
    hasSupportDocumentationUploads(input.uploads) ||
    Boolean(input.documentAssistedAssessment) ||
    Boolean(
      input.postReport?.patientSafeSummary.imageLimitedNotice?.includes("supporting documentation")
    );

  let score = 0;
  if (hasPatientNotes) score += 4;
  if (hasClinicianNotes) score += 4;
  if (hasDocuments) score += 2;

  return {
    score: Math.min(10, score),
    hasPatientNotes,
    hasClinicianNotes,
    hasDocuments,
  };
}

function scoreImageQualityAdjustment(input: {
  imageLimitedAssessment?: boolean;
  documentAssistedAssessment?: boolean;
  hasSupportDocs: boolean;
  imageCount: number;
  coveredViews: number;
  totalRequiredViews: number;
}): number {
  if (!input.imageLimitedAssessment) return 10;
  if (input.documentAssistedAssessment || input.hasSupportDocs) return 5;
  if (input.imageCount === 0 || input.coveredViews === 0) return 0;
  if (input.coveredViews < Math.ceil(input.totalRequiredViews / 2)) return 0;
  return 0;
}

function resolveBand(score: number): AssessmentConfidenceBand {
  if (score >= 80) return "high";
  if (score >= 55) return "moderate";
  return "limited";
}

function viewGroupPresent(categories: Set<string>, group: ViewGroup): boolean {
  return [...categories].some((cat) => group.matchers(cat));
}

export type AssessmentEvidenceSnapshot = {
  pathway: PatientReviewPathway;
  imageCount: number;
  coveredViews: number;
  totalRequiredViews: number;
  hasMissingRequiredViews: boolean;
  hasDonorView: boolean;
  hasCrownView: boolean;
  hasRecipientCloseup: boolean;
  graftCountPresent: boolean;
  procedureTypePresent: boolean;
  timingPresent: boolean;
  patientNotesPresent: boolean;
  documentAssisted: boolean;
};

export type BuildAssessmentEvidenceParams = Omit<BuildAssessmentConfidenceParams, "labels">;

export function resolveAssessmentEvidenceSnapshot(
  params: BuildAssessmentEvidenceParams
): AssessmentEvidenceSnapshot {
  const pathway = params.pathway;
  const viewGroups =
    pathway === "pre_surgery" ? PRE_SURGERY_VIEW_GROUPS : POST_SURGERY_VIEW_GROUPS;

  const imageCount = resolveClinicalImageCount({
    uploads: params.uploads,
    photosByCategory: params.photosByCategory,
  });
  const categories = collectCanonicalCategories({
    uploads: params.uploads,
    photosByCategory: params.photosByCategory,
    postReport: params.postReport,
    preReport: params.preReport,
  });
  const coveredViews = countCoveredViewGroups(categories, viewGroups);

  const history = params.clinicalHistory;
  const contextLines =
    params.postReport?.patientSafeSummary.knownClinicalContext ??
    params.preReport?.patientSafeSummary.knownClinicalContext ??
    [];

  const graftCountPresent =
    (history?.priorGraftCount != null && history.priorGraftCount > 0) ||
    params.preReport?.graftEstimateRange != null ||
    Boolean(
      params.postReport?.sections.some((s) => s.finding.toLowerCase().includes("graft")) ||
        params.preReport?.sections.some((s) => s.finding.toLowerCase().includes("graft"))
    );

  const procedureTypePresent =
    Boolean(history?.priorProcedureType && history.priorProcedureType !== "unknown") ||
    Boolean(history?.extractionMethod && history.extractionMethod !== "unknown");

  const timingPresent =
    Boolean(history?.priorSurgeryDate?.trim()) ||
    Boolean(history?.priorSurgeryTimingNote?.trim());

  const patientNotesPresent =
    Boolean(history?.supportingDocumentNotes?.trim()) ||
    contextLines.some((line) => /patient|submitted|provided|concern/i.test(line));

  const documentAssisted =
    Boolean(params.documentAssistedAssessment) ||
    hasSupportDocumentationUploads(params.uploads) ||
    Boolean(
      params.postReport?.patientSafeSummary.imageLimitedNotice?.includes("supporting documentation")
    );

  const donorGroup =
    pathway === "pre_surgery"
      ? viewGroups.find((g) => g.id === "donor_back")
      : viewGroups.find((g) => g.id === "donor_area");
  const crownGroup = viewGroups.find((g) => g.id === "crown_top");
  const recipientGroup = viewGroups.find((g) => g.id === "recipient_closeup");

  return {
    pathway,
    imageCount,
    coveredViews,
    totalRequiredViews: viewGroups.length,
    hasMissingRequiredViews: coveredViews < viewGroups.length,
    hasDonorView: donorGroup ? viewGroupPresent(categories, donorGroup) : false,
    hasCrownView: crownGroup ? viewGroupPresent(categories, crownGroup) : false,
    hasRecipientCloseup: recipientGroup ? viewGroupPresent(categories, recipientGroup) : false,
    graftCountPresent,
    procedureTypePresent,
    timingPresent,
    patientNotesPresent,
    documentAssisted,
  };
}

export function buildAssessmentConfidenceLabelsEn(): AssessmentConfidenceLabels {
  return {
    title: "Assessment Confidence",
    helper:
      "This score reflects the completeness and usefulness of the submitted evidence. It does not represent a diagnosis, treatment recommendation, or guarantee of surgical outcome.",
    bandLabels: {
      high: "High",
      moderate: "Moderate",
      limited: "Limited",
    },
    strengthsTitle: "Evidence strengths",
    limitationsTitle: "Evidence limitations",
    summaries: {
      post_surgery: {
        high:
          "This post-surgery assessment had strong evidence coverage, including multiple submitted images, procedural details, and key donor or recipient views.",
        moderate:
          "This post-surgery assessment had useful evidence coverage, but some views or supporting details were limited.",
        limited:
          "This post-surgery assessment was completed with limited evidence coverage, so some image-based observations should be interpreted cautiously.",
      },
      pre_surgery: {
        high:
          "This pre-surgery planning assessment had strong evidence coverage, including multiple planning views and relevant case information.",
        moderate:
          "This pre-surgery planning assessment had useful evidence coverage, but some planning views or supporting details were limited.",
        limited:
          "This pre-surgery planning assessment was completed with limited evidence coverage, so suitability and planning observations should be interpreted cautiously.",
      },
    },
    strengths: {
      multipleImages: "Multiple clinical images were available for review.",
      requiredViewsPost: "Required donor and recipient views were included.",
      requiredViewsPre: "Key planning views were included.",
      procedureDetails: "Procedure details were supplied with the report.",
      clinicalContext: "Supporting clinical context was available.",
    },
    limitations: {
      missingViews: "Some standard photo views were not available.",
      imageLimited:
        "Image-based interpretation may be limited in areas without clear angles.",
      limitedProcedure: "Procedure documentation was limited.",
      noClinicalContext: "Supporting clinical context was not provided.",
    },
  };
}

export type BuildAssessmentConfidenceParams = {
  pathway: PatientReviewPathway;
  postReport?: PostSurgeryAuditReport | null;
  preReport?: PreSurgeryPlanningReport | null;
  uploads?: UploadLike[];
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>;
  clinicalHistory?: ClinicalHistorySnapshot | null;
  imageLimitedAssessment?: boolean;
  documentAssistedAssessment?: boolean;
  labels?: AssessmentConfidenceLabels;
};

export function buildAssessmentConfidence(
  params: BuildAssessmentConfidenceParams
): AssessmentConfidenceResult {
  const labels = params.labels ?? buildAssessmentConfidenceLabelsEn();
  const pathway = params.pathway;
  const viewGroups =
    pathway === "pre_surgery" ? PRE_SURGERY_VIEW_GROUPS : POST_SURGERY_VIEW_GROUPS;

  const imageCount = resolveClinicalImageCount({
    uploads: params.uploads,
    photosByCategory: params.photosByCategory,
  });
  const categories = collectCanonicalCategories({
    uploads: params.uploads,
    photosByCategory: params.photosByCategory,
    postReport: params.postReport,
    preReport: params.preReport,
  });
  const coveredViews = countCoveredViewGroups(categories, viewGroups);
  const totalRequiredViews = viewGroups.length;

  const imageLimited =
    params.imageLimitedAssessment ??
    Boolean(
      params.postReport?.patientSafeSummary.imageLimitedNotice ??
        params.preReport?.patientSafeSummary.imageLimitedNotice
    );

  const hasSupportDocs = hasSupportDocumentationUploads(params.uploads);

  const procedural = scoreProceduralDetails({
    clinicalHistory: params.clinicalHistory,
    postReport: params.postReport,
    preReport: params.preReport,
  });
  const clinicalContext = scoreClinicalContext({
    clinicalHistory: params.clinicalHistory,
    uploads: params.uploads,
    postReport: params.postReport,
    preReport: params.preReport,
    documentAssistedAssessment: params.documentAssistedAssessment,
  });

  const imageScore = scoreImageCount(imageCount);
  const viewScore = scoreViewCoverage(coveredViews);
  const qualityScore = scoreImageQualityAdjustment({
    imageLimitedAssessment: imageLimited,
    documentAssistedAssessment: params.documentAssistedAssessment,
    hasSupportDocs,
    imageCount,
    coveredViews,
    totalRequiredViews,
  });

  const rawScore =
    imageScore + viewScore + procedural.score + clinicalContext.score + qualityScore;
  const score = clampScore(rawScore);
  const band = resolveBand(score);
  const bandLabel = labels.bandLabels[band];

  const strengths: string[] = [];
  if (imageCount >= 3) {
    strengths.push(labels.strengths.multipleImages);
  }
  const viewsThreshold = pathway === "pre_surgery" ? 4 : 4;
  if (coveredViews >= viewsThreshold) {
    strengths.push(
      pathway === "pre_surgery"
        ? labels.strengths.requiredViewsPre
        : labels.strengths.requiredViewsPost
    );
  }
  if (procedural.score >= 10) {
    strengths.push(labels.strengths.procedureDetails);
  }
  if (clinicalContext.score >= 4) {
    strengths.push(labels.strengths.clinicalContext);
  }

  const limitations: string[] = [];
  if (coveredViews < totalRequiredViews) {
    limitations.push(labels.limitations.missingViews);
  }
  if (imageLimited || (imageCount > 0 && coveredViews < 3)) {
    limitations.push(labels.limitations.imageLimited);
  }
  if (procedural.score < 10 && procedural.detailCount < 2) {
    limitations.push(labels.limitations.limitedProcedure);
  }
  if (clinicalContext.score === 0) {
    limitations.push(labels.limitations.noClinicalContext);
  }

  return {
    score,
    band,
    title: `${labels.title}: ${bandLabel}`,
    summary: labels.summaries[pathway][band],
    strengths,
    limitations,
  };
}

export const ASSESSMENT_CONFIDENCE_CSS = `
  .assessmentConfidenceSection {
    background: linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%);
    border: 1px solid #bae6fd;
    page-break-inside: avoid;
  }
  .assessmentConfidenceHeader {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .assessmentConfidenceBand {
    font-size: 15px;
    font-weight: 800;
    color: #0c4a6e;
    letter-spacing: -0.01em;
  }
  .assessmentConfidenceScore {
    font-size: 28px;
    font-weight: 900;
    color: #0369a1;
    line-height: 1;
  }
  .assessmentConfidenceSummary {
    margin-top: 10px;
    color: #334155;
    font-size: 11px;
    line-height: 1.55;
    max-width: 72ch;
  }
  .assessmentConfidenceHelper {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #475569;
    font-size: 9px;
    line-height: 1.5;
  }
  .assessmentConfidenceColumns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 20px;
    margin-top: 14px;
  }
  @media print and (max-width: 180mm) {
    .assessmentConfidenceColumns { grid-template-columns: 1fr; }
  }
  .assessmentConfidenceListTitle {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
    margin: 0 0 6px;
  }
  .assessmentConfidenceList {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .assessmentConfidenceList li {
    display: flex;
    gap: 6px;
    margin-bottom: 5px;
    font-size: 10px;
    line-height: 1.45;
    color: #0f172a;
  }
  .assessmentConfidenceBullet {
    flex-shrink: 0;
    font-weight: 800;
    color: #0284c7;
  }
  .assessmentConfidenceBulletWarn {
    color: #b45309;
  }
`;

export function renderAssessmentConfidenceHtml(
  result: AssessmentConfidenceResult,
  labels: AssessmentConfidenceLabels
): string {
  const strengthsHtml =
    result.strengths.length > 0
      ? `
      <div>
        <p class="assessmentConfidenceListTitle">${esc(labels.strengthsTitle)}</p>
        <ul class="assessmentConfidenceList">
          ${result.strengths
            .map(
              (s) =>
                `<li><span class="assessmentConfidenceBullet" aria-hidden="true">+</span><span>${esc(s)}</span></li>`
            )
            .join("")}
        </ul>
      </div>`
      : "";

  const limitationsHtml =
    result.limitations.length > 0
      ? `
      <div>
        <p class="assessmentConfidenceListTitle">${esc(labels.limitationsTitle)}</p>
        <ul class="assessmentConfidenceList">
          ${result.limitations
            .map(
              (s) =>
                `<li><span class="assessmentConfidenceBullet assessmentConfidenceBulletWarn" aria-hidden="true">–</span><span>${esc(s)}</span></li>`
            )
            .join("")}
        </ul>
      </div>`
      : "";

  const columnsHtml =
    strengthsHtml || limitationsHtml
      ? `<div class="assessmentConfidenceColumns">${strengthsHtml}${limitationsHtml}</div>`
      : "";

  return `
    <div class="section assessmentConfidenceSection" data-testid="assessment-confidence-section">
      <div class="assessmentConfidenceHeader">
        <div>
          <div class="sectionHead"><h2>${esc(labels.title)}</h2></div>
          <p class="assessmentConfidenceBand">${esc(labels.bandLabels[result.band])}</p>
        </div>
        <div class="assessmentConfidenceScore">${result.score}%</div>
      </div>
      <p class="assessmentConfidenceSummary">${esc(result.summary)}</p>
      ${columnsHtml}
      <p class="assessmentConfidenceHelper">${esc(labels.helper)}</p>
    </div>`;
}
