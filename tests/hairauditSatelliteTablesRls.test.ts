import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SATELLITE_RLS = path.join(
  process.cwd(),
  "supabase/migrations/20260702150100_hairaudit_satellite_tables_rls_hardening.sql"
);
const COMMUNITY_BASE = path.join(
  process.cwd(),
  "supabase/migrations/20260313000002_rate_my_hair_transplant.sql"
);

const SATELLITE_TABLES = [
  "community_cases",
  "community_case_ratings",
  "hli_longevity_profiles",
  "hli_longevity_intakes",
  "hli_longevity_questionnaires",
  "hli_longevity_documents",
  "hli_longevity_blood_requests",
  "hli_longevity_audit_events",
  "hli_entitlement_ledger",
  "hli_membership_included_zoom_consumptions",
] as const;

describe("HA-SECURITY-1B satellite tables RLS migration", () => {
  const sql = fs.readFileSync(SATELLITE_RLS, "utf8");

  it("enables RLS on all advisor ERROR satellite tables", () => {
    for (const table of SATELLITE_TABLES) {
      assert.match(sql, new RegExp(`'${table}'`));
      assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    }
  });

  it("revokes anon and authenticated table access", () => {
    assert.match(sql, /REVOKE ALL ON TABLE public\.%I FROM anon, authenticated/);
    assert.doesNotMatch(sql, /GRANT SELECT ON TABLE.*TO anon/);
    assert.doesNotMatch(sql, /GRANT INSERT ON TABLE.*TO authenticated/);
  });

  it("preserves service_role operational access", () => {
    assert.match(sql, /GRANT ALL ON TABLE public\.%I TO service_role/);
  });

  it("uses guarded to_regclass checks for optional tables", () => {
    assert.match(sql, /to_regclass\('public\.' \|\| tbl\)/);
  });

  it("documents community API-only access model", () => {
    assert.match(sql, /\/api\/community-cases/);
    assert.match(sql, /No direct anon\/authenticated PostgREST access/);
  });

  it("documents HLI service_role-only until client auth policies exist", () => {
    assert.match(sql, /HLI client auth policies/);
  });

  it("does not touch HairAudit core forensic tables", () => {
    assert.doesNotMatch(sql, /public\.cases/);
    assert.doesNotMatch(sql, /public\.uploads/);
    assert.doesNotMatch(sql, /public\.reports/);
    assert.doesNotMatch(sql, /public\.audit_photos/);
  });
});

describe("community baseline migration (pre-1B)", () => {
  const sql = fs.readFileSync(COMMUNITY_BASE, "utf8");

  it("creates community tables without RLS (remediated by HA-SECURITY-1B)", () => {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS community_cases/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS community_case_ratings/);
    assert.doesNotMatch(sql, /ENABLE ROW LEVEL SECURITY/);
  });
});

describe("community API service-role path (regression design)", () => {
  it("community routes use admin client not browser supabase", async () => {
    const routes = [
      "../src/app/api/community-cases/route.ts",
      "../src/app/api/community-cases/rate/route.ts",
      "../src/app/api/community-cases/detail/route.ts",
    ];
    for (const rel of routes) {
      const src = await fs.promises.readFile(new URL(rel, import.meta.url), "utf8");
      assert.match(src, /createSupabaseAdminClient/);
      assert.doesNotMatch(src, /createSupabaseAuthServerClient/);
    }
  });
});

describe("anonymous access blocked (design regression)", () => {
  it("satellite migration denies direct anon/authenticated grants", () => {
    const sql = fs.readFileSync(SATELLITE_RLS, "utf8");
    assert.equal((sql.match(/FROM anon, authenticated/g) ?? []).length >= 1, true);
    assert.doesNotMatch(sql, /TO anon/);
  });
});
