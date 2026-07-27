/**
 * FI-OUTCOME-INTELLIGENCE-1C — Capture schedule tests.
 * Run: pnpm exec tsx --test tests/longitudinalCaptureSchedule.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  addCalendarDays,
  addCalendarMonths,
  buildMilestoneSchedule,
  CAPTURE_WINDOW_RADIUS_DAYS,
  normalizeProcedureDate,
  relateToCaptureWindow,
  todayUtcDate,
} from "@/lib/outcomeIntelligence/longitudinalCaptureSchedule";

describe("FI-OUTCOME-INTELLIGENCE-1C schedule", () => {
  it("1. Month 3 target derived from procedure date", () => {
    const s = buildMilestoneSchedule({ procedureDate: "2025-01-15" });
    assert.equal(s.find((m) => m.stage === "month_3")?.targetDate, "2025-04-15");
  });

  it("2. Month 6 target derived correctly", () => {
    const s = buildMilestoneSchedule({ procedureDate: "2025-01-15" });
    assert.equal(s.find((m) => m.stage === "month_6")?.targetDate, "2025-07-15");
  });

  it("3. Month 9 target derived correctly", () => {
    const s = buildMilestoneSchedule({ procedureDate: "2025-01-15" });
    assert.equal(s.find((m) => m.stage === "month_9")?.targetDate, "2025-10-15");
  });

  it("4. Month 12 target derived correctly", () => {
    const s = buildMilestoneSchedule({ procedureDate: "2025-01-15" });
    assert.equal(s.find((m) => m.stage === "month_12")?.targetDate, "2026-01-15");
  });

  it("5. calendar-month math handles month-end dates", () => {
    assert.equal(addCalendarMonths("2025-01-31", 1), "2025-02-28");
    assert.equal(addCalendarMonths("2024-01-31", 1), "2024-02-29");
    assert.equal(addCalendarMonths("2025-03-31", 1), "2025-04-30");
  });

  it("6. window boundaries correct", () => {
    const s = buildMilestoneSchedule({ procedureDate: "2025-01-15" });
    const m3 = s.find((m) => m.stage === "month_3")!;
    assert.equal(m3.windowStart, addCalendarDays(m3.targetDate, -CAPTURE_WINDOW_RADIUS_DAYS.month_3));
    assert.equal(m3.windowEnd, addCalendarDays(m3.targetDate, CAPTURE_WINDOW_RADIUS_DAYS.month_3));

    const m6 = s.find((m) => m.stage === "month_6")!;
    assert.equal(
      m6.windowStart,
      addCalendarDays(m6.targetDate, -CAPTURE_WINDOW_RADIUS_DAYS.month_6)
    );
    assert.equal(
      m6.windowEnd,
      addCalendarDays(m6.targetDate, CAPTURE_WINDOW_RADIUS_DAYS.month_6)
    );

    const m12 = s.find((m) => m.stage === "month_12")!;
    assert.equal(
      m12.windowEnd,
      addCalendarDays(m12.targetDate, CAPTURE_WINDOW_RADIUS_DAYS.month_12)
    );
  });

  it("7. injected now makes status relation deterministic", () => {
    const s = buildMilestoneSchedule({ procedureDate: "2025-01-15" });
    const m6 = s.find((m) => m.stage === "month_6")!;
    assert.equal(
      relateToCaptureWindow({
        nowDate: todayUtcDate("2025-03-01T00:00:00.000Z"),
        windowStart: m6.windowStart,
        windowEnd: m6.windowEnd,
      }),
      "before"
    );
    assert.equal(
      relateToCaptureWindow({
        nowDate: m6.targetDate,
        windowStart: m6.windowStart,
        windowEnd: m6.windowEnd,
      }),
      "within"
    );
    assert.equal(
      relateToCaptureWindow({
        nowDate: addCalendarDays(m6.windowEnd, 1),
        windowStart: m6.windowStart,
        windowEnd: m6.windowEnd,
      }),
      "after"
    );
  });

  it("normalizes ISO procedure dates to YYYY-MM-DD", () => {
    assert.equal(normalizeProcedureDate("2025-01-15T12:00:00.000Z"), "2025-01-15");
    assert.equal(normalizeProcedureDate("2025-02-31"), null);
  });
});
