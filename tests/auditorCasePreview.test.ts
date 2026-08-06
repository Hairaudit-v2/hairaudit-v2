/**
 * Auditor desk preview photo selection.
 * Run: pnpm exec tsx --test tests/auditorCasePreview.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  pickAuditorCasePreviewPathByCaseId,
  pickAuditorCasePreviewUpload,
  previewRankForUploadType,
} from "../src/lib/auditor/auditorCasePreview";

describe("auditorCasePreview", () => {
  it("prefers preop_front over other patient photos", () => {
    const best = pickAuditorCasePreviewUpload([
      { case_id: "c1", type: "patient_photo:preop_top", storage_path: "cases/c1/top.jpg" },
      { case_id: "c1", type: "patient_photo:preop_front", storage_path: "cases/c1/front.jpg" },
      { case_id: "c1", type: "patient_photo:preop_donor_rear", storage_path: "cases/c1/donor.jpg" },
    ]);
    assert.equal(best?.storage_path, "cases/c1/front.jpg");
  });

  it("falls back to current front then any front then any patient photo", () => {
    assert.equal(
      pickAuditorCasePreviewUpload([
        { case_id: "c1", type: "patient_photo:patient_current_front", storage_path: "cases/c1/current.jpg" },
        { case_id: "c1", type: "patient_photo:preop_top", storage_path: "cases/c1/top.jpg" },
      ])?.storage_path,
      "cases/c1/current.jpg"
    );

    assert.ok(previewRankForUploadType("patient_photo:preop_front") > previewRankForUploadType("patient_photo:preop_top"));
  });

  it("maps one best path per case id", () => {
    const map = pickAuditorCasePreviewPathByCaseId([
      { case_id: "a", type: "patient_photo:preop_front", storage_path: "cases/a/front.jpg" },
      { case_id: "b", type: "patient_photo:preop_top", storage_path: "cases/b/top.jpg" },
      { case_id: "b", type: "patient_photo:current_front", storage_path: "cases/b/front.jpg" },
    ]);
    assert.equal(map.a, "cases/a/front.jpg");
    assert.equal(map.b, "cases/b/front.jpg");
  });

  it("skips rows without storage_path", () => {
    const best = pickAuditorCasePreviewUpload([
      { case_id: "c1", type: "patient_photo:preop_front", storage_path: null },
      { case_id: "c1", type: "patient_photo:preop_top", storage_path: "cases/c1/top.jpg" },
    ]);
    assert.equal(best?.storage_path, "cases/c1/top.jpg");
  });
});
