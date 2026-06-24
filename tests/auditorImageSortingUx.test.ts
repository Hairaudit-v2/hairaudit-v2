/**
 * Run: npx tsx --test tests/auditorImageSortingUx.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAuditorGroupedCategoryOptions,
  buildRequiredPhotoChecklist,
  filterLikelyMatchesForCategory,
  getPathwayPinnedCategoryKeys,
  readClassifierSuggestion,
  sortUploadsForAuditorReview,
} from "@/lib/auditor/auditorImageSortingUx";

test("post-surgery pinned keys prioritize repair workflow categories", () => {
  const pinned = getPathwayPinnedCategoryKeys("post_surgery");
  assert.equal(pinned[0], "preop_front");
  assert.ok(pinned.includes("current_recipient_closeup"));
  assert.ok(pinned.includes("preop_donor_closeup"));
  assert.ok(pinned.includes("graft_count_board"));
});

test("pre-surgery pinned keys prioritize planning views", () => {
  const pinned = getPathwayPinnedCategoryKeys("pre_surgery");
  assert.deepEqual(pinned.slice(0, 3), ["preop_front", "preop_left", "preop_right"]);
});

test("grouped options pin pathway categories first", () => {
  const opts = buildAuditorGroupedCategoryOptions({ pathway: "post_surgery" });
  assert.ok(opts.length > 10);
  assert.equal(opts[0]?.groupId, "pinned");
  assert.equal(opts[0]?.key, "preop_front");
});

test("advanced categories hidden until showAdvanced", () => {
  const basic = buildAuditorGroupedCategoryOptions({ pathway: "post_surgery", showAdvanced: false });
  const advanced = buildAuditorGroupedCategoryOptions({ pathway: "post_surgery", showAdvanced: true });
  assert.ok(advanced.length >= basic.length);
});

test("required checklist reflects pathway missing slots", () => {
  const checklist = buildRequiredPhotoChecklist("post_surgery", [
    { type: "patient_photo:preop_front" },
  ]);
  const front = checklist.find((c) => c.key === "preop_front");
  const recipient = checklist.find((c) => c.key === "current_recipient_closeup");
  assert.equal(front?.satisfied, true);
  assert.equal(recipient?.satisfied, false);
});

test("readClassifierSuggestion parses ai metadata", () => {
  const suggestion = readClassifierSuggestion({
    ai_detected_category: "preop_donor_rear",
    ai_classification_confidence: 0.82,
  });
  assert.ok(suggestion);
  assert.equal(suggestion?.categoryKey, "preop_donor_rear");
  assert.equal(suggestion?.isLowConfidence, false);
});

test("filterLikelyMatchesForCategory finds AI suggestions", () => {
  const uploads = [
    { id: "a", type: "patient_photo:any_preop", metadata: { ai_detected_category: "preop_top" } },
    { id: "b", type: "patient_photo:preop_front", metadata: {} },
  ];
  const matches = filterLikelyMatchesForCategory(uploads, "preop_top", (u) =>
    String(u.type).replace("patient_photo:", "")
  );
  assert.deepEqual(matches.map((m) => m.id), ["a"]);
});

test("sortUploadsForAuditorReview puts uncategorized first", () => {
  const sorted = sortUploadsForAuditorReview(
    [
      { id: "1", type: "patient_photo:preop_front", created_at: "2026-01-02" },
      { id: "2", type: "patient_photo:unknown_slot", metadata: {}, created_at: "2026-01-01" },
    ],
    "post_surgery",
    (u) => {
      const raw = String(u.type).replace("patient_photo:", "");
      return raw === "unknown_slot" ? "uncategorized" : raw;
    }
  );
  assert.equal(sorted[0]?.id, "2");
});
