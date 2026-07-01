# HairAudit Supabase Security Audit (HA-SECURITY-1)

Project ref: `vbzjkqhvzfunahmlxevb` (HairAudit's Project)  
Audit date: 2026-07-02  
Issue: HA-SECURITY-1 — Remote security alignment

## Executive summary

The live Supabase project has **schema drift** relative to the repo: only **7** migrations are recorded remotely vs **75** local SQL files (including this remediation). A Supabase security advisor scan reported **12 ERROR**, **121 WARN**, and **6 INFO** findings.

This document records advisor results, migration drift, remediation decisions, safe deployment order, and verification steps. The remediation migration is:

`supabase/migrations/20260702140000_hairaudit_remote_security_alignment.sql`

---

## Advisor findings (baseline)

Captured via Supabase MCP `get_advisors` (type: `security`).

| Severity | Count | Representative issues |
|----------|-------|------------------------|
| ERROR | 12 | `upload_audit_corrections` RLS disabled; `doctor_case_audit_runtime` SECURITY DEFINER view |
| WARN | 121 | SECURITY DEFINER functions callable by `anon`/`authenticated` via PostgREST RPC; mutable `search_path` on legacy functions |
| INFO | 6 | RLS enabled but no policies (`case_events`, `job_runs`, `rubric_scores`, etc.) |

### Key findings and remediation

| Finding | Remote state (verified) | Remediation |
|---------|-------------------------|-------------|
| `upload_audit_corrections` no RLS | `rls_enabled=false`, `policy_count=0` | `20260702140000` enables RLS, auditor SELECT, service_role writes |
| `hairaudit_current_user_is_auditor()` anon EXECUTE | `anon` has EXECUTE | `20260702140000` revokes PUBLIC/anon on all public SECURITY DEFINER functions |
| `surgery_upload_case_access` / `surgery_upload_is_auditor` anon EXECUTE | `anon` has EXECUTE | Same bulk REVOKE/GRANT in `20260702140000` |
| `doctor_case_audit_runtime` SECURITY DEFINER view | View exists | `ALTER VIEW … SET (security_invoker = true)` |
| 67 anonymous-access policy lints | Legacy `{public}` policies on core tables | `20260702140000` narrows `{public}` → `authenticated` on cases/uploads/reports/audit_photos |
| Core RLS hardening not in migration history | Remote has mixed legacy + participant policies | Apply `20260702120100` before or with security batch (see order below) |

### Deferred (not in HA-SECURITY-1 migration)

- **Function search_path mutable** (121 WARN subset): legacy doctor portal / surgery upload triggers. Low immediate exploit risk when combined with EXECUTE revoke; track as HA-SECURITY-2 hardening.
- **RLS enabled, no policy** (INFO): internal/job tables (`job_runs`, `rubric_scores`). Product decision required before adding policies.
- **HLI / community tables** RLS disabled: separate product surfaces; not part of patient forensic core.
- **Academy functions with `check_uid` parameter**: anon RPC blocked by HA-SECURITY-1; authenticated UID-parameter probing remains — consider `check_uid = auth.uid()` guard in a follow-up.

### HA-SECURITY-1B — satellite table triage (2026-07-02)

All 10 remaining ERROR findings after HA-SECURITY-1A were **RLS disabled in public** on community and HLI tables. Remediated in `20260702150100_hairaudit_satellite_tables_rls_hardening.sql`.

#### Risk classification

| Table | Product surface | Pre-1B state | Risk | Decision |
|-------|-----------------|--------------|------|----------|
| `community_cases` | Rate My Hair Transplant | RLS off; anon full DML | **High** — public image/score data exposed via PostgREST | **Fix now** — service_role API only |
| `community_case_ratings` | Community ratings | RLS off; anon full DML | **High** — arbitrary rating injection | **Fix now** — service_role API only |
| `hli_longevity_profiles` | HLI Longevity | RLS off; PII columns | **Critical** — member PII | **Fix now** — service_role only |
| `hli_longevity_intakes` | HLI intake workflow | RLS off | **Critical** — health intake data | **Fix now** — service_role only |
| `hli_longevity_questionnaires` | HLI questionnaires | RLS off | **Critical** — questionnaire responses | **Fix now** — service_role only |
| `hli_longevity_documents` | HLI document metadata | RLS off | **Critical** — document paths/metadata | **Fix now** — service_role only |
| `hli_longevity_blood_requests` | HLI blood workflow | RLS off | **Critical** — clinical workflow | **Fix now** — service_role only |
| `hli_longevity_audit_events` | HLI audit trail | RLS off | **High** — audit events | **Fix now** — service_role only |
| `hli_entitlement_ledger` | HLI billing/entitlements | RLS off | **Critical** — Stripe/payment metadata | **Fix now** — service_role only |
| `hli_membership_included_zoom_consumptions` | HLI membership usage | RLS off | **High** — membership consumption | **Fix now** — service_role only |

**Requires product decision (future):** When HLI ships authenticated client access, add `profile_id = auth.uid()` (or mapped auth linkage) SELECT/INSERT policies in the HLI repo — not HairAudit core.

**Deferred:** None of the 10 ERROR items — all fixed with service_role-only RLS (no permissive anon/authenticated policies).

---

## Migration drift report

### Remote applied migrations (snapshot)

Source: Supabase MCP `list_migrations` on 2026-07-02. Snapshot file: `supabase/.remote-migrations.snapshot.json`.

| Version | Name |
|---------|------|
| 20260614203633 | 20260320000003_patient_safe_summary_narrative_translations |
| 20260617015504 | 20260320000004_patient_safe_summary_review_action_metadata |
| 20260617015505 | 20260604000007_surgery_upload_audit_handoff |
| 20260617015528 | 20260320000001_i18n_language_fields |
| 20260617015545 | 20260315000002_auditor_rerun_tracking |
| 20260617015546 | 20260316000001_external_ids_future_integration |
| 20260621011606 | patient_review_pathway |

**Note:** Remote version timestamps do not match local filenames — migrations were applied manually or via renamed versions. Compare by **migration stem/name**, not version prefix.

### Drift check command

```bash
pnpm check:migrations
```

Exit code `1` when local migrations exceed the remote snapshot (expected until remote is caught up).

---

## Security-focused pending migrations

Below: pending local files grouped by **security impact** and **safe deployment order**. Full pending list = all 74 local files minus the 7 remote names above (~67 pending).

### Tier 0 — Apply first (foundational roles & patient auth)

| Migration | Affected objects | Security impact |
|-----------|------------------|-----------------|
| `20250210000001_profiles_and_roles.sql` | `profiles`, signup trigger | Role model foundation |
| `20260309000001_beta_patient_only_auth.sql` | auth hooks | Patient-only signup guard |

### Tier 1 — Core forensic schema

| Migration | Affected objects | Security impact |
|-----------|------------------|-----------------|
| `20250225000001_patient_audit_v2.sql` | `cases`, patient audit | Core case model |
| `20250225000002_audit_photos_and_evidence.sql` | `audit_photos` | Evidence tables |
| `20260322000001_upload_audit_corrections.sql` | `upload_audit_corrections` | Creates table (**no RLS** — fixed by Tier 5) |

### Tier 2 — Auditor / doctor portals (SECURITY DEFINER views & functions)

| Migration | Affected objects | Security impact |
|-----------|------------------|-----------------|
| `20260314000001_doctor_portal_v2.sql` | `doctor_case_audit_runtime` view | SECURITY DEFINER view (fixed by Tier 5) |
| `20260313000003_auditor_operations_dashboard.sql` | auditor RPC functions | Dashboard RPC surface |
| `20260526120001_hair_audit_bulk_case_upload.sql` | `hair_audit_bulk_admin()` | SECURITY DEFINER admin predicate |

### Tier 3 — Surgery upload portal (SECURITY DEFINER helpers)

| Migration | Affected objects | Security impact |
|-----------|------------------|-----------------|
| `20260604000001_surgery_upload_portal.sql` | `surgery_upload_case_access()` | Case access helper |
| `20260604000006_surgery_upload_evidence_review.sql` | `surgery_upload_is_auditor()` | Auditor predicate |
| `20260604000006` … `20260605130000` (surgery upload stages) | surgery upload tables + RLS | Evidence workflow isolation |

### Tier 4 — Patient RLS hardening (critical)

| Migration | Affected objects | Security impact |
|-----------|------------------|-----------------|
| `20260623120000_patient_core_table_rls.sql` | `cases`, `uploads`, `reports`, `audit_photos`, storage | Participant + auditor SELECT; intelligence snapshot revoke |
| `20260702120100_hairaudit_core_rls_hardening.sql` | same core tables | Extends policies (insert/update/delete where intended); unified `hairaudit_user_can_access_case` |

### Tier 5 — HA-SECURITY-1 remediation (apply after Tier 4 helpers exist)

| Migration | Affected objects | Security impact |
|-----------|------------------|-----------------|
| `20260702140000_hairaudit_remote_security_alignment.sql` | `upload_audit_corrections`, all public SECURITY DEFINER functions, `doctor_case_audit_runtime`, core policy roles | Closes advisor ERRORs; blocks anon RPC |

### Recommended batch deploy to remote

For a **security-first** catch-up (minimal patient-boundary risk):

1. Ensure Tier 0–1 baseline exists (likely already on remote via manual DDL).
2. Apply **Tier 4** (`20260623120000`, then `20260702120100`) if not already effective.
3. Apply **Tier 5** (`20260702140000`).
4. Continue remaining feature migrations in filename order, validating RLS after each batch.

---

## upload_audit_corrections verification

| Environment | RLS | Policies | Writes |
|-------------|-----|----------|--------|
| **Local repo (pre-20260702140000)** | Not enabled in `20260322000001` | None | Service role via `/api/auditor/patient-uploads` |
| **Remote (2026-07-02)** | `false` | `0` | Service role (unrestricted table access) |
| **After HA-SECURITY-1** | `true` | `upload_audit_corrections_select_auditor` (authenticated auditors) | Service role only (no authenticated INSERT policy) |

### Remote verification SQL

```sql
SELECT c.relrowsecurity, (
  SELECT count(*) FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'upload_audit_corrections'
) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'upload_audit_corrections';
```

### RPC EXECUTE verification

```sql
SELECT p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'hairaudit_current_user_is_auditor',
    'hairaudit_user_can_access_case',
    'surgery_upload_case_access',
    'surgery_upload_is_auditor'
  );
```

Expected after remediation: `anon_execute = false`, `auth_execute = true`.

---

## Remediation decisions

1. **Do not weaken** patient / doctor / clinic / auditor / report boundaries — all changes restrict `anon` or add missing RLS.
2. **Service role preserved** — `GRANT ALL` on `upload_audit_corrections` and `GRANT EXECUTE … TO service_role` on helpers; server routes using admin client unchanged.
3. **Auditor API unchanged** — `/api/auditor/patient-uploads` uses service role; RLS adds defense-in-depth for direct PostgREST access.
4. **Bulk SECURITY DEFINER lockdown** — dynamic REVOKE over all `public` SECURITY DEFINER functions avoids missing a helper; re-grants `authenticated` + `service_role` for RLS policy evaluation.
5. **Legacy `{public}` policies** — narrowed to `authenticated` only where the sole role was `public` on core forensic tables; participant policies (`cases_select_participant`, etc.) unchanged.

---

## Verification commands (local)

```bash
# Migration drift
pnpm check:migrations

# HA-SECURITY-1 regression tests
pnpm test:security-supabase

# Broader patient RLS migration tests
pnpm test:patient-rls

# Typecheck (if TS touched)
pnpm typecheck
```

---

## Post-deploy advisor re-check

**Deployed to `vbzjkqhvzfunahmlxevb` on 2026-07-02** via Supabase MCP:

| Migration | Remote version |
|-----------|----------------|
| `patient_core_table_rls` | 20260701205452 |
| `hairaudit_core_rls_hardening` | 20260701205501 |
| `hairaudit_remote_security_alignment` | 20260701205508 |

### Verification results (live)

| Check | Before | After |
|-------|--------|-------|
| Advisor ERROR | 12 | **10** |
| Advisor WARN | 121 | **106** |
| `upload_audit_corrections` RLS | off | **on** (1 policy) |
| `anon` EXECUTE on RLS helpers | yes | **no** |

Resolved ERRORs: `upload_audit_corrections`, `doctor_case_audit_runtime`.  
Remaining ERRORs after 1A: HLI longevity tables + community tables.

### HA-SECURITY-1B deploy (2026-07-02)

| Migration | Remote version |
|-----------|----------------|
| `hairaudit_satellite_tables_rls_hardening` | 20260701205753 |

| Check | After 1A | After 1B |
|-------|----------|----------|
| Advisor ERROR | 10 | **0** |
| Advisor WARN | 106 | **106** |
| Satellite table RLS | off | **on** |
| `anon` SELECT on community/HLI | yes | **no** |
| `service_role` SELECT | yes | **yes** |

All 10 ERROR findings resolved. WARN count unchanged (SECURITY DEFINER search_path, anonymous policy lints on other tables — HA-SECURITY-2 scope).

**Expected INFO increase (+10):** satellite tables now show “RLS enabled, no policies” — intentional for service_role-only access (default deny for anon/authenticated).

After applying additional migrations to remote:

1. Supabase MCP: `get_advisors` with `project_id=vbzjkqhvzfunahmlxevb`, `type=security`
2. Confirm ERROR count drops (target: `upload_audit_corrections` and `doctor_case_audit_runtime` resolved)
3. Refresh `supabase/.remote-migrations.snapshot.json` from `list_migrations`
4. Re-run `pnpm check:migrations` after snapshot update

---

## Related files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260702150100_hairaudit_satellite_tables_rls_hardening.sql` | HA-SECURITY-1B satellite RLS |
| `supabase/migrations/20260702140000_hairaudit_remote_security_alignment.sql` | HA-SECURITY-1A remediation |
| `supabase/migrations/20260702120100_hairaudit_core_rls_hardening.sql` | Core table RLS |
| `supabase/migrations/20260623120000_patient_core_table_rls.sql` | Patient journey RLS |
| `tests/hairauditSatelliteTablesRls.test.ts` | HA-SECURITY-1B regression tests |
| `tests/hairauditSupabaseSecurityAlignment.test.ts` | HA-SECURITY-1A regression tests |
| `scripts/check-migrations.mjs` | Local vs remote drift checker |
