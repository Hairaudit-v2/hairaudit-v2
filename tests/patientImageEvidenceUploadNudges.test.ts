/**
 * Stage 7 — informational upload nudges from sufficiency output.
 * Run: npx tsx --test tests/patientImageEvidenceUploadNudges.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { buildPatientImageEvidenceGroups } from "@/lib/audit/patientAiImageEvidence";
import { buildPatientImageEvidenceConfidence } from "@/lib/audit/patientImageEvidenceConfidence";
import { buildPatientImageEvidenceUploadNudges } from "@/lib/audit/patientImageEvidenceUploadNudges";
import { isPatientImageEvidenceNudgesEnabled } from "@/lib/features/enablePatientImageEvidenceNudges";
import { canSubmit } from "@/lib/auditPhotoSchemas";

function confidenceFromUploads(uploads: { id: string; type: string }[]) {
  const g = buildPatientImageEvidenceGroups({ enabled: true, uploads });
  return buildPatientImageEvidenceConfidence(g);
}

test("all grouped counts zero → single general informational nudge", () => {
  const n = buildPatientImageEvidenceUploadNudges(confidenceFromUploads([]));
  assert.equal(n.length, 1);
  assert.equal(n[0]?.groupId, "general");
  assert.ok(n[0]?.recommendation.includes("none are required"));
});

test("all strong areas → no nudges", () => {
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
  const n = buildPatientImageEvidenceUploadNudges(confidenceFromUploads(uploads));
  assert.equal(n.length, 0);
});

test("limited follow-up surfaces follow-up nudge with expected wording", () => {
  const n = buildPatientImageEvidenceUploadNudges(
    confidenceFromUploads([{ id: "1", type: "patient_photo:postop_month6_front" }])
  );
  assert.ok(n.some((x) => x.groupId === "followup_outcome_evidence"));
  assert.ok(n.some((x) => x.recommendation.includes("12-month") || x.recommendation.includes("6-")));
});

test("absent graft handling mentions tray or sorting", () => {
  const n = buildPatientImageEvidenceUploadNudges(
    confidenceFromUploads([
      { id: "1", type: "patient_photo:preop_front" },
      { id: "2", type: "patient_photo:preop_top" },
      { id: "3", type: "patient_photo:preop_donor_rear" },
    ])
  );
  const graft = n.find((x) => x.groupId === "graft_handling_evidence");
  assert.ok(graft);
  assert.ok(/tray|sorting|hydration/i.test(graft!.recommendation));
});

test("patient nudges feature flag: opt-out with false", () => {
  assert.equal(isPatientImageEvidenceNudgesEnabled({ NEXT_PUBLIC_ENABLE_PATIENT_IMAGE_EVIDENCE_NUDGES: "false" }), false);
  assert.equal(isPatientImageEvidenceNudgesEnabled({}), true);
});

test("canSubmit unchanged when uploads match minimal patient requirements plus extras", () => {
  const base = [
    { type: "patient_photo:preop_front" },
    { type: "patient_photo:preop_top" },
    { type: "patient_photo:preop_donor_rear" },
  ];
  assert.equal(canSubmit("patient", base), true);
  assert.equal(
    canSubmit("patient", [...base, { type: "patient_photo:graft_tray_closeup" }]),
    true
  );
});
