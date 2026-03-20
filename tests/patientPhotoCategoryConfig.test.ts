/**
 * Patient upload category config regression — ensures refactor did not change validation or legacy maps.
 * Run: npx tsx --test tests/patientPhotoCategoryConfig.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  PATIENT_UPLOAD_CATEGORY_DEFS,
  REQUIRED_PATIENT_UPLOAD_CATEGORY_KEYS,
  buildPatientUploadToAuditKeyMap,
  PATIENT_AUDIT_PHOTO_BUCKET_DEFS,
} from "@/lib/patientPhotoCategoryConfig";
import {
  REQUIRED_PATIENT_PHOTO_CATEGORIES,
  getMissingRequiredPatientPhotoCategories,
  buildPatientPhotoCategoryCounts,
  PATIENT_PHOTO_CATEGORY_ALIASES,
} from "@/lib/photoCategories";
import {
  canSubmit,
  computeEvidenceDetails,
  getCompletedCategories,
  PATIENT_REQUIRED_KEYS,
} from "@/lib/auditPhotoSchemas";

const EXPECTED_REQUIRED_UPLOAD_KEYS = [
  "preop_front",
  "preop_left",
  "preop_right",
  "preop_top",
  "preop_crown",
  "preop_donor_rear",
  "day0_recipient",
  "day0_donor",
] as const;

const EXPECTED_LEGACY_MAP_ENTRIES: Record<string, string> = {
  preop_front: "patient_current_front",
  preop_top: "patient_current_top",
  preop_donor_rear: "patient_current_donor_rear",
  donor_rear: "patient_current_donor_rear",
  preop_left: "patient_current_left",
  preop_right: "patient_current_right",
  preop_crown: "patient_current_crown",
  day0_recipient: "any_day0",
  day0_donor: "any_day0",
  intraop: "any_day0",
  postop_day0: "any_early_postop_day0_3",
};

test("REQUIRED_PATIENT_UPLOAD_CATEGORY_KEYS matches historical eight required categories", () => {
  assert.deepEqual([...REQUIRED_PATIENT_UPLOAD_CATEGORY_KEYS], [...EXPECTED_REQUIRED_UPLOAD_KEYS]);
  assert.deepEqual([...REQUIRED_PATIENT_PHOTO_CATEGORIES], [...EXPECTED_REQUIRED_UPLOAD_KEYS]);
});

test("buildPatientUploadToAuditKeyMap matches pre-refactor PATIENT_LEGACY_MAP entries", () => {
  const map = buildPatientUploadToAuditKeyMap();
  for (const [k, v] of Object.entries(EXPECTED_LEGACY_MAP_ENTRIES)) {
    assert.equal(
      map[k],
      v,
      `legacy key ${k} should map to ${v}`
    );
  }
});

test("PATIENT_UPLOAD_CATEGORY_DEFS preserves upload metadata counts (10 rows)", () => {
  assert.equal(PATIENT_UPLOAD_CATEGORY_DEFS.length, 10);
  assert.equal(
    PATIENT_UPLOAD_CATEGORY_DEFS.filter((d) => d.required).length,
    8
  );
});

test("PATIENT_AUDIT_PHOTO_BUCKET_DEFS unchanged bucket count and required keys", () => {
  assert.equal(PATIENT_AUDIT_PHOTO_BUCKET_DEFS.length, 9);
  const required = PATIENT_AUDIT_PHOTO_BUCKET_DEFS.filter((b) => b.required).map((b) => b.key);
  assert.deepEqual(
    [...required].sort(),
    ["patient_current_donor_rear", "patient_current_front", "patient_current_top"].sort()
  );
});

test("getMissingRequiredPatientPhotoCategories: empty uploads yields eight missing", () => {
  const missing = getMissingRequiredPatientPhotoCategories([]);
  assert.deepEqual([...missing], [...EXPECTED_REQUIRED_UPLOAD_KEYS]);
});

test("getMissingRequiredPatientPhotoCategories: full eight present yields none missing", () => {
  const uploads = [...EXPECTED_REQUIRED_UPLOAD_KEYS].map((key) => ({
    type: `patient_photo:${key}`,
  }));
  const missing = getMissingRequiredPatientPhotoCategories(uploads);
  assert.equal(missing.length, 0);
});

test("buildPatientPhotoCategoryCounts: one file per required category", () => {
  const uploads = [...EXPECTED_REQUIRED_UPLOAD_KEYS].map((key) => ({
    type: `patient_photo:${key}`,
  }));
  const counts = buildPatientPhotoCategoryCounts(uploads);
  for (const k of EXPECTED_REQUIRED_UPLOAD_KEYS) {
    assert.equal(counts[k], 1);
  }
});

test("patient category aliases unchanged", () => {
  assert.equal(PATIENT_PHOTO_CATEGORY_ALIASES["preop-front"], "preop_front");
  assert.equal(PATIENT_PHOTO_CATEGORY_ALIASES["donor_rear"], "preop_donor_rear");
  assert.equal(PATIENT_PHOTO_CATEGORY_ALIASES["donor"], "preop_donor_rear");
  assert.equal(PATIENT_PHOTO_CATEGORY_ALIASES["postop"], "postop_day0");
});

test("canSubmit + computeEvidenceDetails patient behavior unchanged", () => {
  const minimal = [
    { type: "patient_photo:preop_front" },
    { type: "patient_photo:preop_top" },
    { type: "patient_photo:preop_donor_rear" },
  ];
  assert.equal(canSubmit("patient", minimal), true);

  const incomplete = [
    { type: "patient_photo:preop_front" },
    { type: "patient_photo:preop_top" },
  ];
  const details = computeEvidenceDetails("patient", incomplete);
  assert.ok(details.missingRequired.includes("patient_current_donor_rear"));

  assert.deepEqual(
    [...PATIENT_REQUIRED_KEYS].sort(),
    ["patient_current_donor_rear", "patient_current_front", "patient_current_top"].sort()
  );
});

test("getCompletedCategories patient: minimal three uploads completes required audit buckets", () => {
  const photos = [
    { type: "patient_photo:preop_front" },
    { type: "patient_photo:preop_top" },
    { type: "patient_photo:preop_donor_rear" },
  ];
  const done = getCompletedCategories("patient", photos);
  for (const k of PATIENT_REQUIRED_KEYS) {
    assert.ok(done.has(k), `expected missing bucket ${k}`);
  }
});
