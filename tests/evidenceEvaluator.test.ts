/**
 * Run: npx tsx --test tests/evidenceEvaluator.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEvidence, mapPhotosToEvidenceKeys } from "@/lib/evidence/evidenceEvaluator";

test("empty photos yields insufficient metrics and zero overall score", () => {
  const r = evaluateEvidence([]);
  assert.equal(r.overallCoverageScore, 0);
  assert.equal(r.metricCoverage.graft_handling.status, "insufficient");
  assert.equal(r.metricCoverage.graft_handling.provided, 0);
});

test("mapPhotosToEvidenceKeys dedupes and maps patient graft tray categories", () => {
  const keys = mapPhotosToEvidenceKeys([
    { type: "patient_photo:graft_tray_overview" },
    { type: "patient_photo:graft_tray_closeup" },
    { type: "patient_photo:graft_tray_overview" },
  ]);
  assert.equal(keys.has("graft_tray_overview"), true);
  assert.equal(keys.has("graft_tray_closeup"), true);
  assert.equal(keys.size, 2);
});

test("graft_handling complete when both tray views present", () => {
  const r = evaluateEvidence([
    { type: "patient_photo:graft_tray_overview" },
    { type: "patient_photo:graft_tray_closeup" },
  ]);
  assert.equal(r.metricCoverage.graft_handling.status, "complete");
  assert.equal(r.metricCoverage.graft_handling.coverageScore, 100);
});

test("doctor img keys map to evidence", () => {
  const keys = mapPhotosToEvidenceKeys([{ type: "doctor_photo:img_graft_tray_closeup" }]);
  assert.equal(keys.has("graft_tray_closeup"), true);
});

test("mixed case uploads evaluate without throw", () => {
  const r = evaluateEvidence([
    { type: "patient_photo:day0_recipient" },
    { type: "patient_photo:preop_left" },
    { type: "doctor_photo:img_intraop_extraction" },
    { metadata: { category: "graft_tray_overview" } },
  ]);
  assert.ok(typeof r.overallCoverageScore === "number");
  assert.ok(r.metricCoverage.transection_risk.status === "complete");
});
