/**
 * HA-QA-7B — Urgent failed case recovery coverage.
 * Run: pnpm exec tsx --test tests/hairauditFailedCaseRecovery.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluatePatientPhotoSubmitGate } from "@/lib/patientPhoto/patientPhotoReadinessPolicy";
import {
  AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
  evaluateImageLimitedPhotoOverride,
  getMissingRequiredPatientPhotoLabels,
  IMAGE_LIMITED_AUDIT_PATIENT_NOTICE,
} from "@/lib/patient/patientPhotoImageLimitedOverride";
import { buildClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryUtils";
import { formatClinicalHistoryForPrompt } from "@/lib/hairaudit/clinical-history/clinicalHistory.server";
import { buildPatientSafeReportSummary } from "@/lib/reports/patientSafeSummary";
import { renderEliteReportHtml, type EliteReportViewModel } from "@/lib/reports/EliteReportHtml";
import type { AuditMode, ReportViewModel } from "@/lib/pdf/reportBuilder";
import { buildRequiredPhotoChecklist } from "@/lib/auditor/auditorImageSortingUx";
import {
  FAILED_CASE_RECOVERY_CLINICAL_HISTORY_ROW,
  FAILED_CASE_RECOVERY_PATIENT_ANSWERS,
  FAILED_CASE_RECOVERY_PATHWAY,
  FAILED_CASE_RECOVERY_UPLOAD_ROWS,
} from "./fixtures/hairauditFailedCaseRecovery";

const uploadRows = [...FAILED_CASE_RECOVERY_UPLOAD_ROWS];
const clinicalHistory = buildClinicalHistorySnapshot(FAILED_CASE_RECOVERY_CLINICAL_HISTORY_ROW);

function evaluateRecoveryScenario(auditorRerunReason: string) {
  const photoGate = evaluatePatientPhotoSubmitGate({
    uploadRows,
    patientAnswers: FAILED_CASE_RECOVERY_PATIENT_ANSWERS,
    stageAwareSubmitEnabled: false,
    patientReviewPathway: FAILED_CASE_RECOVERY_PATHWAY,
  });
  const overrideEval = evaluateImageLimitedPhotoOverride({
    auditorRerunReason,
    photoGateAllowed: photoGate.allowed,
    uploadRows,
    clinicalHistory,
  });
  return { photoGate, overrideEval };
}

function buildForensicReportPayload(overrideAllowed: boolean, missingLabels: string[]) {
  return {
    key_findings: [],
    red_flags: [],
    forensic_audit: {
      imageLimitedAssessment: overrideAllowed,
      documentAssistedAssessment: overrideAllowed,
      missingRequiredPhotoLabels: overrideAllowed ? missingLabels : [],
    },
  };
}

function makeImageLimitedEliteVm(): EliteReportViewModel {
  const viewModel = {
    caseId: "recovery-case",
    version: 1,
    generatedAt: "2026-06-24",
    auditMode: "patient" as AuditMode,
    score: 68,
    donorQuality: "Moderate",
    graftSurvival: "Favorable",
    findings: [],
    areaScores: {},
    images: [],
    forensic: {
      key_findings: [],
      red_flags: [],
      imageLimitedAssessment: true,
      documentAssistedAssessment: true,
    },
  } satisfies ReportViewModel;

  return {
    viewModel,
    caseId: "recovery-case",
    generatedAt: "2026-06-24",
    version: 1,
    metrics: {
      donorQuality: "Moderate",
      graftSurvival: "Favorable",
      transectionRisk: "Low",
      implantationDensity: "Limited coverage",
      hairlineNaturalness: "Acceptable",
      donorScarVisibility: "Not assessable",
    },
    areaDomains: [],
    sectionScores: [],
    highlights: [],
    risks: [],
    radar: {
      labels: ["Donor", "Recipient"],
      values: [65, 70],
      overall: 68,
      confidence: 0.55,
    },
    photosByCategory: {},
  };
}

describe("HA-QA-7B failed case recovery fixture", () => {
  it("models post-surgery case with partial uploads and structured clinical history", () => {
    assert.equal(FAILED_CASE_RECOVERY_PATHWAY, "post_surgery");
    assert.ok(uploadRows.some((u) => u.type.includes("patient_current_front")));
    assert.ok(uploadRows.some((u) => u.type.includes("graft_count_board")));
    assert.equal(FAILED_CASE_RECOVERY_CLINICAL_HISTORY_ROW.prior_graft_count, 3200);
    assert.equal(FAILED_CASE_RECOVERY_CLINICAL_HISTORY_ROW.estimated_hair_count, 6400);
    assert.equal(FAILED_CASE_RECOVERY_CLINICAL_HISTORY_ROW.average_hairs_per_graft, 2.0);
    assert.ok(FAILED_CASE_RECOVERY_CLINICAL_HISTORY_ROW.clinician_summary);
  });

  it("auditor checklist shows pathway missing views while submit gate lists required patient views", () => {
    const checklist = buildRequiredPhotoChecklist(FAILED_CASE_RECOVERY_PATHWAY, uploadRows);
    const missingPathway = checklist.filter((item) => !item.satisfied);
    assert.ok(missingPathway.length >= 3);
    assert.ok(missingPathway.some((item) => /top|crown/i.test(item.label)));

    const missingSubmitLabels = getMissingRequiredPatientPhotoLabels(uploadRows);
    assert.ok(missingSubmitLabels.length >= 2);
    assert.ok(missingSubmitLabels.some((l) => /top|crown/i.test(l)));
    assert.ok(missingSubmitLabels.some((l) => /donor|rear|back/i.test(l)));
  });
});

describe("HA-QA-7B failed case recovery gate and override", () => {
  it("evaluatePatientPhotoSubmitGate fails for the failed-case fixture", () => {
    const { photoGate } = evaluateRecoveryScenario("auditor_review_request");
    assert.equal(photoGate.allowed, false);
  });

  it("normal auditor rerun reason does not enable image-limited override", () => {
    const { overrideEval } = evaluateRecoveryScenario("auditor_review_request");
    assert.equal(overrideEval.allowed, false);
  });

  it("document_assisted_image_limited rerun passes with images and clinical history", () => {
    const { overrideEval } = evaluateRecoveryScenario(AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED);
    assert.equal(overrideEval.allowed, true);
    assert.equal(overrideEval.hasClinicalHistory, true);
    assert.equal(overrideEval.hasPatientImages, true);
    assert.ok(overrideEval.missingRequiredPhotoLabels.length >= 2);
  });

  it("maps override to imageLimitedAssessment and documentAssistedAssessment flags", () => {
    const { overrideEval } = evaluateRecoveryScenario(AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED);
    const forensic = buildForensicReportPayload(
      overrideEval.allowed,
      overrideEval.missingRequiredPhotoLabels
    );
    assert.equal(forensic.forensic_audit.imageLimitedAssessment, true);
    assert.equal(forensic.forensic_audit.documentAssistedAssessment, true);
    assert.deepEqual(
      forensic.forensic_audit.missingRequiredPhotoLabels,
      overrideEval.missingRequiredPhotoLabels
    );
  });

  it("includes clinical history in AI prompt context", () => {
    const prompt = formatClinicalHistoryForPrompt(clinicalHistory);
    assert.match(prompt, /Prior graft count: 3200/);
    assert.match(prompt, /Estimated hair count: 6400/);
    assert.match(prompt, /Average hairs per graft: 2/);
    assert.match(prompt, /Supporting document notes:/);
    assert.match(prompt, /Clinician summary \(internal\):/);
    assert.match(prompt, /DONOR MANAGEMENT/);
  });

  it("generated report data includes image-limited notice flag and copy", () => {
    const { overrideEval } = evaluateRecoveryScenario(AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED);
    const summary = buildPatientSafeReportSummary(
      buildForensicReportPayload(overrideEval.allowed, overrideEval.missingRequiredPhotoLabels)
    );
    assert.equal(summary.imageLimitedNotice, IMAGE_LIMITED_AUDIT_PATIENT_NOTICE);
    assert.match(summary.imageLimitedNotice ?? "", /Image-limited audit/);
    assert.match(summary.imageLimitedNotice ?? "", /Some required photo views were not available/);
  });

  it("web report HTML renders image-limited notice banner", () => {
    const html = renderEliteReportHtml(makeImageLimitedEliteVm());
    assert.match(html, /Image-limited audit/);
    assert.match(html, /Some required photo views were not available/);
  });

  it("PDF builder path references image-limited notice helper", () => {
    const pdf = readFileSync(join(process.cwd(), "src/lib/pdf/reportBuilder.ts"), "utf8");
    assert.match(pdf, /addImageLimitedNoticeIfNeeded/);
    assert.match(pdf, /IMAGE_LIMITED_AUDIT_PATIENT_NOTICE/);
  });
});

describe("HA-QA-7B regression guards", () => {
  it("patient-side submit remains strict even with clinical history present", () => {
    const gate = evaluatePatientPhotoSubmitGate({
      uploadRows,
      patientAnswers: FAILED_CASE_RECOVERY_PATIENT_ANSWERS,
      stageAwareSubmitEnabled: false,
      patientReviewPathway: FAILED_CASE_RECOVERY_PATHWAY,
    });
    assert.equal(gate.allowed, false);
  });

  it("image-limited override cannot run with no image and no clinical history", () => {
    const photoGate = evaluatePatientPhotoSubmitGate({
      uploadRows: [],
      patientAnswers: FAILED_CASE_RECOVERY_PATIENT_ANSWERS,
      stageAwareSubmitEnabled: false,
    });
    const evalResult = evaluateImageLimitedPhotoOverride({
      auditorRerunReason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      photoGateAllowed: photoGate.allowed,
      uploadRows: [],
      clinicalHistory: null,
    });
    assert.equal(evalResult.allowed, false);
  });

  it("non-auditor cannot use image-limited rerun API", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/auditor/rerun/route.ts"), "utf8");
    assert.match(route, /isAuditor\(/);
    assert.match(route, /Forbidden: auditors only/);
  });

  it("standard audit reports do not show image-limited notice", () => {
    const summary = buildPatientSafeReportSummary({
      key_findings: [{ title: "Routine finding", severity: "low" }],
      forensic_audit: { imageLimitedAssessment: false },
    });
    assert.equal(summary.imageLimitedNotice, undefined);

    const html = renderEliteReportHtml({
      ...makeImageLimitedEliteVm(),
      viewModel: {
        ...makeImageLimitedEliteVm().viewModel,
        forensic: { key_findings: [], red_flags: [], imageLimitedAssessment: false },
      },
    });
    assert.doesNotMatch(html, /Image-limited audit/);
  });

  it("runAudit wires image-limited flags only through explicit override reason", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/inngest/functions.ts"), "utf8");
    assert.match(src, /imageLimitedAssessment: imageLimitedOverride\.allowed/);
    assert.match(src, /documentAssistedAssessment: imageLimitedOverride\.allowed/);
    assert.match(src, /missing_photo_override_used/);
  });
});
