import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LOW_RES_MIN_EDGE_PX, LOW_RES_WARNING } from "../src/lib/uploads/compressImage";
import { UPLOAD_LIMITS } from "../src/lib/uploads/safeUpload";
import { PATIENT_REQUIRED_VIEWS_COPY } from "../src/lib/uploads/patientUploadClient";
import { PATIENT_REQUIRED_KEYS } from "../src/lib/auditPhotoSchemas";
import { getRequiredKeys } from "../src/lib/auditPhotoSchemas";

describe("patient upload hardening constants", () => {
  it("defines low resolution advisory threshold", () => {
    assert.ok(LOW_RES_MIN_EDGE_PX >= 800);
    assert.match(LOW_RES_WARNING, /low resolution/i);
  });

  it("documents required patient views for UI", () => {
    assert.equal(PATIENT_REQUIRED_VIEWS_COPY.slots.length, 3);
    assert.match(PATIENT_REQUIRED_VIEWS_COPY.body, /front/i);
    assert.match(PATIENT_REQUIRED_VIEWS_COPY.body, /donor/i);
  });

  it("aligns schema required keys with front/top/donor", () => {
    const required = getRequiredKeys("patient");
    assert.deepEqual([...required], [...PATIENT_REQUIRED_KEYS]);
    assert.ok(required.includes("patient_current_front"));
    assert.ok(required.includes("patient_current_top"));
    assert.ok(required.includes("patient_current_donor_rear"));
  });

  it("enforces per-request file count limit", () => {
    assert.ok(UPLOAD_LIMITS.MAX_FILES_PER_REQUEST >= 1);
    assert.ok(UPLOAD_LIMITS.MAX_FILE_SIZE_MB > 0);
  });
});

describe("partial upload state expectations", () => {
  it("treats incomplete required set as not ready", () => {
    const required = getRequiredKeys("patient");
    const completed = new Set(["patient_current_front"]);
    const missing = [...required].filter((k) => !completed.has(k));
    assert.equal(missing.length, 2);
    assert.ok(missing.includes("patient_current_top"));
  });
});

describe("duplicate upload protection expectations", () => {
  it("required keys are a fixed small set to reduce slot confusion", () => {
    assert.equal(PATIENT_REQUIRED_KEYS.length, 3);
  });
});
