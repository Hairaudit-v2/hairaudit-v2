/**
 * Run: npx tsx --test tests/auditorPatientPhotoCategories.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDITOR_REASSIGNABLE_CATEGORY_KEYS,
  auditorPatientPhotoCategoryLabel,
  normalizeAuditorPatientPhotoCategory,
} from "@/lib/auditor/auditorPatientPhotoCategories";

test("normalize accepts audit bucket key patient_current_front", () => {
  assert.equal(normalizeAuditorPatientPhotoCategory("patient_current_front"), "patient_current_front");
});

test("normalize accepts any_preop and postop_month12_donor", () => {
  assert.equal(normalizeAuditorPatientPhotoCategory("any_preop"), "any_preop");
  assert.equal(normalizeAuditorPatientPhotoCategory("postop_month12_donor"), "postop_month12_donor");
});

test("normalize accepts patient API alias preop-front", () => {
  assert.equal(normalizeAuditorPatientPhotoCategory("preop-front"), "preop_front");
});

test("reassignable keys list is non-empty and sorted", () => {
  assert.ok(AUDITOR_REASSIGNABLE_CATEGORY_KEYS.length > 40);
  const sorted = [...AUDITOR_REASSIGNABLE_CATEGORY_KEYS].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(AUDITOR_REASSIGNABLE_CATEGORY_KEYS, sorted);
});

test("auditorPatientPhotoCategoryLabel resolves upload def and bucket def", () => {
  assert.ok(auditorPatientPhotoCategoryLabel("preop_front").toLowerCase().includes("front"));
  assert.ok(auditorPatientPhotoCategoryLabel("patient_current_front").toLowerCase().includes("front"));
});
