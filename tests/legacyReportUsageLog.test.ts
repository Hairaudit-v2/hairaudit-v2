import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_REPORT_USAGE_LOG_TAG,
  createLegacyReportUsageTracker,
  logLegacyReportUsage,
} from "../src/lib/reports/legacyReportUsageLog";

describe("legacy report usage logging", () => {
  it("uses the retirement instrumentation tag", () => {
    assert.equal(LEGACY_REPORT_USAGE_LOG_TAG, "[legacy-report-usage]");
  });

  it("tracker emits structured fields without report content", () => {
    const lines: unknown[] = [];
    const original = console.info;
    console.info = (...args: unknown[]) => {
      lines.push(args);
    };
    try {
      const tracker = createLegacyReportUsageTracker("req-test-1");
      tracker.setHasCaseId(true);
      tracker.setAuthPath("session");
      tracker.setRequestedAuditMode("patient");
      tracker.setAuditMode("patient");
      tracker.setSuccessMeta({ reviewAreaCount: 2, hasReportVersion: true });
      tracker.finish("success", 200);
    } finally {
      console.info = original;
    }

    assert.equal(lines.length, 1);
    const [tag, payload] = lines[0] as [string, Record<string, unknown>];
    assert.equal(tag, "[legacy-report-usage]");
    assert.equal(payload.requestId, "req-test-1");
    assert.equal(payload.hasCaseId, true);
    assert.equal(payload.authPath, "session");
    assert.equal(payload.auditMode, "patient");
    assert.equal(payload.outcome, "success");
    assert.equal(payload.status, 200);
    assert.equal(payload.reviewAreaCount, 2);
    assert.equal(payload.hasReportVersion, true);
    assert.ok(typeof payload.timestamp === "string");
    assert.ok(typeof payload.durationMs === "number");
    assert.equal("caseId" in payload, false);
    assert.equal("summary" in payload, false);
    assert.equal("findings" in payload, false);
  });

  it("logLegacyReportUsage accepts failure outcomes", () => {
    let captured: Record<string, unknown> | null = null;
    const original = console.info;
    console.info = (tag: string, payload: Record<string, unknown>) => {
      if (tag === LEGACY_REPORT_USAGE_LOG_TAG) captured = payload;
    };
    try {
      logLegacyReportUsage({
        requestId: "req-unauth",
        timestamp: new Date().toISOString(),
        hasCaseId: true,
        auditMode: null,
        requestedAuditMode: "patient",
        authPath: "none",
        outcome: "unauthorized",
        status: 401,
        durationMs: 12,
      });
    } finally {
      console.info = original;
    }
    assert.ok(captured);
    assert.equal(captured!.outcome, "unauthorized");
  });
});
