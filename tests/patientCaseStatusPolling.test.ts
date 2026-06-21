import test from "node:test";
import assert from "node:assert/strict";
import {
  isPatientCaseParticipant,
  requirePatientCaseAccess,
} from "@/lib/auth/permissions";
import { buildPatientCaseStatusPayload, shouldPollPatientCaseStatus } from "@/lib/patient/patientProcessingView";

const CASE_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const PATIENT_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const OTHER_USER_ID = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

test("patient case status payload: no polling when report already ready", () => {
  const payload = buildPatientCaseStatusPayload({
    caseId: CASE_ID,
    caseStatus: "complete",
    hasReportPdf: true,
  });
  assert.equal(payload.reportReady, true);
  assert.equal(shouldPollPatientCaseStatus(payload.reportReady), false);
});

test("patient case status payload: polling while awaiting report", () => {
  const payload = buildPatientCaseStatusPayload({
    caseId: CASE_ID,
    caseStatus: "audit_running",
    hasReportPdf: false,
  });
  assert.equal(payload.reportReady, false);
  assert.equal(shouldPollPatientCaseStatus(payload.reportReady), true);
  assert.ok(payload.timeline.some((step) => step.state === "active"));
});

test("unauthorised user cannot access another patient case via patient gate", () => {
  const caseRow = {
    id: CASE_ID,
    user_id: PATIENT_ID,
    patient_id: null,
    doctor_id: null,
    clinic_id: null,
  };
  assert.equal(isPatientCaseParticipant(PATIENT_ID, caseRow), true);
  assert.equal(isPatientCaseParticipant(OTHER_USER_ID, caseRow), false);

  const allowed = requirePatientCaseAccess(PATIENT_ID, caseRow);
  assert.equal(allowed.ok, true);

  const denied = requirePatientCaseAccess(OTHER_USER_ID, caseRow);
  assert.equal(denied.ok, false);
  if (!denied.ok) {
    assert.equal(denied.response.status, 403);
  }
});

test("ready timeline includes report CTA stage state", () => {
  const payload = buildPatientCaseStatusPayload({
    caseId: CASE_ID,
    caseStatus: "complete",
    hasReportPdf: true,
  });
  const readyStep = payload.timeline.find((step) => step.stage === "report_ready");
  assert.equal(readyStep?.state, "ready");
});
