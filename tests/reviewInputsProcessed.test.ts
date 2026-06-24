import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewInputsProcessed,
  buildReviewInputsProcessedLabelsEn,
  renderReviewInputsProcessedHtml,
} from "../src/lib/reports/reviewInputsProcessed";
import { generatePostSurgeryAuditReport } from "../src/lib/reports/postSurgeryAuditReport";
import { generatePreSurgeryPlanningReport } from "../src/lib/reports/preSurgeryPlanningReport";

describe("reviewInputsProcessed", () => {
  const caseId = "00000000-0000-4000-8000-000000000099";

  const postSummary = {
    forensic_audit: {
      overall_score: 72,
      section_scores: {
        donor_management: 68,
        extraction_quality: 74,
        density_distribution: 81,
        recipient_placement: 76,
        hairline_design: 72,
        post_op_course_and_aftercare: 78,
      },
      key_findings: [{ title: "Recipient density relative to stated graft count", severity: "low" }],
      red_flags: [],
      photo_observations: [
        { category: "front", observation: "Frontal density reviewed relative to graft count." },
        { category: "donor_rear", observation: "Donor extraction patterns reviewed." },
      ],
    },
  };

  const preSummary = {
    forensic_audit: {
      overall_score: 70,
      section_scores: {
        donor_management: 75,
        hair_loss_pattern: 68,
      },
      key_findings: [],
      red_flags: [],
    },
  };

  it("builds post-surgery checklist from processed report data", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId,
      patientReviewPathway: "post_surgery",
    });

    const content = buildReviewInputsProcessed({
      pathway: "post_surgery",
      postReport: report,
      uploads: [
        {
          id: "img-1",
          type: "patient_photo:front_preop",
          storage_path: "cases/a/front.jpg",
        },
        {
          id: "img-2",
          type: "patient_photo:donor_rear",
          storage_path: "cases/a/donor.jpg",
        },
      ],
    });

    assert.equal(content.title, "What We Reviewed");
    assert.ok(content.items.some((item) => item.id === "procedure_data"));
    assert.ok(content.items.some((item) => item.id === "donor_analysis"));
    assert.ok(content.items.some((item) => item.id === "repair_probability"));
    assert.ok(content.items.some((item) => item.id === "graft_count_data"));

    const imagesItem = content.items.find((item) => item.id === "clinical_images");
    assert.ok(imagesItem);
    assert.equal(imagesItem?.imageCount, 2);
    assert.match(content.resolvedLabels.join(" "), /2 clinical images reviewed/);
  });

  it("omits clinical images item when no images were uploaded", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId,
      patientReviewPathway: "post_surgery",
    });

    const content = buildReviewInputsProcessed({
      pathway: "post_surgery",
      postReport: report,
    });

    assert.ok(!content.items.some((item) => item.id === "clinical_images"));
  });

  it("builds pre-surgery pathway-specific checklist items", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: preSummary,
      caseId,
      patientReviewPathway: "pre_surgery",
    });

    const content = buildReviewInputsProcessed({
      pathway: "pre_surgery",
      preReport: report,
    });

    assert.ok(content.items.some((item) => item.id === "hair_loss_pattern"));
    assert.ok(content.items.some((item) => item.id === "donor_reserve"));
    assert.ok(content.items.some((item) => item.id === "surgical_candidacy"));
    assert.ok(content.items.some((item) => item.id === "future_planning"));
    assert.ok(!content.items.some((item) => item.id === "healing_patterns"));
  });

  it("renders mandatory summary statements in PDF HTML", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId,
      patientReviewPathway: "post_surgery",
    });

    const html = renderReviewInputsProcessedHtml(
      buildReviewInputsProcessed({
        pathway: "post_surgery",
        postReport: report,
        labels: buildReviewInputsProcessedLabelsEn(),
      })
    );

    assert.match(html, /What We Reviewed/);
    assert.match(html, /multiple layers of procedural review, image analysis, clinical context/);
    assert.match(html, /structured clinical assessment protocols/);
    assert.match(html, /reviewInputsGrid/);
    assert.ok(!html.toLowerCase().includes("forensic"));
    assert.ok(!html.toLowerCase().includes("auditos"));
  });

  it("uses dynamic image count from photosByCategory for PDF context", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId,
      patientReviewPathway: "post_surgery",
    });

    const content = buildReviewInputsProcessed({
      pathway: "post_surgery",
      postReport: report,
      photosByCategory: {
        "Front - front_preop": [
          { signedUrl: "https://example.com/1.jpg", label: "Front" },
          { signedUrl: "https://example.com/2.jpg", label: "Front 2" },
        ],
        "Donor - donor_rear": [{ signedUrl: "https://example.com/3.jpg", label: "Donor" }],
      },
    });

    const imagesItem = content.items.find((item) => item.id === "clinical_images");
    assert.equal(imagesItem?.imageCount, 3);
    assert.match(content.resolvedLabels.join(" "), /3 clinical images reviewed/);
  });
});
