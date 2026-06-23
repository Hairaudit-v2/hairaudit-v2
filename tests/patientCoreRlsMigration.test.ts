import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260623120000_patient_core_table_rls.sql"
);

describe("patient core RLS migration", () => {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");

  it("enables RLS on cases, uploads, and reports", () => {
    assert.match(sql, /ALTER TABLE public\.cases ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /ALTER TABLE public\.uploads ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /ALTER TABLE public\.reports ENABLE ROW LEVEL SECURITY/);
  });

  it("defines participant case access helper", () => {
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.hairaudit_user_can_access_case/);
    assert.match(sql, /c\.user_id = auth\.uid\(\)/);
    assert.match(sql, /c\.patient_id = auth\.uid\(\)/);
  });

  it("does not grant authenticated write policies on core tables", () => {
    assert.doesNotMatch(sql, /FOR INSERT[\s\S]*ON public\.cases/);
    assert.doesNotMatch(sql, /FOR UPDATE[\s\S]*ON public\.uploads/);
    assert.doesNotMatch(sql, /FOR INSERT[\s\S]*ON public\.reports/);
  });

  it("restricts intelligence snapshots from anon/authenticated when tables exist", () => {
    assert.match(sql, /to_regclass\('public\.hairaudit_intelligence_snapshots'\)/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.hairaudit_intelligence_snapshots FROM anon, authenticated/);
    assert.match(sql, /to_regclass\('public\.hairaudit_auditos_shadow_snapshots'\)/);
  });

  it("adds case-files storage SELECT for participants only", () => {
    assert.match(sql, /case_files_select_participant ON storage\.objects/);
    assert.match(sql, /bucket_id = 'case-files'/);
    assert.match(sql, /hairaudit_storage_object_case_id/);
  });

  it("uses profiles.role for auditor checks (not user_metadata)", () => {
    assert.match(sql, /FROM public\.profiles p/);
    assert.match(sql, /p\.role = 'auditor'/);
    assert.doesNotMatch(sql, /user_metadata/);
  });
});
