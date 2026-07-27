/**
 * FI-OUTCOME-INTELLIGENCE-1E — Reference image resolution tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveCurrentImageForCategory,
  resolveReferenceImageForRole,
} from "../src/lib/outcomeIntelligence/guidedCaptureReference";

describe("guided capture reference", () => {
  it("22-23. reference shown when available; absent when not", () => {
    const none = resolveReferenceImageForRole({
      role: "followup_front",
      stage: "month_6",
      uploads: [],
    });
    assert.equal(none, null);

    const hit = resolveReferenceImageForRole({
      role: "followup_front",
      stage: "month_6",
      uploads: [
        {
          id: "u1",
          type: "patient_photo:preop_front",
          storage_path: "cases/c/patient/preop_front/a.jpg",
          created_at: "2025-01-01T00:00:00.000Z",
        },
      ],
    });
    assert.ok(hit);
    assert.equal(hit.source, "preoperative");
    assert.match(hit.label, /before-surgery/i);
    assert.doesNotMatch(hit.storagePath, /^https?:\/\//);
  });

  it("25. prefers prior follow-up over surgery day over preop", () => {
    const hit = resolveReferenceImageForRole({
      role: "followup_front",
      stage: "month_6",
      uploads: [
        {
          id: "pre",
          type: "patient_photo:preop_front",
          storage_path: "cases/c/patient/preop_front/a.jpg",
          created_at: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "day0",
          type: "patient_photo:day0_recipient",
          storage_path: "cases/c/patient/day0_recipient/b.jpg",
          created_at: "2024-06-01T00:00:00.000Z",
        },
        {
          id: "m3",
          type: "patient_photo:postop_month3_front",
          storage_path: "cases/c/patient/postop_month3_front/c.jpg",
          created_at: "2024-09-01T00:00:00.000Z",
        },
      ],
    });
    assert.equal(hit?.source, "prior_followup");
    assert.equal(hit?.uploadId, "m3");
  });

  it("excludes current stage uploads from reference", () => {
    const hit = resolveReferenceImageForRole({
      role: "followup_front",
      stage: "month_6",
      uploads: [
        {
          id: "m6",
          type: "patient_photo:postop_month6_front",
          storage_path: "cases/c/patient/postop_month6_front/c.jpg",
          created_at: "2025-01-01T00:00:00.000Z",
        },
      ],
    });
    assert.equal(hit, null);
  });

  it("current image resolves latest matching category", () => {
    const cur = resolveCurrentImageForCategory({
      uploadCategory: "postop_month6_front",
      uploads: [
        {
          id: "old",
          type: "patient_photo:postop_month6_front",
          storage_path: "cases/c/patient/postop_month6_front/old.jpg",
          created_at: "2025-01-01T00:00:00.000Z",
        },
        {
          id: "new",
          type: "patient_photo:postop_month6_front",
          storage_path: "cases/c/patient/postop_month6_front/new.jpg",
          created_at: "2025-02-01T00:00:00.000Z",
        },
      ],
    });
    assert.equal(cur?.uploadId, "new");
  });
});
