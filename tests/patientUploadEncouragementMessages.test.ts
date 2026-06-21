/**
 * HA-UX-6C — encouragement message mapping for guided patient uploads.
 * Run: npx tsx --test tests/patientUploadEncouragementMessages.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getPatientUploadEncouragementMessageKey,
  PATIENT_UPLOAD_ENCOURAGEMENT_PAUSE_MS,
} from "../src/lib/uploads/patientUploadEncouragementMessages";
import en from "../src/lib/i18n/translations/en.json";

function encouragementText(pathway: "pre_surgery" | "post_surgery", count: number): string {
  const key = getPatientUploadEncouragementMessageKey(pathway, count);
  assert.ok(key);
  const parts = key.split(".");
  let node: unknown = en;
  for (const part of parts) {
    node = (node as Record<string, unknown>)[part];
  }
  return String(node);
}

describe("patient upload encouragement messages", () => {
  it("pauses 1200ms before auto-advance", () => {
    assert.equal(PATIENT_UPLOAD_ENCOURAGEMENT_PAUSE_MS, 1200);
  });

  it("maps pre-surgery completed counts 1–5 to pathway-specific keys", () => {
    for (let i = 1; i <= 5; i++) {
      const key = getPatientUploadEncouragementMessageKey("pre_surgery", i);
      assert.equal(key, `patient.upload.encouragement.preSurgery.${i}`);
    }
  });

  it("maps post-surgery completed counts 1–5 to pathway-specific keys", () => {
    for (let i = 1; i <= 5; i++) {
      const key = getPatientUploadEncouragementMessageKey("post_surgery", i);
      assert.equal(key, `patient.upload.encouragement.postSurgery.${i}`);
    }
  });

  it("returns null for out-of-range completed counts", () => {
    assert.equal(getPatientUploadEncouragementMessageKey("pre_surgery", 0), null);
    assert.equal(getPatientUploadEncouragementMessageKey("pre_surgery", 6), null);
    assert.equal(getPatientUploadEncouragementMessageKey("post_surgery", -1), null);
  });

  it("pre-surgery upload 1 mentions hair pattern and remaining count", () => {
    const text = encouragementText("pre_surgery", 1);
    assert.match(text, /hair pattern/i);
    assert.match(text, /4 photos remaining/i);
  });

  it("pre-surgery upload 5 is final encouragement without remaining count", () => {
    const text = encouragementText("pre_surgery", 5);
    assert.match(text, /everything needed/i);
    assert.doesNotMatch(text, /remaining/i);
  });

  it("post-surgery upload 2 mentions transplanted area", () => {
    const text = encouragementText("post_surgery", 2);
    assert.match(text, /transplanted area/i);
    assert.match(text, /3 photos remaining/i);
  });

  it("messages avoid forbidden patient-facing terminology", () => {
    for (const pathway of ["pre_surgery", "post_surgery"] as const) {
      for (let i = 1; i <= 5; i++) {
        const text = encouragementText(pathway, i);
        assert.doesNotMatch(text, /\bAI\b|GPT|forensic|AuditOS|Precision Score/i);
      }
    }
  });
});
