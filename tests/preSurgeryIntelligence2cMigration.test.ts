/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Migration shape checks (local file + optional remote).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

describe("HA-PRE-SURGERY-INTELLIGENCE-2C migration", () => {
  it("expands projection lifecycle statuses and audit events", () => {
    const sql = readFileSync(
      path.join(
        "supabase",
        "migrations",
        "20260730140000_hairaudit_pre_surgery_intelligence_2c.sql"
      ),
      "utf8"
    );
    for (const status of [
      "draft_request",
      "queued",
      "generating",
      "clinician_review",
      "failed",
      "expired",
    ]) {
      assert.match(sql, new RegExp(`'${status}'`));
    }
    assert.match(sql, /idempotency_key/);
    assert.match(sql, /patient_sharing_enabled/);
    assert.match(sql, /projection_regeneration_requested/);
    assert.match(sql, /projection_patient_sharing_revoked/);
    assert.doesNotMatch(sql, /ALTER TABLE public\.hairaudit_projection_snapshots/);
    assert.match(sql, /Distinct from hairaudit_projection_snapshots/);
  });
});
