import test from "node:test";
import assert from "node:assert/strict";
import {
  canUnlockPostOpGuide,
  caseSubmitSurfaceOpen,
  isCaseMarkedSuccessfullySubmitted,
  patientHasUnlockedPostOpGuide,
} from "../src/lib/patient/caseSubmitStatus";

test("isCaseMarkedSuccessfullySubmitted trusts submitted_at", () => {
  assert.equal(isCaseMarkedSuccessfullySubmitted({ status: "draft", submitted_at: "2026-01-01T00:00:00Z" }), true);
});

test("isCaseMarkedSuccessfullySubmitted accepts pipeline phases without timestamp", () => {
  assert.equal(isCaseMarkedSuccessfullySubmitted({ status: "evidence_preparing", submitted_at: null }), true);
  assert.equal(isCaseMarkedSuccessfullySubmitted({ status: "pdf_pending", submitted_at: null }), true);
});

test("canUnlockPostOpGuide requires patient audit type", () => {
  assert.equal(
    canUnlockPostOpGuide({ audit_type: "patient", status: "processing", submitted_at: null }),
    true
  );
  assert.equal(
    canUnlockPostOpGuide({ audit_type: null, status: "pdf_ready", submitted_at: null }),
    true
  );
  assert.equal(
    canUnlockPostOpGuide({ audit_type: "doctor", status: "complete", submitted_at: "2026-01-01T00:00:00Z" }),
    false
  );
});

test("patientHasUnlockedPostOpGuide is true if any qualifying case exists", () => {
  assert.equal(
    patientHasUnlockedPostOpGuide([
      { audit_type: "doctor", status: "complete", submitted_at: "2026-01-01T00:00:00Z" },
      { audit_type: "patient", status: "evidence_ready", submitted_at: null },
    ]),
    true
  );
});

test("caseSubmitSurfaceOpen allows resubmit on audit_failed", () => {
  assert.equal(
    caseSubmitSurfaceOpen({ status: "audit_failed", submitted_at: "2026-01-01T00:00:00Z" }),
    true
  );
});

test("caseSubmitSurfaceOpen closes when pipeline status present without submitted_at", () => {
  assert.equal(caseSubmitSurfaceOpen({ status: "processing", submitted_at: null }), false);
});
