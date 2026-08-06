/**
 * HA-AUDITOR-DASHBOARD-REGRESSION-1A — context-aware auditor case actions.
 * Run: pnpm exec tsx --test tests/auditorCaseActions.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveAuditorQueueCase, type AuditorQueueCaseInput } from "../src/lib/auditor/auditorQueueTriage";
import {
  AUDITOR_CASE_WORKSPACE_PATH,
  isLikelyTestOrFakeCase,
  resolveAuditorCaseActions,
} from "../src/lib/auditor/auditorCaseActions";

const COMPLETE_POST_SURGERY_UPLOADS = [
  { type: "patient_photo:preop_front" },
  { type: "patient_photo:current_recipient_closeup" },
  { type: "patient_photo:preop_top" },
  { type: "patient_photo:preop_donor_rear" },
  { type: "patient_photo:preop_donor_closeup" },
];

function baseInput(overrides: Partial<AuditorQueueCaseInput> = {}): AuditorQueueCaseInput {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    title: "Test case",
    status: "submitted",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    submitted_at: "2026-06-01T00:00:00.000Z",
    auditor_started_at: null,
    assigned_auditor_id: null,
    audit_type: "patient",
    patient_review_pathway: "post_surgery",
    archived_at: null,
    imageUploadCount: COMPLETE_POST_SURGERY_UPLOADS.length,
    pdfDocumentCount: 0,
    uploadTypes: COMPLETE_POST_SURGERY_UPLOADS,
    hasClinicalHistory: true,
    patientName: "Pat Patient",
    patientEmail: "pat@example.com",
    report: {
      status: "complete",
      pdf_path: null,
      auditor_review_status: null,
      summary: { forensic_audit: {} },
    },
    evidence: { missing_categories: [], status: "ready" },
    ...overrides,
  };
}

describe("resolveAuditorCaseActions", () => {
  it("exposes Start Audit for ready cases that have not been started", () => {
    const input = baseInput();
    const derived = deriveAuditorQueueCase(input);
    assert.equal(derived.isReadyToAudit, true);
    const actions = resolveAuditorCaseActions(input, derived);
    assert.equal(actions[0]?.kind, "start_audit");
    assert.equal(actions[0]?.opensWorkspace, true);
    assert.equal(actions[0]?.claimAssignment, true);
  });

  it("exposes Continue Audit when auditor has already started", () => {
    const input = baseInput({
      auditor_started_at: "2026-06-02T00:00:00.000Z",
      report: {
        status: "complete",
        pdf_path: "/pdfs/x.pdf",
        auditor_review_status: "in_review",
        summary: { forensic_audit: {} },
      },
    });
    const derived = deriveAuditorQueueCase(input);
    assert.equal(derived.badge !== "COMPLETED", true);
    const kinds = resolveAuditorCaseActions(input, derived).map((a) => a.kind);
    assert.equal(kinds[0], "continue_audit");
  });

  it("keeps Open Manual Audit available when AI processing failed", () => {
    const input = baseInput({
      status: "audit_failed",
      report: {
        status: "failed",
        pdf_path: null,
        auditor_review_status: null,
        summary: null,
      },
    });
    const derived = deriveAuditorQueueCase(input);
    assert.equal(derived.isFailed, true);
    const actions = resolveAuditorCaseActions(input, derived);
    const kinds = actions.map((a) => a.kind);
    assert.ok(kinds.includes("open_manual_audit"));
    assert.ok(kinds.includes("retry_processing"));
    assert.equal(actions.find((a) => a.kind === "open_manual_audit")?.primary, true);
  });

  it("exposes View Case and Request Missing Images while waiting on patient", () => {
    const input = baseInput({
      imageUploadCount: 1,
      uploadTypes: [{ type: "patient_photo:preop_front" }],
      report: { status: null, pdf_path: null, auditor_review_status: null, summary: null },
      evidence: { missing_categories: ["left", "right"], status: "incomplete" },
    });
    const derived = deriveAuditorQueueCase(input);
    assert.ok(derived.waitingOnPatient || derived.badge === "MISSING_IMAGES");
    const kinds = resolveAuditorCaseActions(input, derived).map((a) => a.kind);
    assert.ok(kinds.includes("view_case"));
    assert.ok(kinds.includes("request_missing_images"));
  });

  it("exposes report workflow actions when a report is generated", () => {
    const input = baseInput({
      auditor_started_at: "2026-06-02T00:00:00.000Z",
      report: {
        status: "complete",
        pdf_path: "/pdfs/ready.pdf",
        auditor_review_status: "in_review",
        summary: { forensic_audit: {} },
      },
    });
    const derived = deriveAuditorQueueCase(input);
    const kinds = resolveAuditorCaseActions(input, derived).map((a) => a.kind);
    assert.ok(kinds.includes("continue_audit"));
    assert.ok(kinds.includes("review_report"));
    assert.ok(kinds.includes("edit_report"));
    assert.ok(kinds.includes("finalise_report"));
  });

  it("canonical workspace path is /cases/[caseId]", () => {
    assert.equal(AUDITOR_CASE_WORKSPACE_PATH("case-123"), "/cases/case-123");
  });

  it("dashboard cards no longer hard-code Open Case as the only CTA label", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const card = fs.readFileSync(
      path.join(process.cwd(), "src/components/auditor/AuditorCaseQueueCard.tsx"),
      "utf8"
    );
    assert.equal(card.includes(">Open Case<"), false);
    assert.ok(card.includes("resolveAuditorCaseActions"));
  });

  it("ready cases are not classified as waiting on patient when translation is pending", () => {
    const input = baseInput({
      waitingOnTranslation: true,
    });
    const derived = deriveAuditorQueueCase(input);
    assert.equal(derived.isReadyToAudit, true);
    assert.equal(derived.waitingOnPatient, false);
    assert.equal(derived.inActiveWorkQueue, true);
    assert.equal(resolveAuditorCaseActions(input, derived)[0]?.kind, "start_audit");
  });

  it("exposes Archive and Delete cleanup actions on queue cards", () => {
    const input = baseInput();
    const derived = deriveAuditorQueueCase(input);
    const kinds = resolveAuditorCaseActions(input, derived).map((a) => a.kind);
    assert.ok(kinds.includes("archive_case"));
    assert.ok(kinds.includes("delete_case"));
  });

  it("flags demo-qa and hairaudit.test cases as likely test/fake", () => {
    assert.equal(isLikelyTestOrFakeCase({ patientEmail: "postsurgery-demo-01@hairaudit.test" }), true);
    assert.equal(isLikelyTestOrFakeCase({ external_case_id: "demo-qa:postsurgery:01" }), true);
    assert.equal(isLikelyTestOrFakeCase({ title: "Fake clinic audit" }), true);
    assert.equal(isLikelyTestOrFakeCase({ patientEmail: "real.patient@example.com", title: "Clinic audit" }), false);
  });
});
