/**
 * HA-PRE-SURGERY-INTELLIGENCE-2B — Migration / RLS contract drift tests (no DB).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

const root = path.join(process.cwd(), "supabase", "migrations");

describe("HA-PRE-SURGERY-INTELLIGENCE-2B migration contract", () => {
  it("2A migration creates all tables with RLS and service-role policies", () => {
    const sql = readFileSync(
      path.join(root, "20260730120000_hairaudit_pre_surgery_intelligence.sql"),
      "utf8"
    );
    for (const table of [
      "hairaudit_pre_surgery_image_reviews",
      "hairaudit_pre_surgery_image_corrections",
      "hairaudit_pre_surgery_annotations",
      "hairaudit_pre_surgery_observations",
      "hairaudit_pre_surgery_graft_plans",
      "hairaudit_pre_surgery_projections",
      "hairaudit_pre_surgery_audit_events",
    ]) {
      assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
      assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
      assert.match(sql, new RegExp(`${table}_service_role`));
    }
    assert.match(sql, /hairaudit_pre_surgery_graft_plans_case_version_uq/);
  });

  it("2B grants migration revokes anon and authenticated", () => {
    const sql = readFileSync(
      path.join(root, "20260730123000_hairaudit_pre_surgery_intelligence_2b_grants.sql"),
      "utf8"
    );
    assert.match(sql, /REVOKE ALL ON TABLE public\.hairaudit_pre_surgery_graft_plans FROM anon, authenticated/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.hairaudit_pre_surgery_projections FROM anon, authenticated/);
  });
});
