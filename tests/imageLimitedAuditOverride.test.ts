import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluatePatientPhotoSubmitGate } from "@/lib/patientPhoto/patientPhotoReadinessPolicy";
import {
  AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
  evaluateImageLimitedPhotoOverride,
  getMissingRequiredPatientPhotoLabels,
  hasActivePatientPhotosForImageLimitedOverride,
} from "@/lib/patient/patientPhotoImageLimitedOverride";
import { evaluateRunAuditPatientPhotoGate } from "@/lib/patient/runAuditPhotoGate";
import {
  buildRunAuditInvokePayload,
  resolveRunAuditEventData,
  unwrapRunAuditInvokePayload,
} from "@/lib/inngest/runAuditEventData";
import { buildClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryUtils";
import type { CaseClinicalHistoryRow } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import { AUDITOR_RERUN_REASONS } from "@/lib/auditor/queueAuditorRerun";
import { buildPatientSafeReportSummary } from "@/lib/reports/patientSafeSummary";
import { PATIENT_IMAGE_LIMITED_TRUST_NOTICE } from "@/lib/patient/patientTrustStatusTranslator";
import {
  FAILED_CASE_RECOVERY_CLINICAL_HISTORY_ROW,
  FAILED_CASE_RECOVERY_PATIENT_ANSWERS,
  FAILED_CASE_RECOVERY_PATHWAY,
  FAILED_CASE_RECOVERY_UPLOAD_ROWS,
} from "./fixtures/hairauditFailedCaseRecovery";

const clinicalRow: CaseClinicalHistoryRow = {
  id: "11111111-1111-4111-8111-111111111111",
  case_id: "22222222-2222-4222-8222-222222222222",
  prior_surgery_count: 1,
  prior_procedure_type: "fue",
  prior_surgery_date: "2024-06-15",
  prior_surgery_timing_note: null,
  prior_clinic_name: null,
  prior_surgeon_name: null,
  prior_graft_count: 3200,
  estimated_hair_count: null,
  average_hairs_per_graft: 2.0,
  single_hair_grafts: null,
  double_hair_grafts: null,
  triple_hair_grafts: null,
  quadruple_hair_grafts: null,
  donor_grafts_removed: null,
  punch_size_mm: null,
  extraction_method: null,
  implantation_method: null,
  transection_rate_percent: null,
  survival_estimate_percent: null,
  recipient_zones: [],
  donor_depletion_level: "unknown",
  donor_reserve_assessment: null,
  visible_scarring_level: "unknown",
  surgical_technique_notes: null,
  medication_history: {},
  supporting_document_notes: "Operative PDF",
  clinician_summary: null,
  created_by: null,
  updated_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const partialUploads = [{ type: "patient_photo:patient_current_front" }];
const noUploads: { type: string }[] = [];

describe("image-limited photo override gate", () => {
  it("patient submission gate still fails with missing required photos", () => {
    const gate = evaluatePatientPhotoSubmitGate({
      uploadRows: partialUploads,
      patientAnswers: {},
      stageAwareSubmitEnabled: false,
    });
    assert.equal(gate.allowed, false);
  });

  it("normal auditor rerun without override reason still fails gate eval", () => {
    const evalResult = evaluateImageLimitedPhotoOverride({
      auditorRerunReason: "auditor_review_request",
      photoGateAllowed: false,
      uploadRows: partialUploads,
      clinicalHistory: buildClinicalHistorySnapshot(clinicalRow),
    });
    assert.equal(evalResult.allowed, false);
  });

  it("document_assisted_image_limited with meaningful clinical history passes", () => {
    const evalResult = evaluateImageLimitedPhotoOverride({
      auditorRerunReason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      photoGateAllowed: false,
      uploadRows: noUploads,
      clinicalHistory: buildClinicalHistorySnapshot(clinicalRow),
      triggeredRole: "auditor",
      rerunSource: "auditor",
    });
    assert.equal(evalResult.allowed, true);
    assert.equal(evalResult.hasClinicalHistory, true);
    assert.equal(evalResult.hasPatientImages, false);
  });

  it("document_assisted_image_limited with at least one patient image passes", () => {
    const evalResult = evaluateImageLimitedPhotoOverride({
      auditorRerunReason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      photoGateAllowed: false,
      uploadRows: partialUploads,
      clinicalHistory: null,
      triggeredRole: "auditor",
      rerunSource: "auditor",
    });
    assert.equal(evalResult.allowed, true);
    assert.equal(evalResult.hasPatientImages, true);
  });

  it("override with no images and no clinical history fails", () => {
    const evalResult = evaluateImageLimitedPhotoOverride({
      auditorRerunReason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      photoGateAllowed: false,
      uploadRows: noUploads,
      clinicalHistory: null,
    });
    assert.equal(evalResult.allowed, false);
  });

  it("override does not apply when photo gate already satisfied", () => {
    const fullUploads = [
      { type: "patient_photo:patient_current_front" },
      { type: "patient_photo:patient_current_top" },
      { type: "patient_photo:patient_current_donor_rear" },
    ];
    const gate = evaluatePatientPhotoSubmitGate({
      uploadRows: fullUploads,
      patientAnswers: {},
      stageAwareSubmitEnabled: false,
    });
    assert.equal(gate.allowed, true);
    const evalResult = evaluateImageLimitedPhotoOverride({
      auditorRerunReason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      photoGateAllowed: gate.allowed,
      uploadRows: fullUploads,
      clinicalHistory: buildClinicalHistorySnapshot(clinicalRow),
    });
    assert.equal(evalResult.allowed, false);
  });

  it("lists missing required photo labels", () => {
    const labels = getMissingRequiredPatientPhotoLabels(partialUploads);
    assert.ok(labels.length >= 2);
    assert.ok(labels.some((l) => /top|donor|rear|back/i.test(l)));
  });

  it("override requires auditor actor unless allowImageLimitedOverride flag set", () => {
    const clinicalHistory = buildClinicalHistorySnapshot(clinicalRow);
    const withoutActor = evaluateImageLimitedPhotoOverride({
      auditorRerunReason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      photoGateAllowed: false,
      uploadRows: noUploads,
      clinicalHistory,
    });
    assert.equal(withoutActor.allowed, false);

    const withActor = evaluateImageLimitedPhotoOverride({
      auditorRerunReason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      photoGateAllowed: false,
      uploadRows: noUploads,
      clinicalHistory,
      triggeredRole: "auditor",
      rerunSource: "auditor",
    });
    assert.equal(withActor.allowed, true);

    const withFlag = evaluateImageLimitedPhotoOverride({
      auditorRerunReason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      photoGateAllowed: false,
      uploadRows: noUploads,
      clinicalHistory,
      allowImageLimitedOverride: true,
    });
    assert.equal(withFlag.allowed, true);
  });
});

describe("runAudit photo gate (HA-FIX-8D regression)", () => {
  const clinicalHistory = buildClinicalHistorySnapshot(FAILED_CASE_RECOVERY_CLINICAL_HISTORY_ROW);
  const uploadRows = [...FAILED_CASE_RECOVERY_UPLOAD_ROWS];

  it("document_assisted_image_limited passes runAudit photo gate with clinical history", () => {
    const result = evaluateRunAuditPatientPhotoGate({
      caseId: "case-1",
      uploadRows,
      patientAnswers: FAILED_CASE_RECOVERY_PATIENT_ANSWERS,
      clinicalHistory,
      stageAwareSubmitEnabled: false,
      patientReviewPathway: FAILED_CASE_RECOVERY_PATHWAY,
      patientPhotosForAuditCount: uploadRows.filter((u) =>
        String(u.type).startsWith("patient_photo:")
      ).length,
      auditorRerunReason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      triggeredRole: "auditor",
      rerunSource: "auditor",
      allowImageLimitedOverride: true,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.imageLimitedOverride.allowed, true);
    assert.equal(result.logFields.imageLimitedOverrideEligible, true);
    assert.equal(result.logFields.hasMeaningfulClinicalHistory, true);
    assert.ok(result.logFields.missingRequiredPhotoLabels.length >= 2);
  });

  it("normal auditor rerun still blocks runAudit photo gate with same missing photos", () => {
    const result = evaluateRunAuditPatientPhotoGate({
      caseId: "case-1",
      uploadRows,
      patientAnswers: FAILED_CASE_RECOVERY_PATIENT_ANSWERS,
      clinicalHistory,
      stageAwareSubmitEnabled: false,
      patientReviewPathway: FAILED_CASE_RECOVERY_PATHWAY,
      patientPhotosForAuditCount: uploadRows.filter((u) =>
        String(u.type).startsWith("patient_photo:")
      ).length,
      auditorRerunReason: "auditor_review_request",
      triggeredRole: "auditor",
      rerunSource: "auditor",
    });

    assert.equal(result.allowed, false);
    assert.equal(result.imageLimitedOverride.allowed, false);
    assert.equal(result.logFields.rerunReason, "auditor_review_request");
  });

  it("production auditor/rerun payload bypasses missing photo gate (HA-FIX-8D)", () => {
    const caseId = "22222222-2222-4222-8222-222222222222";
    const auditorRerunEvent = {
      action: "regenerate_ai_audit",
      caseId,
      reason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      triggeredRole: "auditor",
    } as const;

    const runAuditPayload = buildRunAuditInvokePayload({
      caseId: auditorRerunEvent.caseId,
      userId: "auditor-user-1",
      reason: auditorRerunEvent.reason,
      triggeredRole: auditorRerunEvent.triggeredRole,
      rerunSource: "auditor",
      allowImageLimitedOverride: true,
    });
    const resolved = resolveRunAuditEventData(runAuditPayload);

    assert.equal(resolved.auditorRerunReason, AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED);
    assert.equal(resolved.triggeredRole, "auditor");
    assert.equal(resolved.allowImageLimitedOverride, true);

    const gate = evaluateRunAuditPatientPhotoGate({
      caseId,
      uploadRows,
      patientAnswers: FAILED_CASE_RECOVERY_PATIENT_ANSWERS,
      clinicalHistory,
      stageAwareSubmitEnabled: false,
      patientReviewPathway: FAILED_CASE_RECOVERY_PATHWAY,
      patientPhotosForAuditCount: uploadRows.filter((u) =>
        String(u.type).startsWith("patient_photo:")
      ).length,
      auditorRerunReason: resolved.auditorRerunReason,
      triggeredRole: resolved.triggeredRole,
      rerunSource: resolved.rerunSource,
      allowImageLimitedOverride: resolved.allowImageLimitedOverride,
    });

    assert.equal(gate.allowed, true, "missing required photos must not block image-limited rerun");
    assert.equal(gate.imageLimitedOverride.allowed, true);
    assert.equal(gate.logFields.overrideAllowed, true);
    assert.equal(gate.logFields.normalPhotoGatePassed, false);
    assert.ok(gate.logFields.missingRequiredPhotoLabels.length >= 2);
    // runAudit maps override.allowed → imageLimitedAssessment / documentAssistedAssessment
    const imageLimitedAssessment = gate.imageLimitedOverride.allowed;
    const documentAssistedAssessment = gate.imageLimitedOverride.allowed;
    assert.equal(imageLimitedAssessment, true);
    assert.equal(documentAssistedAssessment, true);
    assert.deepEqual(
      gate.logFields.missingRequiredPhotoLabels,
      gate.imageLimitedOverride.missingRequiredPhotoLabels
    );
  });

  it("corrected_patient_photos without patient images still blocks gate", () => {
    const gate = evaluateRunAuditPatientPhotoGate({
      caseId: "case-1",
      uploadRows: noUploads,
      patientAnswers: FAILED_CASE_RECOVERY_PATIENT_ANSWERS,
      clinicalHistory,
      stageAwareSubmitEnabled: false,
      patientReviewPathway: FAILED_CASE_RECOVERY_PATHWAY,
      patientPhotosForAuditCount: 0,
      auditorRerunReason: "corrected_patient_photos",
      triggeredRole: "auditor",
      rerunSource: "auditor",
    });

    assert.equal(gate.allowed, false);
    assert.equal(gate.imageLimitedOverride.allowed, false);
    assert.equal(gate.logFields.normalPhotoGatePassed, false);
    assert.equal(gate.logFields.overrideAllowed, false);
    assert.ok(gate.logFields.missingRequiredPhotoLabels.length >= 3);
  });
});

describe("runAudit event payload resolution", () => {
  it("reads auditorRerunReason from direct invoke payload", () => {
    const resolved = resolveRunAuditEventData({
      caseId: "abc",
      userId: "user-1",
      auditorRerunReason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      triggeredRole: "auditor",
      rerunSource: "auditor",
      allowImageLimitedOverride: true,
    });
    assert.equal(resolved.auditorRerunReason, AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED);
    assert.equal(resolved.allowImageLimitedOverride, true);
  });

  it("reads reason from nested inngest invoke wrapper", () => {
    const inner = buildRunAuditInvokePayload({
      caseId: "abc",
      userId: "user-1",
      reason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      triggeredRole: "auditor",
      rerunSource: "auditor",
      allowImageLimitedOverride: true,
    });
    const wrapped = { event: { data: inner } };
    const unwrapped = unwrapRunAuditInvokePayload(wrapped);
    assert.equal(unwrapped.caseId, "abc");
    const resolved = resolveRunAuditEventData(wrapped);
    assert.equal(resolved.auditorRerunReason, AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED);
  });

  it("buildRunAuditInvokePayload mirrors queueAuditorRerun image-limited fields", () => {
    const payload = buildRunAuditInvokePayload({
      caseId: "abc",
      userId: "auditor-1",
      reason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      triggeredRole: "auditor",
      rerunSource: "auditor",
      allowImageLimitedOverride: true,
    });
    assert.equal(payload.auditorRerunReason, AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED);
    assert.equal(payload.triggeredRole, "auditor");
    assert.equal(payload.rerunSource, "auditor");
    assert.equal(payload.allowImageLimitedOverride, true);
  });

  it("resolveRunAuditEventData infers allowImageLimitedOverride from reason alone", () => {
    const resolved = resolveRunAuditEventData({
      caseId: "abc",
      userId: "auditor-1",
      reason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
      triggeredRole: "auditor",
    });
    assert.equal(resolved.allowImageLimitedOverride, true);
  });
});

describe("image-limited AI context and prompt wiring", () => {
  it("runAudit passes image-limited flags into runAIAudit", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/inngest/functions.ts"), "utf8");
    assert.match(src, /imageLimitedAssessment:/);
    assert.match(src, /documentAssistedAssessment:/);
    assert.match(src, /missingRequiredPhotoLabels:/);
    assert.match(src, /document_assisted_image_limited/);
    assert.match(src, /missing_photo_override_used/);
    assert.match(src, /resolveRunAuditEventData/);
    assert.match(src, /evaluateRunAuditPatientPhotoGate/);
    assert.match(src, /patient photo submit gate evaluation/);
    assert.match(src, /image_limited_override_gate/);
    assert.doesNotMatch(src, /auditor_missing_photo_override/);
    assert.doesNotMatch(src, /reason === "image_limited"/);
  });

  it("AIAuditInput includes image-limited fields and prompt rules", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/ai/audit.ts"), "utf8");
    assert.match(src, /imageLimitedAssessment\?:/);
    assert.match(src, /IMAGE-LIMITED AUDIT PATHWAY/);
    assert.match(src, /Do NOT infer density, donor quality/);
    assert.match(src, /imageLimitedAddon/);
  });

  it("prompt gates image-limited addon on imageLimitedAssessment flag", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/ai/audit.ts"), "utf8");
    assert.match(src, /const imageLimitedAddon = imageLimitedAssessment/);
    assert.match(src, /\$\{imageLimitedAddon\}/);
  });
});

describe("image-limited report surfaces", () => {
  it("patient-safe summary includes image-limited notice when forensic flag set", () => {
    const summary = buildPatientSafeReportSummary({
      key_findings: [],
      red_flags: [],
      forensic_audit: { imageLimitedAssessment: true },
    });
    const expected = `${PATIENT_IMAGE_LIMITED_TRUST_NOTICE.title}. ${PATIENT_IMAGE_LIMITED_TRUST_NOTICE.subcopy}`;
    assert.equal(summary.imageLimitedNotice, expected);
  });

  it("patient-safe summary omits notice for normal audits", () => {
    const summary = buildPatientSafeReportSummary({
      key_findings: [],
      red_flags: [],
      forensic_audit: { imageLimitedAssessment: false },
    });
    assert.equal(summary.imageLimitedNotice, undefined);
  });

  it("PDF and HTML report renderers reference image-limited notice", () => {
    const pdf = readFileSync(join(process.cwd(), "src/lib/pdf/reportBuilder.ts"), "utf8");
    const html = readFileSync(join(process.cwd(), "src/lib/reports/EliteReportHtml.tsx"), "utf8");
    assert.match(pdf, /addImageLimitedNoticeIfNeeded/);
    assert.match(html, /Image-limited audit/);
  });
});

describe("image-limited auditor UI wiring", () => {
  it("reason enum includes document_assisted_image_limited", () => {
    assert.ok(AUDITOR_RERUN_REASONS.includes("document_assisted_image_limited"));
  });

  it("ImageLimitedRegeneratePanel queues correct reason", () => {
    const panel = readFileSync(
      join(process.cwd(), "src/app/cases/[caseId]/ImageLimitedRegeneratePanel.tsx"),
      "utf8"
    );
    assert.match(panel, /AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED/);
    assert.match(panel, /regenerate_ai_audit/);
    assert.match(panel, /Add at least one patient image or structured clinical history/);
    assert.match(panel, /disabled=\{!canRegenerate\}/);
  });

  it("case page wires ImageLimitedRegeneratePanel for auditors", () => {
    const page = readFileSync(join(process.cwd(), "src/app/cases/[caseId]/page.tsx"), "utf8");
    assert.match(page, /ImageLimitedRegeneratePanel/);
    assert.match(page, /missingPatientPhotoLabelsForOverride/);
  });

  it("AuditorRerunPanel labels image-limited reruns in history", () => {
    const panel = readFileSync(join(process.cwd(), "src/app/cases/[caseId]/AuditorRerunPanel.tsx"), "utf8");
    assert.match(panel, /Image-limited override/);
    assert.match(panel, /document_assisted_image_limited/);
  });

  it("queueAuditorRerun validates image-limited support requirements", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/auditor/queueAuditorRerun.ts"), "utf8");
    assert.match(src, /evaluateImageLimitedPhotoOverride/);
    assert.match(src, /imageLimitedRerunSupportError/);
    assert.match(src, /allowImageLimitedOverride/);
    assert.match(src, /rerunSource: "auditor"/);
  });

  it("clinical history image-limited save uses document_assisted_image_limited reason", () => {
    const actions = readFileSync(
      join(process.cwd(), "src/app/cases/[caseId]/clinicalHistoryActions.ts"),
      "utf8"
    );
    assert.match(actions, /reason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED/);
    assert.match(actions, /saveCaseClinicalHistoryAndRegenerateImageLimitedAction/);
  });
});
