/**
 * Regression tests for:
 * - Doctor primary_procedure_type handling
 * - Canonical upload category mapping
 * - Auditor missing evidence visibility
 *
 * Run: tsx --test tests/audit-harness/regression/auditHarness.regression.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCountsByKey,
  canSubmit,
  computeEvidenceDetails,
  getRequiredKeys,
  parsePhotoKey,
  DOCTOR_REQUIRED_KEYS,
  PATIENT_REQUIRED_KEYS,
} from "@/lib/auditPhotoSchemas";
import { PROCEDURE_TYPE_FUE, PROCEDURE_TYPE_FUT } from "@/lib/doctorAuditSchema";
import { PATIENT_PHOTO_CATEGORY_ALIASES } from "@/lib/photoCategories";
import { DOCTOR_PHOTO_CATEGORIES } from "@/lib/doctorPhotoCategories";
import { getRequiredKeysForSubmit } from "../config/canonicalMappings";

// ----- 1. Doctor primary_procedure_type handling -----

test("doctor primary_procedure_type: FUE values are in PROCEDURE_TYPE_FUE", () => {
  assert.ok(PROCEDURE_TYPE_FUE.includes("fue_manual"));
  assert.ok(PROCEDURE_TYPE_FUE.includes("fue_motorized"));
  assert.ok(PROCEDURE_TYPE_FUE.includes("fue_robotic"));
  assert.ok(PROCEDURE_TYPE_FUE.includes("combined"));
});

test("doctor primary_procedure_type: FUT values are in PROCEDURE_TYPE_FUT", () => {
  assert.ok(PROCEDURE_TYPE_FUT.includes("fut"));
  assert.ok(PROCEDURE_TYPE_FUT.includes("combined"));
});

test("doctor primary_procedure_type: FUE and FUT share combined for mixed procedures", () => {
  assert.ok(PROCEDURE_TYPE_FUE.includes("combined"));
  assert.ok(PROCEDURE_TYPE_FUT.includes("combined"));
});

// ----- 2. Canonical upload category mapping -----

test("canonical mapping: PATIENT_REQUIRED_KEYS match submit requirements", () => {
  assert.deepEqual([...PATIENT_REQUIRED_KEYS].sort(), ["patient_current_donor_rear", "patient_current_front", "patient_current_top"].sort());
});

test("canonical mapping: DOCTOR_REQUIRED_KEYS match submit requirements", () => {
  const expected = [
    "img_preop_front",
    "img_preop_left",
    "img_preop_right",
    "img_preop_top",
    "img_preop_donor_rear",
    "img_immediate_postop_recipient",
    "img_immediate_postop_donor",
  ];
  assert.deepEqual([...DOCTOR_REQUIRED_KEYS].sort(), expected.sort());
});

test("canonical mapping: getRequiredKeysForSubmit returns same keys as getRequiredKeys", () => {
  const patientFromHarness = getRequiredKeysForSubmit("patient");
  const doctorFromHarness = getRequiredKeysForSubmit("doctor");
  assert.deepEqual([...patientFromHarness].sort(), [...PATIENT_REQUIRED_KEYS].sort());
  assert.deepEqual([...doctorFromHarness].sort(), [...DOCTOR_REQUIRED_KEYS].sort());
});

test("canonical mapping: patient legacy aliases normalize to required keys", () => {
  const aliases: [string, string][] = [
    ["preop-front", "preop_front"],
    ["donor_rear", "preop_donor_rear"],
    ["donor", "preop_donor_rear"],
  ];
  for (const [alias, canonical] of aliases) {
    assert.equal(PATIENT_PHOTO_CATEGORY_ALIASES[alias as keyof typeof PATIENT_PHOTO_CATEGORY_ALIASES], canonical);
  }
});

test("canonical mapping: patient_photo legacy/stored types satisfy canSubmit after normalization", () => {
  // Stored types use canonical category (e.g. preop_front from photoCategories); legacy map maps to patient_current_*
  const photos = [
    { type: "patient_photo:preop_front" },
    { type: "patient_photo:preop_top" },
    { type: "patient_photo:preop_donor_rear" },
  ];
  const can = canSubmit("patient", photos);
  assert.equal(can, true, "Stored category types normalize to patient required keys");
});

test("canonical mapping: doctor_photo legacy types (preop_*) normalize and satisfy canSubmit", () => {
  const photos = [
    { type: "doctor_photo:preop_front" },
    { type: "doctor_photo:preop_left" },
    { type: "doctor_photo:preop_right" },
    { type: "doctor_photo:preop_top" },
    { type: "doctor_photo:preop_donor_rear" },
    { type: "doctor_photo:day0_recipient" },
    { type: "doctor_photo:day0_donor" },
  ];
  const can = canSubmit("doctor", photos);
  assert.equal(can, true, "Legacy doctor types (day0_*, preop_*) should normalize to img_* and satisfy canSubmit");
});

test("canonical mapping: parsePhotoKey extracts submitter and key", () => {
  assert.deepEqual(parsePhotoKey("patient_photo:preop_front"), { submitterType: "patient", key: "preop_front" });
  assert.deepEqual(parsePhotoKey("doctor_photo:img_preop_front"), { submitterType: "doctor", key: "img_preop_front" });
  assert.deepEqual(parsePhotoKey("clinic_photo:img_preop_front"), {
    submitterType: "clinic",
    key: "img_preop_front",
  });
});

test("canonical mapping: DOCTOR_PHOTO_CATEGORIES includes all DOCTOR_REQUIRED_KEYS", () => {
  const categoryKeys = new Set(DOCTOR_PHOTO_CATEGORIES.map((c) => c.key));
  for (const req of DOCTOR_REQUIRED_KEYS) {
    assert.ok(categoryKeys.has(req), `Required key ${req} must be in DOCTOR_PHOTO_CATEGORIES`);
  }
});

// ----- 3. Auditor missing evidence visibility -----

test("auditor missing evidence: computeEvidenceDetails.missingRequired matches getRequiredKeys minus completed", () => {
  const photos = [
    { type: "patient_photo:preop_front" },
    { type: "patient_photo:preop_top" },
    // patient_current_donor_rear missing
  ];
  const details = computeEvidenceDetails("patient", photos);
  assert.ok(details.missingRequired.includes("patient_current_donor_rear"));
  assert.equal(details.submitterType, "patient");
  assert.ok(Array.isArray(details.completedCategories));
  assert.ok(typeof details.countsByKey === "object");
});

test("auditor missing evidence: evidence_details shape is suitable for auditor display", () => {
  const photos = [
    { type: "doctor_photo:img_preop_front" },
    { type: "doctor_photo:img_preop_left" },
    { type: "doctor_photo:img_preop_right" },
    { type: "doctor_photo:img_preop_top" },
    { type: "doctor_photo:img_preop_donor_rear" },
    { type: "doctor_photo:img_immediate_postop_recipient" },
    // img_immediate_postop_donor missing
  ];
  const details = computeEvidenceDetails("doctor", photos);
  assert.equal(details.missingRequired.length, 1);
  assert.equal(details.missingRequired[0], "img_immediate_postop_donor");
  assert.ok(details.completedCategories.length >= 6);
  assert.ok(details.countsByKey["img_immediate_postop_donor"] === undefined || details.countsByKey["img_immediate_postop_donor"] === 0);
});

test("auditor missing evidence: when all required present, missingRequired is empty", () => {
  const patientPhotos = [
    { type: "patient_photo:preop_front" },
    { type: "patient_photo:preop_top" },
    { type: "patient_photo:preop_donor_rear" },
  ];
  const patientDetails = computeEvidenceDetails("patient", patientPhotos);
  assert.equal(patientDetails.missingRequired.length, 0);

  const doctorPhotos = [
    { type: "doctor_photo:img_preop_front" },
    { type: "doctor_photo:img_preop_left" },
    { type: "doctor_photo:img_preop_right" },
    { type: "doctor_photo:img_preop_top" },
    { type: "doctor_photo:img_preop_donor_rear" },
    { type: "doctor_photo:img_immediate_postop_recipient" },
    { type: "doctor_photo:img_immediate_postop_donor" },
  ];
  const doctorDetails = computeEvidenceDetails("doctor", doctorPhotos);
  assert.equal(doctorDetails.missingRequired.length, 0);
});

test("auditor missing evidence: buildCountsByKey and getRequiredKeys align with computeEvidenceDetails", () => {
  const photos = [{ type: "patient_photo:preop_front" }];
  const counts = buildCountsByKey(photos, "patient");
  const required = getRequiredKeys("patient");
  const completed = new Set(Object.keys(counts).filter((k) => (counts[k] ?? 0) >= 1));
  const missing = required.filter((k) => !completed.has(k));
  const details = computeEvidenceDetails("patient", photos);
  assert.deepEqual(missing.sort(), details.missingRequired.sort());
});
