import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapSeverityToConcernBand,
  maxConcernBand,
  normalizeForensicSeverity,
  PATIENT_CLINICAL_SAFETY_DISCLAIMER,
} from "../src/lib/reports/patientConcernBands";
import {
  buildPatientSafeReportSummary,
  buildPatientSafeSummaryObservations,
} from "../src/lib/reports/patientSafeSummary";
import {
  computeRequiredUploadProgress,
  formatPatientUploadError,
  PATIENT_UPLOAD_SAVE_LATER_MESSAGE,
} from "../src/lib/uploads/patientUploadClient";
import { formatUploadErrorForUser } from "../src/lib/uploads/safeUpload";

describe("patient concern bands", () => {
  it("maps forensic severity to patient-facing bands", () => {
    assert.equal(mapSeverityToConcernBand("low"), "minor");
    assert.equal(mapSeverityToConcernBand("medium"), "needs_review");
    assert.equal(mapSeverityToConcernBand("high"), "significant");
    assert.equal(mapSeverityToConcernBand("critical"), "urgent");
  });

  it("elevates red flags appropriately", () => {
    assert.equal(mapSeverityToConcernBand("high", { isRedFlag: true }), "significant");
    assert.equal(mapSeverityToConcernBand("critical", { isRedFlag: true }), "urgent");
    assert.equal(mapSeverityToConcernBand(null, { isRedFlag: true }), "needs_review");
  });

  it("picks the highest concern band", () => {
    assert.equal(maxConcernBand("minor", "significant"), "significant");
    assert.equal(maxConcernBand("needs_review", "urgent"), "urgent");
  });

  it("normalizes severity strings", () => {
    assert.equal(normalizeForensicSeverity("HIGH"), "high");
    assert.equal(normalizeForensicSeverity("nope"), null);
  });
});

describe("patient safe report summary", () => {
  const sampleSummary = {
    key_findings: [
      { title: "Donor healing appears within expected range", severity: "low" },
      { title: "Crown density may need follow-up review", severity: "high", impact: "May affect long-term appearance" },
    ],
    red_flags: ["Uneven graft placement flagged on day-3 image"],
  };

  it("builds structured report with concern band at top", () => {
    const report = buildPatientSafeReportSummary(sampleSummary, { score: 72 });
    assert.ok(report.plainEnglishSummary.includes("72"));
    assert.equal(report.overallConcernBand, "significant");
    assert.ok(report.concernItems.length >= 1);
    assert.ok(report.clinicalDisclaimer.includes("not a medical diagnosis"));
    assert.equal(report.clinicalDisclaimer, PATIENT_CLINICAL_SAFETY_DISCLAIMER);
  });

  it("uses cautious language in plain English summary", () => {
    const report = buildPatientSafeReportSummary(sampleSummary, { score: 72 });
    assert.match(report.plainEnglishSummary, /may need|follow up|clinician/i);
  });

  it("preserves backward-compatible observations list", () => {
    const obs = buildPatientSafeSummaryObservations(sampleSummary);
    assert.ok(obs.length >= 2);
    assert.ok(obs.some((o) => o.concernBand === "significant" || o.isRedFlag));
  });

  it("shows none band when no findings", () => {
    const report = buildPatientSafeReportSummary({}, { score: 90 });
    assert.equal(report.overallConcernBand, "none");
    assert.match(report.plainEnglishSummary, /acceptable/i);
  });

  it("surfaces impact and next steps when present", () => {
    const report = buildPatientSafeReportSummary(
      {
        key_findings: [
          {
            title: "Donor scar visibility noted",
            severity: "medium",
            impact: "May affect styling options",
            recommended_next_step: "Discuss with your surgeon at next visit",
          },
        ],
      },
      { score: 65 }
    );
    const item = report.observations[0];
    assert.equal(item.impact, "May affect styling options");
    assert.equal(item.recommendedNextStep, "Discuss with your surgeon at next visit");
  });
});

describe("patient upload client helpers", () => {
  it("formats upload errors for patients", () => {
    const err = formatPatientUploadError({
      code: "FILE_TOO_LARGE",
      error: "too big",
    });
    assert.match(err.message, /too large|Large/i);
    assert.equal(err.retryable, false);
  });

  it("marks retryable storage errors", () => {
    const err = formatPatientUploadError({ code: "STORAGE_ERROR", error: "fail" });
    assert.equal(err.retryable, true);
  });

  it("computes required upload progress", () => {
    const completed = new Set(["patient_current_front", "patient_current_top"]);
    const p = computeRequiredUploadProgress(
      ["patient_current_front", "patient_current_top", "patient_current_donor_rear"],
      completed
    );
    assert.equal(p.completed, 2);
    assert.equal(p.total, 3);
    assert.equal(p.percent, 67);
  });

  it("documents save-and-continue behaviour", () => {
    assert.match(PATIENT_UPLOAD_SAVE_LATER_MESSAGE, /save automatically/i);
  });

  it("uses friendly messages from safeUpload", () => {
    assert.match(
      formatUploadErrorForUser({ code: "INVALID_CATEGORY", message: "bad", retryable: false }),
      /refresh/i
    );
  });
});

describe("unsupported file type messaging", () => {
  it("surfaces validation errors clearly", () => {
    const msg = formatUploadErrorForUser({
      code: "VALIDATION_ERROR",
      message: "Unsupported image format. Use JPEG, PNG, or WebP.",
      retryable: false,
    });
    assert.match(msg, /JPEG|PNG|WebP/i);
  });
});
