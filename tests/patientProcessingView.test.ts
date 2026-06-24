import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPatientCaseStatusPayload,
  getPatientCasePollIntervalMs,
  isPatientAwaitingReportDelivery,
  isPatientProcessingStageDelayed,
  isPatientReportDelivered,
  maskNotificationEmail,
  resolvePatientProcessingActiveIndex,
  resolvePatientProcessingTimeline,
  resolvePatientReportDeliveryPhase,
  shouldHidePatientForensicWorkspace,
  shouldPollPatientCaseStatus,
  shouldShowPatientReportContent,
} from "@/lib/patient/patientProcessingView";

test("resolvePatientReportDeliveryPhase: draft stays draft", () => {
  assert.equal(resolvePatientReportDeliveryPhase({ caseStatus: "draft", hasReportPdf: false }), "draft");
});

test("resolvePatientReportDeliveryPhase: submitted and processing are awaiting delivery", () => {
  assert.equal(resolvePatientReportDeliveryPhase({ caseStatus: "submitted", hasReportPdf: false }), "processing");
  assert.equal(resolvePatientReportDeliveryPhase({ caseStatus: "processing", hasReportPdf: false }), "processing");
});

test("resolvePatientReportDeliveryPhase: pipeline statuses remain processing", () => {
  assert.equal(resolvePatientReportDeliveryPhase({ caseStatus: "pdf_pending", hasReportPdf: false }), "processing");
  assert.equal(resolvePatientReportDeliveryPhase({ caseStatus: "audit_running", hasReportPdf: false }), "processing");
});

test("resolvePatientReportDeliveryPhase: complete without PDF is still processing", () => {
  assert.equal(resolvePatientReportDeliveryPhase({ caseStatus: "complete", hasReportPdf: false }), "processing");
});

test("resolvePatientReportDeliveryPhase: complete with PDF is delivered", () => {
  assert.equal(resolvePatientReportDeliveryPhase({ caseStatus: "complete", hasReportPdf: true }), "delivered");
});

test("shouldHidePatientForensicWorkspace only for patients awaiting delivery", () => {
  assert.equal(
    shouldHidePatientForensicWorkspace({ isPatientForCase: true, deliveryPhase: "processing" }),
    true
  );
  assert.equal(
    shouldHidePatientForensicWorkspace({ isPatientForCase: true, deliveryPhase: "delivered" }),
    false
  );
  assert.equal(
    shouldHidePatientForensicWorkspace({ isPatientForCase: false, deliveryPhase: "processing" }),
    false
  );
});

test("shouldShowPatientReportContent gates partial report visibility for patients", () => {
  assert.equal(
    shouldShowPatientReportContent({ isPatientForCase: true, deliveryPhase: "processing" }),
    false
  );
  assert.equal(
    shouldShowPatientReportContent({ isPatientForCase: true, deliveryPhase: "delivered" }),
    true
  );
  assert.equal(
    shouldShowPatientReportContent({ isPatientForCase: false, deliveryPhase: "processing" }),
    true
  );
});

test("isPatientAwaitingReportDelivery and isPatientReportDelivered", () => {
  assert.equal(isPatientAwaitingReportDelivery("processing"), true);
  assert.equal(isPatientAwaitingReportDelivery("delivered"), false);
  assert.equal(isPatientReportDelivered("delivered"), true);
  assert.equal(isPatientReportDelivered("processing"), false);
});

test("maskNotificationEmail masks local part and keeps domain", () => {
  assert.equal(maskNotificationEmail("jane.doe@example.com"), "j••••@example.com");
  assert.equal(maskNotificationEmail("a@test.org"), "a•@test.org");
  assert.equal(maskNotificationEmail(""), null);
  assert.equal(maskNotificationEmail("not-an-email"), null);
});

test("resolvePatientProcessingTimeline marks early pipeline on hair pattern review", () => {
  const steps = resolvePatientProcessingTimeline({ caseStatus: "processing", hasReportPdf: false });
  assert.equal(steps[0]?.state, "complete");
  assert.equal(steps[1]?.state, "complete");
  assert.equal(steps[2]?.state, "active");
  assert.equal(steps[3]?.state, "pending");
});

test("resolvePatientProcessingTimeline advances during summary preparation", () => {
  const steps = resolvePatientProcessingTimeline({ caseStatus: "pdf_pending", hasReportPdf: false });
  assert.equal(steps[6]?.stage, "summary_preparation");
  assert.equal(steps[6]?.state, "active");
});

test("resolvePatientProcessingTimeline completes when report PDF exists", () => {
  const steps = resolvePatientProcessingTimeline({ caseStatus: "complete", hasReportPdf: true });
  assert.deepEqual(
    steps.map((step) => step.state),
    ["complete", "complete", "complete", "complete", "complete", "complete", "complete", "ready"]
  );
});

test("resolvePatientProcessingTimeline marks delayed active stage after threshold", () => {
  const submittedAt = new Date("2026-01-01T10:00:00.000Z").toISOString();
  const nowMs = new Date("2026-01-01T10:20:00.000Z").getTime();
  const steps = resolvePatientProcessingTimeline({
    caseStatus: "processing",
    hasReportPdf: false,
    submittedAt,
    nowMs,
  });
  assert.equal(steps[2]?.state, "delayed");
  assert.equal(isPatientProcessingStageDelayed({
    submittedAt,
    activeIndex: resolvePatientProcessingActiveIndex({ caseStatus: "processing", hasReportPdf: false }),
    reportReady: false,
    nowMs,
  }), true);
});

test("buildPatientCaseStatusPayload exposes report URL only when ready", () => {
  const waiting = buildPatientCaseStatusPayload({
    caseId: "case-1",
    caseStatus: "processing",
    hasReportPdf: false,
    submittedAt: "2026-01-01T10:00:00.000Z",
    notificationEmail: "patient@example.com",
  });
  assert.equal(waiting.reportReady, false);
  assert.equal(waiting.reportUrl, null);
  assert.equal(waiting.maskedEmail, "p••••@example.com");
  assert.equal(waiting.showTrustBanner, true);
  assert.ok(waiting.trustTitle.length > 0);

  const ready = buildPatientCaseStatusPayload({
    caseId: "case-1",
    caseStatus: "complete",
    hasReportPdf: true,
    notificationEmail: "patient@example.com",
  });
  assert.equal(ready.reportReady, true);
  assert.equal(ready.reportUrl, "/cases/case-1");
  assert.equal(ready.currentStage, "report_ready");
  assert.equal(ready.showTrustBanner, false);
});

test("shouldPollPatientCaseStatus starts when report not ready and stops when ready", () => {
  assert.equal(shouldPollPatientCaseStatus(false), true);
  assert.equal(shouldPollPatientCaseStatus(true), false);
  assert.equal(shouldPollPatientCaseStatus(false, false), false);
});

test("getPatientCasePollIntervalMs degrades when tab is hidden", () => {
  assert.equal(getPatientCasePollIntervalMs(false), 12_000);
  assert.equal(getPatientCasePollIntervalMs(true), 30_000);
});
