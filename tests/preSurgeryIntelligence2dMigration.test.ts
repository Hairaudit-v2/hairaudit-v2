/**
 * HA-PRE-SURGERY-INTELLIGENCE-2D migration shape checks.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

describe("HA-PRE-SURGERY-INTELLIGENCE-2D migration", () => {
  it("adds activation columns, consent table, and 2D audit events without touching 1D snapshots", () => {
    const sql = readFileSync(
      path.join(
        "supabase",
        "migrations",
        "20260730160000_hairaudit_pre_surgery_intelligence_2d.sql"
      ),
      "utf8"
    );
    assert.match(sql, /stale_at/);
    assert.match(sql, /shadow_mode/);
    assert.match(sql, /patient_consent_id/);
    assert.match(sql, /hairaudit_pre_surgery_projection_consents/);
    assert.match(sql, /projection_preflight_rejected/);
    assert.match(sql, /projection_activation_denied/);
    assert.match(sql, /projection_output_validation_failed/);
    assert.match(sql, /projection_marked_stale/);
    assert.match(sql, /projection_patient_consent_recorded/);
    assert.doesNotMatch(sql, /ALTER TABLE public\.hairaudit_projection_snapshots/);
    assert.match(sql, /Keep provider=stub/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.hairaudit_pre_surgery_projection_consents/);
  });
});
