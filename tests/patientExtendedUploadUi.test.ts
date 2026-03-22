/**
 * Stage 3 extended patient upload UI specs and feature flag.
 * Run: npx tsx --test tests/patientExtendedUploadUi.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  ENABLE_EXTENDED_PATIENT_UPLOADS,
  isExtendedPatientUploadsEnabled,
} from "@/lib/features/enableExtendedPatientUploads";
import {
  getPatientExtendedUploadGroupsResolved,
  PATIENT_EXTENDED_UPLOAD_GROUP_SPECS,
  PATIENT_EXTENDED_UPLOAD_MICROCOPY,
} from "@/lib/patientExtendedUploadUi";
import { PATIENT_UPLOAD_CATEGORY_DEFS } from "@/lib/patientPhotoCategoryConfig";
import { PATIENT_PHOTO_SCHEMA } from "@/lib/photoSchemas";
import {
  REQUIRED_PATIENT_UPLOAD_CATEGORY_KEYS,
  PATIENT_PHOTO_CATEGORIES,
} from "@/lib/photoCategories";
import { canSubmit } from "@/lib/auditPhotoSchemas";

test("feature flag: off unless env is exactly 'true' (case-insensitive)", () => {
  assert.equal(isExtendedPatientUploadsEnabled({}), false);
  assert.equal(isExtendedPatientUploadsEnabled({ [ENABLE_EXTENDED_PATIENT_UPLOADS]: "" }), false);
  assert.equal(isExtendedPatientUploadsEnabled({ [ENABLE_EXTENDED_PATIENT_UPLOADS]: "false" }), false);
  assert.equal(isExtendedPatientUploadsEnabled({ [ENABLE_EXTENDED_PATIENT_UPLOADS]: "true" }), true);
  assert.equal(isExtendedPatientUploadsEnabled({ [ENABLE_EXTENDED_PATIENT_UPLOADS]: "TRUE" }), true);
});

test("feature flag: no-arg path reads literal NEXT_PUBLIC key (matches client bundle inlining)", () => {
  const prev = process.env.NEXT_PUBLIC_ENABLE_EXTENDED_PATIENT_UPLOADS;
  try {
    process.env.NEXT_PUBLIC_ENABLE_EXTENDED_PATIENT_UPLOADS = "true";
    assert.equal(isExtendedPatientUploadsEnabled(), true);
    process.env.NEXT_PUBLIC_ENABLE_EXTENDED_PATIENT_UPLOADS = "false";
    assert.equal(isExtendedPatientUploadsEnabled(), false);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_ENABLE_EXTENDED_PATIENT_UPLOADS;
    else process.env.NEXT_PUBLIC_ENABLE_EXTENDED_PATIENT_UPLOADS = prev;
  }
});

test("PATIENT_EXTENDED_UPLOAD_GROUP_SPECS covers 36 Stage-2 keys once", () => {
  const all = PATIENT_EXTENDED_UPLOAD_GROUP_SPECS.flatMap((g) => [...g.keys]);
  assert.equal(all.length, 36);
  assert.equal(new Set(all).size, 36);
});

test("resolved extended categories are all optional and not default-visible", () => {
  const resolved = getPatientExtendedUploadGroupsResolved();
  assert.equal(resolved.length, PATIENT_EXTENDED_UPLOAD_GROUP_SPECS.length);
  for (const g of resolved) {
    for (const c of g.categories) {
      assert.equal(c.required, false);
      assert.equal(c.visibleInUi, false);
    }
  }
});

test("extended group keys do not include any of the eight basic required upload keys", () => {
  const requiredSet = new Set(REQUIRED_PATIENT_UPLOAD_CATEGORY_KEYS);
  const extended = new Set(PATIENT_EXTENDED_UPLOAD_GROUP_SPECS.flatMap((g) => [...g.keys]));
  for (const r of requiredSet) {
    assert.equal(extended.has(r), false);
  }
});

test("audit-photos patient key set contract: union of schema + all upload defs", () => {
  const union = new Set([
    ...PATIENT_PHOTO_SCHEMA.map((c) => c.key),
    ...PATIENT_UPLOAD_CATEGORY_DEFS.map((d) => d.key),
  ]);
  assert.ok(union.has("postop_month12_front"));
  assert.ok(union.has("patient_current_front"));
  assert.ok(union.has("preop_front"));
  assert.equal(union.size, PATIENT_PHOTO_SCHEMA.length + PATIENT_UPLOAD_CATEGORY_DEFS.length);
});

test("PATIENT_PHOTO_CATEGORIES still only 10 visible (flag does not widen default list)", () => {
  assert.equal(PATIENT_PHOTO_CATEGORIES.length, 10);
});

test("microcopy constants present", () => {
  assert.ok(PATIENT_EXTENDED_UPLOAD_MICROCOPY.eyebrow.length > 3);
  assert.ok(PATIENT_EXTENDED_UPLOAD_MICROCOPY.body.length > 10);
});

test("canSubmit unchanged when extended uploads present (still needs three audit buckets)", () => {
  const minimal = [
    { type: "patient_photo:preop_front" },
    { type: "patient_photo:preop_top" },
    { type: "patient_photo:preop_donor_rear" },
  ];
  assert.equal(canSubmit("patient", minimal), true);

  const withExtended = [...minimal, { type: "patient_photo:graft_tray_closeup" }];
  assert.equal(canSubmit("patient", withExtended), true);

  const extendedOnly = [{ type: "patient_photo:postop_month12_front" }];
  assert.equal(canSubmit("patient", extendedOnly), false);
});
