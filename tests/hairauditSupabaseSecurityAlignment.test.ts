import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SECURITY_ALIGNMENT = path.join(
  process.cwd(),
  "supabase/migrations/20260702140000_hairaudit_remote_security_alignment.sql"
);
const UPLOAD_CORRECTIONS = path.join(
  process.cwd(),
  "supabase/migrations/20260322000001_upload_audit_corrections.sql"
);
const CORE_RLS = path.join(
  process.cwd(),
  "supabase/migrations/20260702120100_hairaudit_core_rls_hardening.sql"
);
const PATIENT_CORE_RLS = path.join(
  process.cwd(),
  "supabase/migrations/20260623120000_patient_core_table_rls.sql"
);

describe("HA-SECURITY-1 remote security alignment migration", () => {
  const sql = fs.readFileSync(SECURITY_ALIGNMENT, "utf8");

  it("enables RLS and auditor-only SELECT on upload_audit_corrections", () => {
    assert.match(sql, /upload_audit_corrections ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /upload_audit_corrections_select_auditor/);
    assert.match(sql, /TO authenticated/);
    assert.match(sql, /hairaudit_current_user_is_auditor\(\)/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.upload_audit_corrections FROM anon/);
    assert.match(sql, /GRANT ALL ON TABLE public\.upload_audit_corrections TO service_role/);
  });

  it("does not grant authenticated write on upload_audit_corrections", () => {
    assert.doesNotMatch(sql, /FOR INSERT[\s\S]*upload_audit_corrections/);
    assert.doesNotMatch(sql, /FOR UPDATE[\s\S]*upload_audit_corrections/);
    assert.doesNotMatch(sql, /FOR DELETE[\s\S]*upload_audit_corrections/);
  });

  it("revokes anon/public EXECUTE on all public SECURITY DEFINER functions", () => {
    assert.match(sql, /REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role/);
    assert.match(sql, /p\.prosecdef = true/);
  });

  it("sets doctor_case_audit_runtime to security_invoker", () => {
    assert.match(sql, /security_invoker = true/);
    assert.match(sql, /doctor_case_audit_runtime/);
  });

  it("narrows legacy public policies on core forensic tables to authenticated", () => {
    assert.match(sql, /tablename IN \('cases', 'uploads', 'reports', 'audit_photos'\)/);
    assert.match(sql, /ALTER POLICY %I ON public\.%I TO authenticated/);
  });

  it("documents intentional SECURITY DEFINER helper exceptions", () => {
    assert.match(sql, /COMMENT ON FUNCTION public\.hairaudit_current_user_is_auditor/);
    assert.match(sql, /COMMENT ON FUNCTION public\.hairaudit_user_can_access_case/);
    assert.match(sql, /COMMENT ON FUNCTION public\.surgery_upload_case_access/);
    assert.match(sql, /no anon RPC/);
  });
});

describe("upload_audit_corrections baseline migration", () => {
  const sql = fs.readFileSync(UPLOAD_CORRECTIONS, "utf8");

  it("creates table without RLS (remediated by HA-SECURITY-1)", () => {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS upload_audit_corrections/);
    assert.doesNotMatch(sql, /ENABLE ROW LEVEL SECURITY/);
  });
});

describe("core RLS hardening preserves participant boundaries", () => {
  const sql = fs.readFileSync(CORE_RLS, "utf8");

  it("includes patient, doctor, clinic, and auditor in case access helper", () => {
    assert.match(sql, /c\.patient_id = auth\.uid\(\)/);
    assert.match(sql, /c\.doctor_id = auth\.uid\(\)/);
    assert.match(sql, /c\.clinic_id = auth\.uid\(\)/);
    assert.match(sql, /hairaudit_current_user_is_auditor\(\)/);
  });

  it("scopes reports and uploads via case access", () => {
    assert.match(sql, /reports_select_via_case/);
    assert.match(sql, /uploads_select_via_case/);
    assert.match(sql, /hairaudit_user_can_access_case\(case_id\)/);
  });
});

describe("patient core RLS denies anon table access via authenticated-only policies", () => {
  const sql = fs.readFileSync(PATIENT_CORE_RLS, "utf8");

  it("restricts core SELECT policies to authenticated role", () => {
    assert.match(sql, /cases_select_participant[\s\S]*TO authenticated/);
    assert.match(sql, /uploads_select_via_case[\s\S]*TO authenticated/);
    assert.match(sql, /reports_select_via_case[\s\S]*TO authenticated/);
  });

  it("revokes intelligence snapshots from anon and authenticated", () => {
    assert.match(sql, /REVOKE ALL ON TABLE public\.hairaudit_intelligence_snapshots FROM anon, authenticated/);
  });
});

describe("anon cannot access patient data (design regression)", () => {
  it("security alignment blocks anon EXECUTE on RLS helpers used for case access", () => {
    const sql = fs.readFileSync(SECURITY_ALIGNMENT, "utf8");
    assert.match(sql, /hairaudit_user_can_access_case/);
    assert.match(sql, /FROM PUBLIC, anon/);
  });

  it("upload audit corrections remain auditor-only for authenticated reads", () => {
    const sql = fs.readFileSync(SECURITY_ALIGNMENT, "utf8");
    assert.match(sql, /upload_audit_corrections_select_auditor[\s\S]*hairaudit_current_user_is_auditor/);
  });
});

describe("authenticated non-owner isolation (design regression)", () => {
  it("case access helper requires membership or auditor role", () => {
    const patientSql = fs.readFileSync(PATIENT_CORE_RLS, "utf8");
    assert.match(patientSql, /c\.user_id = auth\.uid\(\)/);
    assert.match(patientSql, /OR public\.hairaudit_current_user_is_auditor\(\)/);
    assert.doesNotMatch(patientSql, /OR true/);
  });
});

describe("service role path preserved", () => {
  it("grants service_role on upload_audit_corrections and SECURITY DEFINER helpers", () => {
    const sql = fs.readFileSync(SECURITY_ALIGNMENT, "utf8");
    assert.match(sql, /GRANT ALL ON TABLE public\.upload_audit_corrections TO service_role/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role/);
  });
});
