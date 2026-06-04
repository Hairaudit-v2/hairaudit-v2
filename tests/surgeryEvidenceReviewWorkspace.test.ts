import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEvidenceCompletenessChecklist,
  deriveEvidenceReportReadiness,
  evidenceWorkspaceCategoryForUpload,
  groupUploadsByEvidenceWorkspaceCategory,
  mergeEvidenceWorkspacePatch,
  surgerySlotToWorkspaceCategory,
} from "@/lib/surgeryUpload/evidenceReviewWorkspace";
import { buildSurgeryEvidenceReviewPdfInput } from "@/lib/reports/surgeryUpload/surgeryEvidenceReviewPdfModel";
import type { SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";

const baseDetails = (): SurgeryUploadDetails =>
  ({
    id: "d1",
    case_id: "c1",
    created_by: null,
    patient_reference: "P1",
    clinic_name: "Clinic",
    clinic_profile_id: null,
    surgeon_name: "Dr",
    surgery_date: "2026-01-10",
    procedure_type: "scalp",
    notes: null,
    extraction_machine: "WAW",
    punch_size: null,
    punch_type: null,
    implantation_method: "Sapphire",
    prp_used: null,
    exosomes_used: null,
    storage_solution: null,
    planned_grafts: 2000,
    actual_grafts: null,
    extraction_start_time: null,
    implantation_start_time: null,
    surgery_finish_time: null,
    complication_notes: null,
    status: "submitted",
    submitted_at: "2026-01-11T00:00:00Z",
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
    evidence_report_pipeline_status: "not_started",
    evidence_report_requested_at: null,
    evidence_report_requested_by: null,
    evidence_report_completed_at: null,
    evidence_report_failed_at: null,
    evidence_report_error: null,
    evidence_report_id: null,
    evidence_review_workspace_notes: "hello",
    evidence_review_workspace_notes_updated_by: null,
    evidence_review_workspace_notes_updated_at: "2026-01-12T00:00:00Z",
    evidence_review_workspace_flags: [{ code: "missing_graft_count" }],
    evidence_review_workspace_flags_updated_by: null,
    evidence_review_workspace_flags_updated_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }) as SurgeryUploadDetails;

test("surgerySlotToWorkspaceCategory maps checklist slots into workspace groups", () => {
  assert.equal(surgerySlotToWorkspaceCategory("preop_donor"), "preop_baseline");
  assert.equal(surgerySlotToWorkspaceCategory("extraction_progress"), "donor_extraction");
  assert.equal(surgerySlotToWorkspaceCategory("implantation_progress"), "recipient_implantation");
  assert.equal(surgerySlotToWorkspaceCategory("hairline_design"), "hairline_design");
  assert.equal(surgerySlotToWorkspaceCategory("graft_quality"), "graft_handling_quality");
  assert.equal(surgerySlotToWorkspaceCategory("petri_graft_sorting"), "graft_handling_quality");
  assert.equal(surgerySlotToWorkspaceCategory("postop_recipient"), "postop_immediate");
});

test("groupUploadsByEvidenceWorkspaceCategory buckets uploads", () => {
  const uploads = [
    { id: "1", type: "surgery_photo:preop_donor", storage_path: "a", created_at: "t" },
    { id: "2", type: "surgery_photo:extraction_progress", storage_path: "b", created_at: "t" },
    { id: "3", type: "clinic_consent_pdf", storage_path: "c", created_at: "t" },
  ];
  const g = groupUploadsByEvidenceWorkspaceCategory(uploads);
  assert.equal(g.preop_baseline.length, 1);
  assert.equal(g.donor_extraction.length, 1);
  assert.equal(g.consent_documentation.length, 1);
});

test("evidenceWorkspaceCategoryForUpload routes consent-looking types", () => {
  assert.equal(
    evidenceWorkspaceCategoryForUpload({
      id: "x",
      type: "signed_consent_scan",
      storage_path: "p",
      created_at: "t",
    }),
    "consent_documentation"
  );
});

test("buildEvidenceCompletenessChecklist derives yes/no rows", () => {
  const d = baseDetails();
  const uploads = [
    { id: "1", type: "surgery_photo:preop_donor", storage_path: "a", created_at: "t" },
    { id: "2", type: "surgery_photo:preop_recipient", storage_path: "b", created_at: "t" },
    { id: "3", type: "surgery_photo:hairline_design", storage_path: "c", created_at: "t" },
    { id: "4", type: "surgery_photo:postop_donor", storage_path: "d", created_at: "t" },
    { id: "5", type: "surgery_photo:postop_recipient", storage_path: "e", created_at: "t" },
  ];
  const rows = buildEvidenceCompletenessChecklist(d, uploads);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r.met]));
  assert.equal(byId.procedure_date, true);
  assert.equal(byId.clinic, true);
  assert.equal(byId.doctor, true);
  assert.equal(byId.graft_count, true); // planned_grafts
  assert.equal(byId.donor_photos, true);
  assert.equal(byId.recipient_photos, true);
  assert.equal(byId.hairline_photos, true);
  assert.equal(byId.immediate_postop_photos, true);
});

test("deriveEvidenceReportReadiness: succeeded → report_completed", () => {
  const checklist = buildEvidenceCompletenessChecklist(baseDetails(), []);
  const r = deriveEvidenceReportReadiness({
    pipelineStatus: "succeeded",
    checklistItems: checklist,
    flags: [],
  });
  assert.equal(r.kind, "report_completed");
});

test("deriveEvidenceReportReadiness: queued → report_requested regardless of checklist", () => {
  const checklist = buildEvidenceCompletenessChecklist(baseDetails(), []);
  const r = deriveEvidenceReportReadiness({
    pipelineStatus: "queued",
    checklistItems: checklist,
    flags: [{ code: "missing_graft_count" }],
  });
  assert.equal(r.kind, "report_requested");
});

test("deriveEvidenceReportReadiness: not_started + flags → needs_more_evidence", () => {
  const checklist = buildEvidenceCompletenessChecklist(baseDetails(), []);
  const r = deriveEvidenceReportReadiness({
    pipelineStatus: "not_started",
    checklistItems: checklist,
    flags: [{ code: "missing_graft_count" }],
  });
  assert.equal(r.kind, "needs_more_evidence");
});

test("mergeEvidenceWorkspacePatch validates other detail", () => {
  const bad = mergeEvidenceWorkspacePatch({ flags: [{ code: "other" }] }, null, []);
  assert.equal(bad.ok, false);
  const good = mergeEvidenceWorkspacePatch({ flags: [{ code: "other", detail: "x" }] }, null, []);
  assert.equal(good.ok, true);
  if (good.ok) assert.equal(good.flags[0].detail, "x");
});

test("buildSurgeryEvidenceReviewPdfInput includes checklist, workspace notes, flags, grouped counts", () => {
  const d = baseDetails();
  const input = buildSurgeryEvidenceReviewPdfInput({
    caseId: "c1",
    generatedAtIso: "2026-01-01T00:00:00Z",
    requestedByDisplay: "Auditor",
    details: d,
    uploads: [{ id: "1", type: "surgery_photo:preop_donor", storage_path: "a", created_at: "t" }],
    slotReviews: [],
  });
  assert.ok(input.completenessChecklist.length > 0);
  assert.equal(input.workspaceNotes, "hello");
  assert.equal(input.workspaceFlags.length, 1);
  assert.ok(input.groupedEvidenceCounts.some((g) => g.categoryId === "preop_baseline" && g.count === 1));
});
