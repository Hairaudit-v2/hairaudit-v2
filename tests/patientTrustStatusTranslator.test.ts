import test from "node:test";
import assert from "node:assert/strict";
import {
  PATIENT_FORBIDDEN_TERMS,
  PATIENT_REVIEW_DELAYED_EMAIL_THRESHOLD_MINUTES,
  PATIENT_REVIEW_STILL_IN_PROGRESS_EMAIL,
  PATIENT_TRUST_INTERNAL_STATES,
  buildPatientTrustStatusDisplay,
  containsPatientForbiddenTerm,
  resolvePatientTrustInternalState,
  toPatientSafeApiResponse,
  translatePatientTimelineEvent,
  translatePatientVisibleCaseStatus,
} from "@/lib/patient/patientTrustStatusTranslator";
import {
  buildPatientCaseStatusPayload,
  resolvePatientReportDeliveryPhase,
} from "@/lib/patient/patientProcessingView";

test("translatePatientVisibleCaseStatus: all internal states map to trust copy", () => {
  for (const state of PATIENT_TRUST_INTERNAL_STATES) {
    const result = translatePatientVisibleCaseStatus(state);
    assert.ok(result.title.length > 0, `title missing for ${state}`);
    assert.ok(result.subcopy.length > 0, `subcopy missing for ${state}`);
    assert.equal(containsPatientForbiddenTerm(result.title), false, `forbidden term in title for ${state}`);
    assert.equal(containsPatientForbiddenTerm(result.subcopy), false, `forbidden term in subcopy for ${state}`);
  }
});

test("translatePatientVisibleCaseStatus: required processing mapping", () => {
  const result = translatePatientVisibleCaseStatus("processing");
  assert.equal(result.title, "Specialist Review In Progress");
  assert.match(result.subcopy, /clinical intelligence systems/i);
});

test("translatePatientVisibleCaseStatus: failed maps to additional quality review", () => {
  const result = translatePatientVisibleCaseStatus("failed");
  assert.equal(result.title, "Additional Quality Review In Progress");
  assert.doesNotMatch(result.title, /fail/i);
  assert.doesNotMatch(result.subcopy, /fail|error/i);
});

test("translatePatientVisibleCaseStatus: completed maps to report ready", () => {
  const result = translatePatientVisibleCaseStatus("completed");
  assert.equal(result.title, "Report Ready");
});

test("resolvePatientTrustInternalState: audit_failed uses failed trust state", () => {
  assert.equal(resolvePatientTrustInternalState({ caseStatus: "audit_failed" }), "failed");
});

test("resolvePatientTrustInternalState: complete without PDF uses pdf_rebuild", () => {
  assert.equal(
    resolvePatientTrustInternalState({ caseStatus: "complete", hasReportPdf: false }),
    "pdf_rebuild"
  );
});

test("resolvePatientTrustInternalState: image limited completed pathway", () => {
  assert.equal(
    resolvePatientTrustInternalState({
      caseStatus: "complete",
      hasReportPdf: true,
      imageLimitedPathway: true,
    }),
    "image_limited"
  );
});

test("buildPatientTrustStatusDisplay: shows trust banner for non-completed", () => {
  const waiting = buildPatientTrustStatusDisplay({ caseStatus: "processing", hasReportPdf: false });
  assert.equal(waiting.showTrustBanner, true);
  assert.doesNotMatch(waiting.title, /fail|error/i);

  const ready = buildPatientTrustStatusDisplay({ caseStatus: "complete", hasReportPdf: true });
  assert.equal(ready.showTrustBanner, false);
  assert.equal(ready.title, "Report Ready");
});

test("patient never sees forbidden terms in trust display for failure states", () => {
  const failureStates = ["audit_failed", "failed", "pdf_pending", "audit_running"] as const;
  for (const status of failureStates) {
    const display = buildPatientTrustStatusDisplay({ caseStatus: status, hasReportPdf: false });
    assert.equal(containsPatientForbiddenTerm(display.title), false, status);
    assert.equal(containsPatientForbiddenTerm(display.subcopy), false, status);
  }
});

test("translatePatientTimelineEvent: technical events become trust language", () => {
  assert.equal(
    translatePatientTimelineEvent("AI processing failed"),
    "Additional quality review initiated"
  );
  assert.equal(
    translatePatientTimelineEvent("Missing required donor image"),
    "Case materials undergoing specialist review"
  );
  assert.equal(
    translatePatientTimelineEvent("PDF rebuild triggered"),
    "Final report preparation underway"
  );
  assert.doesNotMatch(translatePatientTimelineEvent("Classifier failed"), /classifier|failed/i);
});

test("toPatientSafeApiResponse: report download errors are patient-safe", () => {
  const safe = toPatientSafeApiResponse("Could not load report file", "report_download");
  assert.equal(safe.status, "preparing_report");
  assert.doesNotMatch(safe.message, /fail|error|missing/i);
  assert.match(safe.message, /prepared for release/i);
});

test("toPatientSafeApiResponse: missing images sanitized", () => {
  const safe = toPatientSafeApiResponse("Missing required images for audit");
  assert.equal(safe.status, "reviewing_materials");
  assert.doesNotMatch(safe.message, /missing/i);
});

test("buildPatientCaseStatusPayload includes HA-TRUST-4 trust fields", () => {
  const payload = buildPatientCaseStatusPayload({
    caseId: "case-1",
    caseStatus: "audit_failed",
    hasReportPdf: false,
    submittedAt: "2026-01-01T10:00:00.000Z",
  });
  assert.equal(payload.trustInternalState, "failed");
  assert.equal(payload.showTrustBanner, true);
  assert.doesNotMatch(payload.trustTitle, /fail|error/i);
  assert.doesNotMatch(payload.trustSubcopy, /fail|error/i);
});

test("resolvePatientReportDeliveryPhase: audit_failed maps to processing with patient trust layer", () => {
  assert.equal(
    resolvePatientReportDeliveryPhase({
      caseStatus: "audit_failed",
      hasReportPdf: false,
      patientTrustLayer: true,
    }),
    "processing"
  );
  assert.equal(
    resolvePatientReportDeliveryPhase({
      caseStatus: "audit_failed",
      hasReportPdf: false,
    }),
    "audit_failed"
  );
});

test("delayed email SLA threshold is 30 minutes", () => {
  assert.equal(PATIENT_REVIEW_DELAYED_EMAIL_THRESHOLD_MINUTES, 30);
});

test("delayed reassurance email template avoids technical failure language", () => {
  assert.equal(PATIENT_REVIEW_STILL_IN_PROGRESS_EMAIL.subject, "Your HairAudit review is still in progress");
  assert.match(PATIENT_REVIEW_STILL_IN_PROGRESS_EMAIL.body, /Thank you for submitting/i);
  assert.doesNotMatch(PATIENT_REVIEW_STILL_IN_PROGRESS_EMAIL.body, /fail|error|automated audit/i);
});

test("image limited trust notice avoids internal workflow labels", () => {
  const display = translatePatientVisibleCaseStatus("image_limited");
  assert.equal(display.title, "Enhanced Clinical Review Completed");
  assert.doesNotMatch(display.subcopy, /image.?limited|missing donor|missing crown/i);
});

test("PATIENT_FORBIDDEN_TERMS includes audit failed for regression checks", () => {
  assert.ok(PATIENT_FORBIDDEN_TERMS.includes("audit failed"));
  assert.ok(PATIENT_FORBIDDEN_TERMS.includes("failed"));
});
