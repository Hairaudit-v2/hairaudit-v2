import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveTrainingCaseMetrics, diffClockMinutes } from "@/lib/academy/trainingCaseMetricsDerived";
import { validateMetricsNumbers } from "@/lib/academy/trainingCaseCorrections/validation";

describe("training case metrics derived", () => {
  it("computes extraction duration and grafts per hour", () => {
    const d = deriveTrainingCaseMetrics({
      grafts_attempted: 100,
      grafts_extracted: 500,
      grafts_implanted: 480,
      total_hairs: 960,
      extraction_start_time: "09:00",
      extraction_end_time: "11:00",
      implantation_start_time: "11:30",
      implantation_end_time: "14:30",
      transected_grafts_count: null,
      buried_grafts_count: null,
      popped_grafts_count: null,
    });
    assert.equal(d.extraction_minutes, 120);
    assert.equal(d.extraction_grafts_per_hour, 250);
    assert.equal(d.hair_to_graft_ratio, 2);
  });

  it("rejects negative graft counts", () => {
    const err = validateMetricsNumbers({ grafts_extracted: -1 });
    assert.match(err ?? "", /non-negative/i);
  });

  it("diffClockMinutes returns positive duration for same-day times", () => {
    assert.equal(diffClockMinutes("09:00", "11:00"), 120);
  });
});
