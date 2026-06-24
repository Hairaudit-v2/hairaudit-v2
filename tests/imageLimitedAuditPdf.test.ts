/**
 * HA-FIX-8G — image-limited audit must trigger PDF render after report insert.
 * Run: pnpm exec tsx --test tests/imageLimitedAuditPdf.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluatePdfReadiness,
  evaluateStoredPdfReadiness,
  isImageLimitedAuditSummary,
  resolveReportPdfStoragePath,
} from "@/lib/reports/pdfReadiness";

const CASE_ID = "22222222-2222-4222-8222-222222222222";

const IMAGE_LIMITED_SUMMARY = {
  score: 58,
  section_scores: {},
  forensic_audit: {
    summary:
      "Image-limited assessment based on available documentation and partial photo views.",
    imageLimitedAssessment: true,
    documentAssistedAssessment: true,
    missingRequiredPhotoLabels: ["Top view", "Donor rear"],
  },
};

describe("HA-FIX-8G image-limited audit PDF trigger", () => {
  it("successful image-limited audit is eligible to trigger PDF render while status is processing", () => {
    assert.equal(isImageLimitedAuditSummary(IMAGE_LIMITED_SUMMARY), true);
    const readiness = evaluatePdfReadiness({
      caseStatus: "processing",
      reportStatus: "processing",
      summary: IMAGE_LIMITED_SUMMARY,
    });
    assert.equal(readiness.ready, true, "render must not be blocked by processing fallback status");
  });

  it("pdf_path resolves to the same key render writes", () => {
    const version = 4;
    const expected = `${CASE_ID}/v${version}.pdf`;
    assert.equal(
      resolveReportPdfStoragePath({ caseId: CASE_ID, version, pdfPath: expected }),
      expected
    );
    const stored = evaluateStoredPdfReadiness({
      expectedPdfPath: expected,
      storedPdfPath: expected,
      fileExists: true,
    });
    assert.equal(stored.ready, true);
  });

  it("pending does not remain when storage file exists at expected path", () => {
    const path = `${CASE_ID}/v2.pdf`;
    const stored = evaluateStoredPdfReadiness({
      expectedPdfPath: path,
      storedPdfPath: path,
      fileExists: true,
    });
    assert.equal(stored.ready, true);
    assert.equal(
      evaluateStoredPdfReadiness({ expectedPdfPath: path, storedPdfPath: path, fileExists: false }).ready,
      false
    );
  });

  it("no duplicate render when existing PDF present (pipeline skip guard)", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/inngest/functions.ts"), "utf8");
    assert.match(src, /if \(phaseState\.fileReady\)/);
    assert.match(src, /PDF already present in storage; skipping render/);
    assert.match(src, /render-pdf-\$\{attempt\}/);
  });

  it("render step persists pdf_path via persistReportPdfPath", () => {
    const rebuild = readFileSync(join(process.cwd(), "src/lib/reports/rebuildReportPdf.ts"), "utf8");
    const pipeline = readFileSync(join(process.cwd(), "src/lib/inngest/functions.ts"), "utf8");
    assert.match(rebuild, /persistReportPdfPath/);
    assert.match(pipeline, /persistReportPdfPath\(\{/);
    assert.match(pipeline, /reportId: insertedReportId/);
  });

  it("PDF render uses elite template via print route (HA-FIX-8E)", () => {
    const renderInternal = readFileSync(join(process.cwd(), "src/lib/reports/renderPdfInternal.ts"), "utf8");
    const generate = readFileSync(join(process.cwd(), "src/lib/pdf/generateReportPdf.ts"), "utf8");
    assert.match(renderInternal, /generateReportPdfFromUrl/);
    assert.match(generate, /validatePdfPreflightTemplateHeader/);
    assert.match(generate, /template = "elite"/);
  });
});
