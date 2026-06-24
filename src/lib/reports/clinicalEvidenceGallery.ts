/**
 * HA-REPORT-5A — Clinical evidence review gallery (web + PDF presentation layer).
 */

import { auditorPatientPhotoCategoryLabel } from "@/lib/auditor/auditorPatientPhotoCategories";
import { inferCanonicalPhotoCategory } from "@/lib/photos/classification";
import { isPatientUploadAuditExcluded } from "@/lib/uploads/patientPhotoAuditMeta";

export const CLINICAL_EVIDENCE_GALLERY_MAX_VISIBLE = 12;
export const CLINICAL_EVIDENCE_GALLERY_PDF_CHUNK_SIZE = 6;

export type ClinicalEvidenceGalleryLabels = {
  title: string;
  subtitle: string;
  evidenceProcessedPrefix: string;
  evidenceProcessedSuffix: string;
  evidenceIncorporated: string;
  additionalReviewed: string;
  pdfOmissionNotice: string;
  fallbackImageLabel: string;
  noPhoto: string;
};

export type ClinicalEvidenceImage = {
  id: string;
  imageUrl: string | null;
  label: string;
  categoryKey?: string | null;
};

export type ClinicalEvidenceGalleryModel = {
  totalCount: number;
  displayedImages: ClinicalEvidenceImage[];
  additionalReviewedCount: number;
  pdfOmittedCount: number;
  pdfChunks: ClinicalEvidenceImage[][];
  evidenceProcessedLine: string;
  additionalReviewedLine: string | null;
  pdfOmissionLine: string | null;
};

type UploadLike = {
  id?: string;
  type?: string | null;
  storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
};

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  if (sep === -1) return null;
  return categoryKey
    .slice(sep + 3)
    .trim()
    .replaceAll(" ", "_")
    .toLowerCase();
}

function titleCaseFromSnake(raw: string): string {
  return raw
    .replace(/^(preop|postop|day0|img|patient|current)_+/i, "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function looksLikeInternalLabel(value: string): boolean {
  const s = value.trim().toLowerCase();
  if (!s) return true;
  return (
    s.startsWith("patient_photo:") ||
    s.startsWith("doctor_photo:") ||
    s.startsWith("clinic_photo:") ||
    s.startsWith("img_") ||
    s.startsWith("patient_current_") ||
    /^[a-z0-9_]+$/.test(s)
  );
}

export function resolvePatientFriendlyPhotoLabel(input: {
  canonicalCategory?: string | null;
  rawLabel?: string | null;
  upload?: UploadLike | null;
  fallbackLabel?: string;
}): string {
  const fallback = input.fallbackLabel ?? "Additional Clinical Image";
  const canonical =
    input.canonicalCategory?.trim() ||
    (input.upload ? inferCanonicalPhotoCategory(input.upload) : null) ||
    null;

  if (canonical && canonical !== "uncategorized") {
    const fromConfig = auditorPatientPhotoCategoryLabel(canonical);
    if (fromConfig !== canonical.replace(/_/g, " ") && !looksLikeInternalLabel(fromConfig)) {
      return fromConfig;
    }
    const titled = titleCaseFromSnake(canonical);
    if (titled) return titled;
  }

  const raw = String(input.rawLabel ?? "").trim();
  if (raw && !looksLikeInternalLabel(raw)) return raw;

  return fallback;
}

export function buildClinicalEvidenceImagesFromPhotosByCategory(
  photosByCategory: Record<string, { signedUrl: string | null; label: string }[]> | undefined
): ClinicalEvidenceImage[] {
  if (!photosByCategory) return [];

  const images: ClinicalEvidenceImage[] = [];
  let idx = 0;

  for (const [categoryKey, items] of Object.entries(photosByCategory)) {
    const canonical = extractCanonicalFromCategoryKey(categoryKey);
    for (const item of items ?? []) {
      if (!item.signedUrl) continue;
      images.push({
        id: `clinical-evidence-${idx}`,
        imageUrl: item.signedUrl,
        categoryKey: canonical ?? categoryKey,
        label: resolvePatientFriendlyPhotoLabel({
          canonicalCategory: canonical,
          rawLabel: item.label,
        }),
      });
      idx += 1;
    }
  }

  return images;
}

export function buildClinicalEvidenceUploadDescriptors(
  uploads: UploadLike[] | undefined
): Array<{ id: string; label: string; categoryKey: string | null }> {
  if (!uploads?.length) return [];

  return uploads
    .filter((upload) => {
      const type = String(upload.type ?? "");
      if (!isImageUploadType(type)) return false;
      if (type.startsWith("patient_photo:") && isPatientUploadAuditExcluded(upload)) return false;
      return type.startsWith("patient_photo:");
    })
    .map((upload) => {
      const canonical = inferCanonicalPhotoCategory(upload);
      return {
        id: String(upload.id ?? upload.storage_path ?? canonical),
        label: resolvePatientFriendlyPhotoLabel({ canonicalCategory: canonical, upload }),
        categoryKey: canonical,
      };
    });
}

export function buildClinicalEvidenceGalleryModel(
  images: ClinicalEvidenceImage[],
  mode: "web" | "pdf",
  labels: Pick<ClinicalEvidenceGalleryLabels, "evidenceProcessedPrefix" | "evidenceProcessedSuffix">
): ClinicalEvidenceGalleryModel {
  const totalCount = images.length;
  const maxVisible = mode === "pdf" ? CLINICAL_EVIDENCE_GALLERY_MAX_VISIBLE : CLINICAL_EVIDENCE_GALLERY_MAX_VISIBLE;
  const displayedImages = images.slice(0, maxVisible);
  const additionalReviewedCount = Math.max(0, totalCount - maxVisible);

  const pdfChunks: ClinicalEvidenceImage[][] = [];
  if (mode === "pdf") {
    if (displayedImages.length <= CLINICAL_EVIDENCE_GALLERY_PDF_CHUNK_SIZE) {
      pdfChunks.push(displayedImages);
    } else {
      for (let i = 0; i < displayedImages.length; i += CLINICAL_EVIDENCE_GALLERY_PDF_CHUNK_SIZE) {
        pdfChunks.push(displayedImages.slice(i, i + CLINICAL_EVIDENCE_GALLERY_PDF_CHUNK_SIZE));
      }
    }
  }

  const evidenceProcessedLine = `${labels.evidenceProcessedPrefix} ${totalCount} ${labels.evidenceProcessedSuffix}`;

  return {
    totalCount,
    displayedImages,
    additionalReviewedCount,
    pdfOmittedCount: mode === "pdf" ? additionalReviewedCount : 0,
    pdfChunks,
    evidenceProcessedLine,
    additionalReviewedLine:
      mode === "web" && additionalReviewedCount > 0
        ? `+${additionalReviewedCount} additional images were reviewed as part of this assessment.`
        : null,
    pdfOmissionLine:
      mode === "pdf" && additionalReviewedCount > 0
        ? "Additional images were processed during analysis but omitted from PDF for layout optimisation."
        : null,
  };
}

function renderImageCard(img: ClinicalEvidenceImage, labels: ClinicalEvidenceGalleryLabels): string {
  const imgTag = img.imageUrl
    ? `<img src="${esc(img.imageUrl)}" alt="${esc(img.label)}" class="patientPhoto" />`
    : `<div class="photoPlaceholder">${esc(labels.noPhoto)}</div>`;

  return `
    <div class="imageCard clinicalEvidenceCard">
      ${imgTag}
      <div class="imageMeta">
        <div class="imageView">${esc(img.label)}</div>
      </div>
    </div>`;
}

export function renderClinicalEvidenceGalleryHtml(params: {
  images: ClinicalEvidenceImage[];
  labels: ClinicalEvidenceGalleryLabels;
  mode: "web" | "pdf";
}): string {
  const { images, labels, mode } = params;
  if (images.length === 0) return "";

  const model = buildClinicalEvidenceGalleryModel(images, mode, labels);

  const gridClass =
    mode === "pdf" && model.displayedImages.length > CLINICAL_EVIDENCE_GALLERY_PDF_CHUNK_SIZE
      ? "imageGrid imageGridPaginated"
      : "imageGrid";

  const galleryBody =
    mode === "pdf" && model.pdfChunks.length > 1
      ? model.pdfChunks
          .map(
            (chunk) => `
        <div class="evidenceGalleryChunk">
          <div class="${gridClass}">${chunk.map((img) => renderImageCard(img, labels)).join("")}</div>
        </div>`
          )
          .join("")
      : `<div class="${gridClass}">${model.displayedImages.map((img) => renderImageCard(img, labels)).join("")}</div>`;

  const additionalLine =
    mode === "web" && model.additionalReviewedLine
      ? `<p class="sectionLead clinicalEvidenceAdditional">${esc(model.additionalReviewedLine)}</p>`
      : "";

  const pdfOmissionLine =
    mode === "pdf" && model.pdfOmissionLine
      ? `<p class="sectionLead clinicalEvidencePdfOmission">${esc(model.pdfOmissionLine)}</p>`
      : "";

  return `
    <div class="section clinicalEvidenceSection">
      <div class="sectionHead"><h2>${esc(labels.title)}</h2></div>
      <p class="sectionLead">${esc(labels.subtitle)}</p>
      ${galleryBody}
      ${additionalLine}
      <div class="clinicalEvidenceProcessed">
        <p><strong>${esc(labels.evidenceProcessedPrefix)}:</strong> ${esc(`${model.totalCount} ${labels.evidenceProcessedSuffix}`)}</p>
        <p>${esc(labels.evidenceIncorporated)}</p>
      </div>
      ${pdfOmissionLine}
    </div>`;
}

export const CLINICAL_EVIDENCE_GALLERY_CSS = `
  .clinicalEvidenceSection { page-break-inside: auto; }
  .imageGrid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 12px;
  }
  .imageGridPaginated { margin-top: 0; }
  @media print {
    .imageGrid { grid-template-columns: repeat(3, 1fr); }
  }
  @media print and (max-width: 180mm) {
    .imageGrid { grid-template-columns: repeat(2, 1fr); }
  }
  .clinicalEvidenceCard { page-break-inside: avoid; break-inside: avoid; }
  .evidenceGalleryChunk {
    margin-top: 12px;
    page-break-inside: avoid;
  }
  .evidenceGalleryChunk + .evidenceGalleryChunk {
    margin-top: 18px;
    page-break-before: auto;
  }
  .clinicalEvidenceProcessed {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 11px;
  }
  .clinicalEvidenceProcessed p { margin: 0 0 6px; }
  .clinicalEvidenceAdditional { margin-top: 12px; font-weight: 600; color: var(--ink); }
  .clinicalEvidencePdfOmission { margin-top: 10px; font-style: italic; }
`;
