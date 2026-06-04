import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSurgeryEvidenceReportRequest } from "@/lib/surgeryUpload/surgeryEvidenceReportRequest";
import type { SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";

function baseDetails(over: Partial<SurgeryUploadDetails>): SurgeryUploadDetails {
  return {
    id: "d1",
    case_id: "c1",
    created_by: null,
    patient_reference: null,
    clinic_name: null,
    clinic_profile_id: null,
    surgeon_name: null,
    surgery_date: null,
    procedure_type: null,
    notes: null,
    extraction_machine: null,
    punch_size: null,
    punch_type: null,
    implantation_method: null,
    prp_used: null,
    exosomes_used: null,
    storage_solution: null,
    planned_grafts: null,
    actual_grafts: null,
    extraction_start_time: null,
    implantation_start_time: null,
    surgery_finish_time: null,
    complication_notes: null,
    status: "draft",
    submitted_at: null,
    submitted_by: null,
    prefilled_from_clinic_defaults: false,
    photo_checklist_config: null,
    evidence_review_status: "not_reviewed",
    evidence_reviewed_at: null,
    evidence_reviewed_by: null,
    evidence_review_notes: null,
    evidence_requested_at: null,
    evidence_requested_by: null,
    evidence_request_message: null,
    evidence_resolved_at: null,
    evidence_resolved_by: null,
    ready_for_audit_at: null,
    ready_for_audit_by: null,
    audit_handoff_status: "not_sent",
    audit_handoff_requested_at: null,
    audit_handoff_requested_by: null,
    audit_handoff_completed_at: null,
    audit_handoff_completed_by: null,
    audit_handoff_error: null,
    audit_handoff_notes: null,
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2020-01-01T00:00:00Z",
    ...over,
  };
}

test("evaluateSurgeryEvidenceReportRequest rejects draft surgery upload", () => {
  const g = evaluateSurgeryEvidenceReportRequest(baseDetails({ status: "draft" }));
  assert.equal(g.ok, false);
  assert.equal(g.status, 409);
});

test("evaluateSurgeryEvidenceReportRequest allows submitted + not_started", () => {
  const g = evaluateSurgeryEvidenceReportRequest(
    baseDetails({ status: "submitted", evidence_report_pipeline_status: "not_started" })
  );
  assert.equal(g.ok, true);
});

test("evaluateSurgeryEvidenceReportRequest blocks when queued", () => {
  const g = evaluateSurgeryEvidenceReportRequest(
    baseDetails({ status: "submitted", evidence_report_pipeline_status: "queued" })
  );
  assert.equal(g.ok, false);
  assert.equal(g.status, 409);
});

test("evaluateSurgeryEvidenceReportRequest blocks when succeeded", () => {
  const g = evaluateSurgeryEvidenceReportRequest(
    baseDetails({ status: "submitted", evidence_report_pipeline_status: "succeeded" })
  );
  assert.equal(g.ok, false);
});

test("evaluateSurgeryEvidenceReportRequest blocks when running", () => {
  const g = evaluateSurgeryEvidenceReportRequest(
    baseDetails({ status: "submitted", evidence_report_pipeline_status: "running" })
  );
  assert.equal(g.ok, false);
  assert.equal(g.status, 409);
});

test("evaluateSurgeryEvidenceReportRequest allows failed (retry)", () => {
  const g = evaluateSurgeryEvidenceReportRequest(
    baseDetails({ status: "submitted", evidence_report_pipeline_status: "failed" })
  );
  assert.equal(g.ok, true);
});

test("evaluateSurgeryEvidenceReportRequest rejects null details", () => {
  const g = evaluateSurgeryEvidenceReportRequest(null);
  assert.equal(g.ok, false);
  assert.equal(g.status, 404);
});

test("evaluateSurgeryEvidenceReportRequest blocks cancelled", () => {
  const g = evaluateSurgeryEvidenceReportRequest(
    baseDetails({ status: "submitted", evidence_report_pipeline_status: "cancelled" })
  );
  assert.equal(g.ok, false);
});

test("evaluateSurgeryEvidenceReportRequest: gate uses mobile surgery_upload_details.status only (not cases)", () => {
  const g = evaluateSurgeryEvidenceReportRequest(
    baseDetails({
      status: "draft",
      evidence_report_pipeline_status: "not_started",
    })
  );
  assert.equal(g.ok, false);
  assert.match(String(g.reason ?? ""), /submits this surgery upload/i);
});
