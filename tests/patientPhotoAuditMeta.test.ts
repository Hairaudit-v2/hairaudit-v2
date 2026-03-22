/**
 * Run: npx tsx --test tests/patientPhotoAuditMeta.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  displayNameFromPatientUpload,
  effectivePatientPhotoCategoryKey,
  filterPatientPhotosForAuditUse,
  isPatientUploadAuditExcluded,
  storagePathPatientCategoryFolder,
} from "@/lib/uploads/patientPhotoAuditMeta";
import { inferCanonicalPhotoCategory } from "@/lib/photos/classification";

test("isPatientUploadAuditExcluded only for patient_photo with metadata flag", () => {
  assert.equal(isPatientUploadAuditExcluded({ type: "patient_photo:preop_front", metadata: { audit_excluded: true } }), true);
  assert.equal(isPatientUploadAuditExcluded({ type: "patient_photo:preop_front", metadata: {} }), false);
  assert.equal(isPatientUploadAuditExcluded({ type: "doctor_photo:x", metadata: { audit_excluded: true } }), false);
});

test("filterPatientPhotosForAuditUse removes excluded patient photos only", () => {
  const rows = [
    { type: "patient_photo:a", metadata: { audit_excluded: true } },
    { type: "patient_photo:b" },
    { type: "clinic_photo:x" },
  ];
  const out = filterPatientPhotosForAuditUse(rows);
  assert.equal(out.length, 2);
  assert.ok(out.some((r) => r.type === "patient_photo:b"));
  assert.ok(out.some((r) => r.type === "clinic_photo:x"));
});

test("effectivePatientPhotoCategoryKey prefers valid type suffix over conflicting metadata", () => {
  assert.equal(
    effectivePatientPhotoCategoryKey({
      type: "patient_photo:postop_month12_front",
      metadata: { category: "postop_month12_front" },
    }),
    "postop_month12_front"
  );
  assert.equal(
    effectivePatientPhotoCategoryKey({
      type: "patient_photo:preop_front",
      metadata: { category: "postop_month12_front" },
    }),
    "preop_front"
  );
});

test("storagePathPatientCategoryFolder parses patient segment", () => {
  assert.equal(
    storagePathPatientCategoryFolder("cases/c1/patient/preop_front/123-x.jpg"),
    "preop_front"
  );
  assert.equal(storagePathPatientCategoryFolder("no/patient/here"), null);
});

test("inferCanonicalPhotoCategory uses type suffix over conflicting metadata (ignores path for patient_photo)", () => {
  const aligned = inferCanonicalPhotoCategory({
    type: "patient_photo:postop_month12_front",
    storage_path: "cases/x/patient/preop_front/999.jpg",
    metadata: { category: "postop_month12_front" },
  });
  assert.equal(aligned, "postop_month12_front");

  const conflict = inferCanonicalPhotoCategory({
    type: "patient_photo:preop_front",
    storage_path: "cases/x/patient/postop_month12_front/999.jpg",
    metadata: { category: "postop_month12_front" },
  });
  assert.equal(conflict, "preop_front");
});

test("displayNameFromPatientUpload prefers display_name then original_name", () => {
  assert.equal(
    displayNameFromPatientUpload({
      type: "patient_photo:preop_front",
      metadata: { display_name: "Shown", original_name: "orig.jpg" },
      storage_path: "cases/1/patient/x/y.jpg",
    }),
    "Shown"
  );
  assert.equal(
    displayNameFromPatientUpload({
      type: "patient_photo:preop_front",
      metadata: { original_name: "orig.jpg" },
      storage_path: "cases/1/patient/x/y.jpg",
    }),
    "orig.jpg"
  );
});
