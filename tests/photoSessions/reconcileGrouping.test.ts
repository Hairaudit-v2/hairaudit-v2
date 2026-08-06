/**
 * HA-PHOTO-TIMELINE-2A Phase C — multi-signal grouping tests.
 * Run: npx tsx --test tests/photoSessions/reconcileGrouping.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReconcileUploadSignals,
  latestCorrectionCategoryByUploadId,
  weakCategoryFromFilename,
} from "@/lib/photoSessions/reconcileSignals";
import {
  groupUploadsIntoSessionCandidates,
  SESSION_CLUSTER_WINDOW_MS,
} from "@/lib/photoSessions/groupUploadsIntoSessionCandidates";

test("corrections override stale category in effective signal", () => {
  const signals = buildReconcileUploadSignals(
    [
      {
        id: "u1",
        type: "patient_photo:preop_front",
        created_at: "2025-01-01T00:00:00.000Z",
        metadata: { category: "preop_front" },
      },
    ],
    [
      {
        upload_id: "u1",
        action: "reassign",
        new_category: "postop_month6_front",
        created_at: "2025-02-01T00:00:00.000Z",
      },
      {
        upload_id: "u1",
        action: "reassign",
        new_category: "postop_month3_front",
        created_at: "2025-01-15T00:00:00.000Z",
      },
    ]
  );
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.effectiveCategory, "postop_month6_front");
  assert.equal(signals[0]!.categorySource, "correction");

  const map = latestCorrectionCategoryByUploadId([
    {
      upload_id: "u1",
      action: "reassign",
      new_category: "postop_month6_front",
      created_at: "2025-02-01T00:00:00.000Z",
    },
  ]);
  assert.equal(map.get("u1"), "postop_month6_front");
});

test("same-milestone within 2h cluster merges into one candidate", () => {
  const signals = buildReconcileUploadSignals([
    {
      id: "a",
      type: "patient_photo:postop_month6_front",
      created_at: "2025-06-01T10:00:00.000Z",
    },
    {
      id: "b",
      type: "patient_photo:postop_month6_top",
      created_at: "2025-06-01T11:00:00.000Z",
    },
    {
      id: "c",
      type: "patient_photo:postop_month6_donor",
      created_at: "2025-06-01T11:30:00.000Z",
    },
  ]);
  const candidates = groupUploadsIntoSessionCandidates(signals);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]!.milestone, "month_6");
  assert.equal(candidates[0]!.status, "active");
  assert.equal(candidates[0]!.uploads.length, 3);
});

test("same-milestone far-apart uploads stay separate", () => {
  const t0 = Date.parse("2025-06-01T10:00:00.000Z");
  const far = new Date(t0 + SESSION_CLUSTER_WINDOW_MS + 60_000).toISOString();
  const signals = buildReconcileUploadSignals([
    {
      id: "a",
      type: "patient_photo:postop_month6_front",
      created_at: "2025-06-01T10:00:00.000Z",
    },
    {
      id: "b",
      type: "patient_photo:postop_month6_top",
      created_at: far,
    },
  ]);
  const candidates = groupUploadsIntoSessionCandidates(signals);
  assert.equal(candidates.length, 2);
  assert.ok(candidates.every((c) => c.milestone === "month_6"));
});

test("low confidence patient_current without band → needs_review", () => {
  const signals = buildReconcileUploadSignals([
    {
      id: "a",
      type: "patient_photo:patient_current_front",
      created_at: "2025-06-01T10:00:00.000Z",
    },
    {
      id: "b",
      type: "patient_photo:patient_current_top",
      created_at: "2025-06-01T10:05:00.000Z",
    },
  ]);
  const candidates = groupUploadsIntoSessionCandidates(signals, { monthsSinceBand: null });
  assert.ok(candidates.length >= 1);
  assert.ok(candidates.every((c) => c.status === "needs_review"));
  assert.ok(candidates.every((c) => c.milestone === "unknown" || c.confidence < 0.6));
});

test("filename conflicting with category forces needs_review unknown", () => {
  const signals = buildReconcileUploadSignals([
    {
      id: "a",
      type: "patient_photo:postop_month6_front",
      created_at: "2025-06-01T10:00:00.000Z",
      metadata: { original_name: "month3_front_view.jpg" },
    },
  ]);
  const candidates = groupUploadsIntoSessionCandidates(signals);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]!.milestone, "unknown");
  assert.equal(candidates[0]!.status, "needs_review");
});

test("weakCategoryFromFilename extracts month bands", () => {
  assert.equal(weakCategoryFromFilename("IMG_month6_top.jpg"), "postop_month6_top");
  assert.equal(weakCategoryFromFilename("preop_baseline_front.png"), "preop_front");
  assert.equal(weakCategoryFromFilename("random.jpg"), null);
});

test("excluded uploads are omitted from signals", () => {
  const signals = buildReconcileUploadSignals([
    {
      id: "a",
      type: "patient_photo:preop_front",
      created_at: "2025-01-01T00:00:00.000Z",
      metadata: { audit_excluded: true },
    },
  ]);
  assert.equal(signals.length, 0);
});
