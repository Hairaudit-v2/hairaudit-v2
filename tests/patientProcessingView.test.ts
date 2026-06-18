import test from "node:test";
import assert from "node:assert/strict";
import {
  isPatientAwaitingReportDelivery,
  isPatientReportDelivered,
  maskNotificationEmail,
  resolvePatientProcessingTimeline,
  resolvePatientReportDeliveryPhase,
  shouldHidePatientForensicWorkspace,
  shouldShowPatientReportContent,
} from "@/lib/patient/patientProcessingView";

test("resolvePatientReportDeliveryPhase: draft stays draft", () => {
  assert.equal(resolvePatientReportDeliveryPhase({ caseStatus: "draft", hasReportPdf: false }), "draft");
});

test("resolvePatientReportDeliveryPhase: submitted and processing are awaiting delivery", () => {
  assert.equal(resolvePatientReportDeliveryPhase({ caseStatus: "submitted", hasReportPdf: false }), "processing");
  assert.equal(resolvePatientReportDeliveryPhase({ caseStatus: "processing", hasReportPdf: false }), "processing");
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
  assert.equal(maskNotificationEmail("jane.doe@example.com"), "j***@example.com");
  assert.equal(maskNotificationEmail("a@test.org"), "a*@test.org");
  assert.equal(maskNotificationEmail(""), null);
  assert.equal(maskNotificationEmail("not-an-email"), null);
});

test("resolvePatientProcessingTimeline marks early pipeline on clinical review", () => {
  const steps = resolvePatientProcessingTimeline({ caseStatus: "processing", hasReportPdf: false });
  assert.equal(steps[0]?.state, "complete");
  assert.equal(steps[1]?.state, "active");
  assert.equal(steps[2]?.state, "upcoming");
});

test("resolvePatientProcessingTimeline advances during PDF preparation", () => {
  const steps = resolvePatientProcessingTimeline({ caseStatus: "pdf_pending", hasReportPdf: false });
  assert.equal(steps[2]?.state, "active");
});

test("resolvePatientProcessingTimeline completes when report PDF exists", () => {
  const steps = resolvePatientProcessingTimeline({ caseStatus: "complete", hasReportPdf: true });
  assert.deepEqual(
    steps.map((step) => step.state),
    ["complete", "complete", "complete", "complete"]
  );
});
