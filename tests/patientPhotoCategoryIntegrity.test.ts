/**
 * Run: npx tsx --test tests/patientPhotoCategoryIntegrity.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPatientPhotoCategoryFields,
  getPatientPhotoCategoryIntegrity,
  resolvePatientPhotoCategoryKeyAligned,
  summarizePatientPhotoCategoryIntegrity,
  syncPatientPhotoMetadataCategoryToType,
} from "@/lib/uploads/patientPhotoCategoryIntegrity";

test("aligned type + metadata: no attention needed", () => {
  const row = {
    type: "patient_photo:preop_front",
    metadata: { category: "preop_front" },
  };
  const r = getPatientPhotoCategoryIntegrity(row);
  assert.equal(r.aligned, true);
  assert.equal(r.needsAttention, false);
  assert.equal(r.issues.length, 0);
  assert.equal(resolvePatientPhotoCategoryKeyAligned(row), "preop_front");
});

test("mismatched type suffix vs metadata.category flags drift", () => {
  const row = {
    type: "patient_photo:preop_front",
    metadata: { category: "preop_top" },
  };
  const r = getPatientPhotoCategoryIntegrity(row);
  assert.equal(r.aligned, false);
  assert.equal(r.needsAttention, true);
  assert.ok(r.issues.some((i) => i.includes("does not match type suffix")));
  assert.equal(resolvePatientPhotoCategoryKeyAligned(row), "preop_front");
});

test("invalid metadata with valid type suffix", () => {
  const row = {
    type: "patient_photo:preop_front",
    metadata: { category: "Front View" },
  };
  const r = getPatientPhotoCategoryIntegrity(row);
  assert.equal(r.metaSlugValidFormat, false);
  assert.equal(r.typeSlugValidFormat, true);
  assert.equal(r.needsAttention, true);
  assert.ok(r.issues.some((i) => i.includes("metadata.category is missing or not a valid slug")));
  assert.equal(resolvePatientPhotoCategoryKeyAligned(row), "preop_front");
});

test("invalid type suffix with valid metadata slug", () => {
  const row = {
    type: "patient_photo:not-a-slug",
    metadata: { category: "preop_front" },
  };
  const r = getPatientPhotoCategoryIntegrity(row);
  assert.equal(r.typeSlugValidFormat, false);
  assert.equal(r.metaSlugValidFormat, true);
  assert.equal(r.needsAttention, true);
  assert.ok(
    r.issues.some((i) => i.includes("metadata.category is set") && i.includes("type suffix is missing or not a valid"))
  );
  assert.equal(resolvePatientPhotoCategoryKeyAligned(row), "preop_front");
});

test("applyPatientPhotoCategoryFields sets type and metadata.category together", () => {
  const out = applyPatientPhotoCategoryFields("preop_top", { original_name: "a.jpg", x: 1 });
  assert.equal(out.type, "patient_photo:preop_top");
  assert.equal(out.metadata.category, "preop_top");
  assert.equal(out.metadata.original_name, "a.jpg");
  assert.equal(out.metadata.x, 1);
});

test("syncPatientPhotoMetadataCategoryToType repairs category from type", () => {
  const m = syncPatientPhotoMetadataCategoryToType("patient_photo:preop_crown", {
    category: "wrong",
    display_name: "Hi",
  });
  assert.equal(m.category, "preop_crown");
  assert.equal(m.display_name, "Hi");
});

test("summarizePatientPhotoCategoryIntegrity counts patient rows with issues", () => {
  const rows = [
    { id: "a", type: "patient_photo:preop_front", metadata: { category: "preop_front" } },
    { id: "b", type: "patient_photo:preop_front", metadata: { category: "preop_top" } },
    { id: "c", type: "doctor_photo:x", metadata: {} },
  ];
  const s = summarizePatientPhotoCategoryIntegrity(rows, 10);
  assert.equal(s.patientPhotoCount, 2);
  assert.equal(s.rowsNeedingAttention, 1);
  assert.equal(s.samples[0]?.uploadId, "b");
});
