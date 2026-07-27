/**
 * HA-PROJECTION-1G — Print routing / PDF URL contract tests.
 * Run: pnpm exec tsx --test tests/longitudinalProjectionReviewRouting.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildPdfUrl } from "@/lib/reports/pdfUrl";
import {
  shouldUseLongitudinalProjectionReviewTemplate,
  resolveLongitudinalProjectionReviewTemplateName,
  extractLongitudinalAssessmentTypeFromSummary,
} from "@/lib/reports/longitudinalProjectionReview";
import { normalizeReportTemplateForPdf } from "@/lib/pdf/normalizeReportTemplateForPdf";

describe("HA-PROJECTION-1G routing", () => {
  it("pdf URL can carry frozen snapshot identities for historical re-render", () => {
    const url = buildPdfUrl({
      caseId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      auditMode: "patient",
      token: "test-token",
      baseUrl: "https://example.test",
      assessmentType: "longitudinal_projection_review",
      projectionSnapshotId: "11111111-1111-1111-1111-111111111111",
      observationSnapshotId: "22222222-2222-2222-2222-222222222222",
      comparisonSnapshotId: "33333333-3333-3333-3333-333333333333",
    });
    assert.match(url, /assessmentType=longitudinal_projection_review/);
    assert.match(url, /projectionSnapshotId=11111111-1111-1111-1111-111111111111/);
    assert.match(url, /observationSnapshotId=22222222-2222-2222-2222-222222222222/);
    assert.match(url, /comparisonSnapshotId=33333333-3333-3333-3333-333333333333/);
  });

  it("template normalization maps longitudinal review to elite PDF header", () => {
    assert.equal(
      normalizeReportTemplateForPdf("longitudinal_projection_review"),
      "elite"
    );
    assert.equal(
      resolveLongitudinalProjectionReviewTemplateName(
        "longitudinal_projection_review",
        "patient"
      ),
      "longitudinal-projection-review"
    );
  });

  it("extracts longitudinal assessment type from summary", () => {
    assert.equal(
      extractLongitudinalAssessmentTypeFromSummary({
        assessmentType: "longitudinal_projection_review",
      }),
      "longitudinal_projection_review"
    );
    assert.equal(
      extractLongitudinalAssessmentTypeFromSummary({
        longitudinal_projection_review: {
          assessmentType: "longitudinal_projection_review",
        },
      }),
      "longitudinal_projection_review"
    );
  });

  it("print route wires longitudinal before surgery-day projection", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/print/report/route.ts"),
      "utf8"
    );
    assert.match(route, /HA-PROJECTION-1G/);
    assert.match(route, /LONGITUDINAL_REVIEW_NOT_READY/);
    assert.match(route, /observationSnapshotId/);
    assert.match(route, /comparisonSnapshotId/);
    assert.equal(
      shouldUseLongitudinalProjectionReviewTemplate(
        "surgery_day_projection",
        "patient"
      ),
      false
    );
  });
});
