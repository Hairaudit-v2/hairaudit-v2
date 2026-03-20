/**
 * Stage 4 patient AI image evidence grouping.
 * Run: npx tsx --test tests/patientAiImageEvidence.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPatientImageEvidenceGroups,
  storageCategoryKeyFromPatientUploadType,
  formatPatientImageEvidenceGroupsForPrompt,
  __getCategoryToGroupsForTests,
  __assertAllGroupedCategoriesExistInConfig,
} from "@/lib/audit/patientAiImageEvidence";
import { isAiExtendedImageEvidenceEnabled } from "@/lib/features/enableAiExtendedImageEvidence";
import { canSubmit } from "@/lib/auditPhotoSchemas";
import { PATIENT_UPLOAD_CATEGORY_DEFS } from "@/lib/patientPhotoCategoryConfig";

test("config: every grouped category exists in PATIENT_UPLOAD_CATEGORY_DEFS", () => {
  __assertAllGroupedCategoriesExistInConfig();
});

test("grouping spec covers 36 Stage-2 upload keys plus legacy preop/day0 keys used in groups", () => {
  const map = __getCategoryToGroupsForTests();
  const keys = Object.keys(map);
  const known = new Set(PATIENT_UPLOAD_CATEGORY_DEFS.map((d) => d.key));
  for (const k of keys) assert.ok(known.has(k), `unknown category in grouping map: ${k}`);
  assert.ok(keys.length >= 40);
});

test("flag helper: ENABLE_AI_EXTENDED_IMAGE_EVIDENCE", () => {
  assert.equal(isAiExtendedImageEvidenceEnabled({ ENABLE_AI_EXTENDED_IMAGE_EVIDENCE: "true" }), true);
  assert.equal(isAiExtendedImageEvidenceEnabled({ ENABLE_AI_EXTENDED_IMAGE_EVIDENCE: "false" }), false);
  assert.equal(isAiExtendedImageEvidenceEnabled({}), false);
});

test("buildPatientImageEvidenceGroups: disabled returns stub without grouping uploads", () => {
  const r = buildPatientImageEvidenceGroups({
    enabled: false,
    uploads: [{ id: "1", type: "patient_photo:graft_tray_closeup" }],
  });
  assert.equal(r.enabled, false);
  assert.equal(r.hasAnyGroupedEvidence, false);
  assert.equal(r.totalPatientPhotoUploads, 0);
  assert.equal(r.groups.graft_handling_evidence.count, 0);
});

test("legacy baseline: preop_front lands in baseline_evidence only", () => {
  const r = buildPatientImageEvidenceGroups({
    enabled: true,
    uploads: [{ id: "a", type: "patient_photo:preop_front", storage_path: "/x" }],
  });
  assert.equal(r.groups.baseline_evidence.hasAny, true);
  assert.equal(r.groups.baseline_evidence.items[0]?.category, "preop_front");
  assert.equal(r.groups.donor_monitoring_evidence.hasAny, false);
});

test("preop_donor_rear in baseline and donor_monitoring", () => {
  const r = buildPatientImageEvidenceGroups({
    enabled: true,
    uploads: [{ id: "b", type: "patient_photo:preop_donor_rear" }],
  });
  assert.equal(r.groups.baseline_evidence.count, 1);
  assert.equal(r.groups.donor_monitoring_evidence.count, 1);
});

test("donor monitoring: day0_donor and postop_month3_donor", () => {
  const r = buildPatientImageEvidenceGroups({
    enabled: true,
    uploads: [
      { id: "1", type: "patient_photo:day0_donor" },
      { id: "2", type: "patient_photo:postop_month3_donor" },
    ],
  });
  assert.equal(r.groups.donor_monitoring_evidence.count, 2);
  assert.equal(r.groups.surgical_evidence.hasAny, false);
});

test("surgical_evidence: day0_recipient + intraop_extraction", () => {
  const r = buildPatientImageEvidenceGroups({
    enabled: true,
    uploads: [
      { id: "1", type: "patient_photo:day0_recipient" },
      { id: "2", type: "patient_photo:intraop_extraction" },
    ],
  });
  assert.equal(r.groups.surgical_evidence.count, 2);
});

test("graft_handling_evidence: graft tray keys", () => {
  const r = buildPatientImageEvidenceGroups({
    enabled: true,
    uploads: [{ id: "g1", type: "patient_photo:graft_tray_closeup" }],
  });
  assert.equal(r.groups.graft_handling_evidence.hasAny, true);
  assert.equal(r.groups.graft_handling_evidence.items[0]?.category, "graft_tray_closeup");
});

test("followup_outcome_evidence: month 6 and 12 vertices", () => {
  const r = buildPatientImageEvidenceGroups({
    enabled: true,
    uploads: [
      { id: "1", type: "patient_photo:postop_month6_front" },
      { id: "2", type: "patient_photo:postop_month12_crown" },
      { id: "3", type: "patient_photo:postop_month6_donor" },
    ],
  });
  assert.equal(r.groups.followup_outcome_evidence.count, 3);
});

test("postop_month3_donor appears in donor_monitoring and followup", () => {
  const r = buildPatientImageEvidenceGroups({
    enabled: true,
    uploads: [{ id: "x", type: "patient_photo:postop_month3_donor" }],
  });
  assert.equal(r.groups.donor_monitoring_evidence.count, 1);
  assert.equal(r.groups.followup_outcome_evidence.count, 1);
});

test("prepared manifest metadata attached when upload_id matches", () => {
  const r = buildPatientImageEvidenceGroups({
    enabled: true,
    uploads: [{ id: "u1", type: "patient_photo:graft_tray_overview" }],
    preparedImages: [
      {
        upload_id: "u1",
        category: "preop_front",
        prepared_path: "cases/c/ prepared/u1.jpg",
      },
    ],
  });
  const it = r.groups.graft_handling_evidence.items[0];
  assert.equal(it?.preparedSourceKey, "cases/c/ prepared/u1.jpg");
  assert.equal(it?.manifestCategory, "preop_front");
});

test("doctor_photo rows ignored", () => {
  const r = buildPatientImageEvidenceGroups({
    enabled: true,
    uploads: [{ id: "d", type: "doctor_photo:img_preop_front" }],
  });
  assert.equal(r.totalPatientPhotoUploads, 0);
});

test("formatPatientImageEvidenceGroupsForPrompt empty when no groups populated", () => {
  const r = buildPatientImageEvidenceGroups({
    enabled: true,
    uploads: [{ id: "1", type: "doctor_photo:x" }],
  });
  assert.equal(formatPatientImageEvidenceGroupsForPrompt(r), "");
});

test("formatPatientImageEvidenceGroupsForPrompt includes group ids when populated", () => {
  const r = buildPatientImageEvidenceGroups({
    enabled: true,
    uploads: [{ id: "1", type: "patient_photo:graft_sorting" }],
  });
  const t = formatPatientImageEvidenceGroupsForPrompt(r);
  assert.ok(t.includes("graft_handling_evidence"));
  assert.ok(t.includes("graft_sorting"));
});

test("storageCategoryKeyFromPatientUploadType resolves donor_rear alias", () => {
  assert.equal(storageCategoryKeyFromPatientUploadType("patient_photo:donor_rear"), "preop_donor_rear");
});

test("canSubmit unchanged with extended uploads in mix", () => {
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
