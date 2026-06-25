/**
 * HA-AUDITOR-COMMS-1 — auditor patient information request email workflow.
 * Run: pnpm exec tsx --test tests/auditorPatientInfoRequest.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isAuditor } from "../src/lib/auth/isAuditor";
import {
  buildPatientInfoRequestEmailContent,
  extractPatientInfoRequestFromReportSummary,
  isCaseAwaitingPatientInformation,
  isPatientInfoRequestType,
  patientInfoRequestEmailContainsForbiddenWording,
  patientSafeRequestReasonLabel,
  sanitizeAuditorNoteForPatient,
} from "../src/lib/auditor/patientInfoRequest";

describe("patientInfoRequest types", () => {
  it("accepts valid request types", () => {
    assert.equal(isPatientInfoRequestType("more_photos_needed"), true);
    assert.equal(isPatientInfoRequestType("invalid_type"), false);
  });

  it("maps request types to patient-safe reason labels", () => {
    const label = patientSafeRequestReasonLabel("more_photos_needed");
    assert.match(label, /photos/i);
    assert.equal(patientInfoRequestEmailContainsForbiddenWording(label), false);
  });
});

describe("sanitizeAuditorNoteForPatient", () => {
  it("returns null for empty notes", () => {
    assert.equal(sanitizeAuditorNoteForPatient(""), null);
    assert.equal(sanitizeAuditorNoteForPatient("   "), null);
  });

  it("drops notes containing forbidden wording", () => {
    assert.equal(sanitizeAuditorNoteForPatient("This looks like a botched procedure"), null);
    assert.equal(sanitizeAuditorNoteForPatient("Forensic review suggests negligence"), null);
  });

  it("keeps calm supportive notes", () => {
    assert.equal(
      sanitizeAuditorNoteForPatient("If you have a clearer donor photo from the side, that would help."),
      "If you have a clearer donor photo from the side, that would help."
    );
  });
});

describe("buildPatientInfoRequestEmailContent", () => {
  it("uses required subject and excludes forbidden wording", () => {
    const content = buildPatientInfoRequestEmailContent({
      caseId: "case-123",
      patientName: "Alex",
      requestType: "procedure_details_needed",
      auditorNote: "Please share your surgery date if you have it.",
    });

    assert.equal(content.subject, "More information needed for your HairAudit review");
    assert.match(content.text, /Hi Alex,/);
    assert.match(content.text, /procedure/i);
    assert.match(content.text, /cases\/case-123/);
    assert.match(content.text, /HairAudit Review Team/);
    assert.equal(patientInfoRequestEmailContainsForbiddenWording(content.text), false);
    assert.equal(patientInfoRequestEmailContainsForbiddenWording(content.html), false);
  });

  it("omits unsafe auditor notes from the email body", () => {
    const content = buildPatientInfoRequestEmailContent({
      caseId: "case-456",
      requestType: "other",
      auditorNote: "Possible malpractice by the clinic",
    });

    assert.doesNotMatch(content.text, /malpractice/i);
    assert.doesNotMatch(content.html, /malpractice/i);
  });
});

describe("extractPatientInfoRequestFromReportSummary", () => {
  it("reads active info request from report summary", () => {
    const state = extractPatientInfoRequestFromReportSummary({
      auditor_review: {
        needs_more_evidence: true,
        patient_info_request_type: "medication_history_needed",
        patient_info_request_reason_label: "Your medication history or current medications",
        patient_info_request_sent_at: "2026-06-25T12:00:00.000Z",
      },
    });

    assert.ok(state);
    assert.equal(state!.requestType, "medication_history_needed");
    assert.equal(state!.reasonLabel, "Your medication history or current medications");
  });

  it("returns null when needs_more_evidence is false", () => {
    assert.equal(
      extractPatientInfoRequestFromReportSummary({ auditor_review: { needs_more_evidence: false } }),
      null
    );
  });
});

describe("case status awaiting_patient_information", () => {
  it("detects awaiting patient information status", () => {
    assert.equal(isCaseAwaitingPatientInformation("awaiting_patient_information"), true);
    assert.equal(isCaseAwaitingPatientInformation("processing"), false);
  });
});

describe("request-patient-information API route security", () => {
  it("requires auditor authentication", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/auditor/cases/request-patient-information/route.ts"),
      "utf8"
    );
    assert.match(route, /isAuditor\(/);
    assert.match(route, /Forbidden/);
    assert.match(route, /patient_info_request_log/);
    assert.match(route, /awaiting_patient_information/);
    assert.match(route, /notifyPatientMoreInformationRequested/);
  });

  it("non-auditor cannot pass isAuditor gate in production without override", () => {
    const prevNode = process.env.NODE_ENV;
    const prevOverride = process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE;
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE;
    assert.equal(isAuditor({ profileRole: "patient", userEmail: "patient@example.com" }), false);
    process.env.NODE_ENV = prevNode;
    if (prevOverride === undefined) delete process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE;
    else process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE = prevOverride;
  });
});

describe("auditor case page UI wiring", () => {
  it("includes RequestPatientInformationPanel on auditor workflow", () => {
    const workflow = readFileSync(
      join(process.cwd(), "src/app/cases/[caseId]/AuditorCasePageWorkflow.tsx"),
      "utf8"
    );
    const panel = readFileSync(
      join(process.cwd(), "src/components/auditor/case-workflow/RequestPatientInformationPanel.tsx"),
      "utf8"
    );
    assert.match(workflow, /RequestPatientInformationPanel/);
    assert.match(panel, /Request more information/);
  });
});

describe("patient dashboard info request banner", () => {
  it("PatientNextActionPanel handles info request state", () => {
    const panel = readFileSync(
      join(process.cwd(), "src/components/patient/PatientNextActionPanel.tsx"),
      "utf8"
    );
    assert.match(panel, /infoRequest/);
    assert.match(panel, /dashboard\.patient\.infoRequest\.title/);
  });
});
