/**
 * Stage 8 — clinic prompts + follow-up timeline (informational only).
 * Run: npx tsx --test tests/clinicStage8Evidence.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { buildPatientImageEvidenceGroups } from "@/lib/audit/patientAiImageEvidence";
import { buildPatientImageEvidenceConfidence } from "@/lib/audit/patientImageEvidenceConfidence";
import { buildClinicEvidencePromptsFromSufficiency } from "@/lib/audit/clinicEvidencePromptsFromSufficiency";
import {
  buildFollowupTimelineFromPatientUploads,
  type FollowupTimelineStageId,
} from "@/lib/audit/followupTimelineFromPatientUploads";
import { isClinicEvidencePromptsEnabled } from "@/lib/features/enableClinicEvidencePrompts";
import { isFollowupTimelineEnabled } from "@/lib/features/enableFollowupTimeline";
import { canSubmit } from "@/lib/auditPhotoSchemas";

function confidenceFromUploads(uploads: { id: string; type: string }[]) {
  const g = buildPatientImageEvidenceGroups({ enabled: true, uploads });
  return buildPatientImageEvidenceConfidence(g);
}

function statusById(
  timeline: ReturnType<typeof buildFollowupTimelineFromPatientUploads>,
  id: FollowupTimelineStageId
) {
  return timeline.stages.find((s) => s.id === id)?.status;
}

test("feature flags: opt-in when env is exactly true", () => {
  assert.equal(isClinicEvidencePromptsEnabled({}), false);
  assert.equal(isClinicEvidencePromptsEnabled({ NEXT_PUBLIC_ENABLE_CLINIC_EVIDENCE_PROMPTS: "true" }), true);
  assert.equal(isFollowupTimelineEnabled({}), false);
  assert.equal(isFollowupTimelineEnabled({ NEXT_PUBLIC_ENABLE_FOLLOWUP_TIMELINE: "true" }), true);
});

test("clinic prompts: all group counts zero → general coordination prompt", () => {
  const prompts = buildClinicEvidencePromptsFromSufficiency(confidenceFromUploads([]));
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0]?.groupId, "general");
  assert.ok(prompts[0]?.prompt.toLowerCase().includes("optional"));
});

test("clinic prompts: all strong → empty list", () => {
  const uploads = [
    { id: "p1", type: "patient_photo:preop_front" },
    { id: "p2", type: "patient_photo:preop_left" },
    { id: "p3", type: "patient_photo:preop_right" },
    { id: "p4", type: "patient_photo:preop_top" },
    { id: "p5", type: "patient_photo:preop_crown" },
    { id: "p6", type: "patient_photo:preop_donor_rear" },
    { id: "d1", type: "patient_photo:day0_donor" },
    { id: "d2", type: "patient_photo:postop_month6_donor" },
    { id: "d3", type: "patient_photo:postop_month12_donor" },
    { id: "s1", type: "patient_photo:day0_recipient" },
    { id: "s2", type: "patient_photo:intraop_extraction" },
    { id: "s3", type: "patient_photo:intraop_recipient_sites" },
    { id: "s4", type: "patient_photo:intraop_implantation" },
    { id: "gr1", type: "patient_photo:graft_tray_overview" },
    { id: "gr2", type: "patient_photo:graft_tray_closeup" },
    { id: "gr3", type: "patient_photo:graft_hydration_solution" },
    { id: "f1", type: "patient_photo:postop_month3_front" },
    { id: "f2", type: "patient_photo:postop_month6_top" },
    { id: "f3", type: "patient_photo:postop_month12_crown" },
  ];
  const prompts = buildClinicEvidencePromptsFromSufficiency(confidenceFromUploads(uploads));
  assert.equal(prompts.length, 0);
});

test("clinic prompts: weak follow-up uses professional tone", () => {
  const prompts = buildClinicEvidencePromptsFromSufficiency(
    confidenceFromUploads([{ id: "1", type: "patient_photo:postop_month6_front" }])
  );
  const f = prompts.find((p) => p.groupId === "followup_outcome_evidence");
  assert.ok(f);
  assert.ok(/patient|milestone|long-term|12|6/i.test(f!.prompt));
});

test("timeline: no patient photos → day1 recommended, later upcoming", () => {
  const t = buildFollowupTimelineFromPatientUploads([]);
  assert.equal(statusById(t, "day1"), "recommended");
  assert.equal(statusById(t, "week1"), "upcoming");
  assert.equal(statusById(t, "month12"), "upcoming");
});

test("timeline: day0_recipient completes day1 stage", () => {
  const t = buildFollowupTimelineFromPatientUploads([{ type: "patient_photo:day0_recipient" }]);
  assert.equal(statusById(t, "day1"), "completed");
  assert.equal(statusById(t, "week1"), "recommended");
});

test("timeline: month6 before day1 still marks month6 completed and day1 recommended", () => {
  const t = buildFollowupTimelineFromPatientUploads([{ type: "patient_photo:postop_month6_front" }]);
  assert.equal(statusById(t, "day1"), "recommended");
  assert.equal(statusById(t, "month6"), "completed");
});

test("timeline: all milestone categories present → all completed", () => {
  const t = buildFollowupTimelineFromPatientUploads([
    { type: "patient_photo:postop_day1_recipient" },
    { type: "patient_photo:postop_week1_donor" },
    { type: "patient_photo:postop_month3_front" },
    { type: "patient_photo:postop_month6_top" },
    { type: "patient_photo:postop_month9_crown" },
    { type: "patient_photo:postop_month12_front" },
  ]);
  for (const s of t.stages) {
    assert.equal(s.status, "completed", s.id);
  }
});

test("timeline: ignores non-patient_photo types", () => {
  const t = buildFollowupTimelineFromPatientUploads([{ type: "doctor_photo:img_preop_front" }]);
  assert.equal(statusById(t, "day1"), "recommended");
});

test("canSubmit unchanged for patient minimal set with optional follow-up categories", () => {
  const base = [
    { type: "patient_photo:preop_front" },
    { type: "patient_photo:preop_top" },
    { type: "patient_photo:preop_donor_rear" },
  ];
  assert.equal(canSubmit("patient", base), true);
  assert.equal(
    canSubmit("patient", [...base, { type: "patient_photo:postop_month12_front" }]),
    true
  );
});
