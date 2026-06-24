/**
 * HA-REPORT-5A — Clinical evidence review gallery tests.
 * Run: pnpm exec tsx --test tests/clinicalEvidenceGallery.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildClinicalEvidenceGalleryModel,
  buildClinicalEvidenceImagesFromPhotosByCategory,
  buildClinicalEvidenceUploadDescriptors,
  CLINICAL_EVIDENCE_GALLERY_MAX_VISIBLE,
  resolvePatientFriendlyPhotoLabel,
  renderClinicalEvidenceGalleryHtml,
} from "../src/lib/reports/clinicalEvidenceGallery";
import { buildPostSurgeryClinicalEvidenceGalleryLabelsEn } from "../src/lib/reports/postSurgeryReportLabels";

const labels = buildPostSurgeryClinicalEvidenceGalleryLabelsEn();

describe("HA-REPORT-5A clinical evidence gallery", () => {
  it("maps canonical categories to patient-friendly labels", () => {
    assert.equal(
      resolvePatientFriendlyPhotoLabel({ canonicalCategory: "preop_donor_rear" }),
      "Before Surgery — Back of Head"
    );
    assert.equal(
      resolvePatientFriendlyPhotoLabel({ canonicalCategory: "current_recipient_closeup" }),
      "Recipient Area Close-up"
    );
    assert.equal(resolvePatientFriendlyPhotoLabel({ canonicalCategory: "uncategorized" }), "Additional Clinical Image");
    assert.equal(resolvePatientFriendlyPhotoLabel({ rawLabel: "patient_photo:preop_front" }), "Additional Clinical Image");
  });

  it("flattens photosByCategory into review gallery images", () => {
    const images = buildClinicalEvidenceImagesFromPhotosByCategory({
      "Pre-op - preop front": [{ signedUrl: "https://cdn/a.jpg", label: "preop_front" }],
      "Pre-op - preop left": [{ signedUrl: "https://cdn/b.jpg", label: "preop_left" }],
    });
    assert.equal(images.length, 2);
    assert.equal(images[0]?.imageUrl, "https://cdn/a.jpg");
    assert.ok(images[0]?.label.length > 0);
  });

  it("limits visible gallery to 12 with additional reviewed count on web", () => {
    const images = Array.from({ length: 16 }, (_, i) => ({
      id: `img-${i}`,
      imageUrl: `https://cdn/${i}.jpg`,
      label: `View ${i}`,
    }));
    const model = buildClinicalEvidenceGalleryModel(images, "web", labels);
    assert.equal(model.totalCount, 16);
    assert.equal(model.displayedImages.length, CLINICAL_EVIDENCE_GALLERY_MAX_VISIBLE);
    assert.equal(model.additionalReviewedCount, 4);
    assert.match(model.additionalReviewedLine ?? "", /\+4 additional images/);
  });

  it("chunks PDF gallery for pagination when more than 6 images", () => {
    const images = Array.from({ length: 9 }, (_, i) => ({
      id: `img-${i}`,
      imageUrl: `https://cdn/${i}.jpg`,
      label: `View ${i}`,
    }));
    const model = buildClinicalEvidenceGalleryModel(images, "pdf", labels);
    assert.equal(model.pdfChunks.length, 2);
    assert.equal(model.pdfChunks[0]?.length, 6);
    assert.equal(model.pdfChunks[1]?.length, 3);
  });

  it("adds PDF omission notice when more than 12 images", () => {
    const images = Array.from({ length: 15 }, (_, i) => ({
      id: `img-${i}`,
      imageUrl: `https://cdn/${i}.jpg`,
      label: `View ${i}`,
    }));
    const model = buildClinicalEvidenceGalleryModel(images, "pdf", labels);
    assert.equal(model.displayedImages.length, 12);
    assert.equal(model.pdfOmittedCount, 3);
    assert.match(model.pdfOmissionLine ?? "", /omitted from PDF for layout optimisation/i);
  });

  it("renders evidence completeness statement with total reviewed count", () => {
    const html = renderClinicalEvidenceGalleryHtml({
      images: Array.from({ length: 10 }, (_, i) => ({
        id: `img-${i}`,
        imageUrl: `https://cdn/${i}.jpg`,
        label: "Front View",
      })),
      labels,
      mode: "web",
    });
    assert.match(html, /Clinical Evidence Reviewed/);
    assert.match(html, /10 clinical images reviewed during analysis/);
    assert.match(html, /incorporates all submitted visual evidence/i);
    assert.match(html, /clinicalEvidenceCard/);
  });

  it("builds upload descriptors from patient_photo uploads only", () => {
    const descriptors = buildClinicalEvidenceUploadDescriptors([
      { id: "1", type: "patient_photo:preop_front", storage_path: "cases/x/preop_front/a.jpg" },
      { id: "2", type: "doctor_photo:preop_front", storage_path: "cases/x/doctor/a.jpg" },
      { id: "3", type: "patient_photo:preop_left", storage_path: "cases/x/preop_left/b.jpg" },
    ]);
    assert.equal(descriptors.length, 2);
    assert.equal(descriptors[0]?.categoryKey, "preop_front");
  });
});
