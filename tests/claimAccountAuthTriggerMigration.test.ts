import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260714090000_hairaudit_anon_claim_auth_users_fix.sql"
);

describe("HA-PROD-CLAIM-ACCOUNT-INCIDENT-1A migration", () => {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");

  it("adds hairaudit_auth_email_in_use service_role probe", () => {
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.hairaudit_auth_email_in_use/);
    assert.match(sql, /FROM auth\.users u/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.hairaudit_auth_email_in_use\(text, uuid\) TO service_role/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.hairaudit_auth_email_in_use\(text, uuid\) FROM PUBLIC, anon, authenticated/);
  });

  it("hardens handle_beta_profile with SECURITY DEFINER, search_path, and UPSERT", () => {
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.handle_beta_profile\(\)/);
    assert.match(sql, /SECURITY DEFINER/);
    assert.match(sql, /SET search_path = public/);
    assert.match(sql, /ON CONFLICT \(id\) DO UPDATE/);
    assert.match(sql, /INSERT INTO public\.profiles/);
  });

  it("fires on INSERT and UPDATE of email/raw_user_meta_data", () => {
    assert.match(sql, /AFTER INSERT ON auth\.users/);
    assert.match(sql, /AFTER UPDATE OF email, raw_user_meta_data ON auth\.users/);
    assert.match(sql, /on_auth_user_updated_profile/);
  });

  it("grants EXECUTE to supabase_auth_admin after security revoke hardening", () => {
    assert.match(sql, /supabase_auth_admin/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.handle_beta_profile\(\)/);
  });

  it("preserves stranded incident uid (recovery clears probe email only)", () => {
    assert.match(sql, /d7698f54-5e0e-4ce4-9355-3910ece3ede1/);
    assert.match(sql, /@hairaudit\.test/);
    assert.match(sql, /is_anonymous = true/);
    assert.doesNotMatch(sql, /DELETE FROM public\.cases/);
    assert.doesNotMatch(sql, /DELETE FROM public\.uploads/);
    assert.doesNotMatch(sql, /DELETE FROM public\.audit_photos/);
  });
});
