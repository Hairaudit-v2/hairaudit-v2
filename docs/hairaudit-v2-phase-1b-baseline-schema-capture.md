# HairAudit V2 — Phase 1B: Baseline Schema Capture

**Date:** 2026-06-17  
**Scope:** Capture and document current staging/production-compatible baseline DDL for `cases`, `reports`, and `uploads`  
**Prerequisite for:** Phase 0B RLS deployment (see `docs/sql/hairaudit-phase-0b-rls-draft.sql`)  
**Phase 1A Reference:** [docs/hairaudit-v2-phase-1a-schema-foundation.md](./hairaudit-v2-phase-1a-schema-foundation.md)  

---

## Executive Summary

Phase 1A confirmed that `cases`, `reports`, and `uploads` are **ALTER-only** in the repository—their `CREATE TABLE` DDL predates tracked migrations. Before RLS can safely be applied (Phase 0B draft), we must:

1. **Capture** the exact current schema from staging/production
2. **Document** the baseline in version control
3. **Generate** Supabase TypeScript types from the verified schema
4. **Prepare** the app for generated type adoption with a safe fallback bridge

**Do not apply the Phase 0B RLS draft until this checklist is complete.**

---

## Why Baseline DDL is Required Before RLS

Row Level Security policies reference table columns (e.g., `user_id`, `case_id`). Without knowing the exact column names, types, and nullability from the `CREATE TABLE` statement:

- Policies may reference columns that don't exist or have different names
- `WITH CHECK` clauses may fail on type mismatches
- Partial index definitions may be invalid
- Rollback becomes impossible without knowing the starting state

**Rule:** RLS migrations are only safe when the baseline schema is version-controlled.

---

## Phase 1B Checklist

| Step | Task | Artifact | Status |
|------|------|----------|--------|
| 1 | Dump staging schema | `docs/sql/hairaudit-core-forensic-baseline.sql` | ⬜ |
| 2 | Scrub secrets/owner metadata | Clean SQL file committed | ⬜ |
| 3 | Generate Supabase types | `src/lib/supabase/database.types.ts` | ⬜ |
| 4 | Verify type bridge | Tests pass with fallback types | ⬜ |
| 5 | Staging regression test | Full pipeline: create → submit → PDF | ⬜ |
| 6 | Update placeholder migration | Replace placeholder with verified DDL | ⬜ |
| 7 | Apply RLS draft | `hairaudit-phase-0b-rls-draft.sql` | ⬜ |

---

## Supabase CLI Commands for Schema Capture

### Prerequisites

```bash
# Authenticate with Supabase (opens browser)
npx supabase login

# Link to the staging project (project ref stored locally, not in repo)
npx supabase link
# Interactive prompt: enter your staging project reference
```

### Capture Core Tables Only

```bash
# Full schema dump (for reference only—do not commit raw)
npx supabase db dump --schema-only --data-only=false > /tmp/full_schema_$(date +%Y%m%d_%H%M%S).sql

# Isolate cases, reports, uploads for review
grep -A 100 "CREATE TABLE public.cases" /tmp/full_schema_*.sql > /tmp/cases_baseline.sql
grep -A 50 "CREATE TABLE public.reports" /tmp/full_schema_*.sql > /tmp/reports_baseline.sql
grep -A 50 "CREATE TABLE public.uploads" /tmp/full_schema_*.sql > /tmp/uploads_baseline.sql
```

### Manual pg_dump Alternative (if CLI unavailable)

```bash
# Requires SUPABASE_DB_URL from staging settings (not committed)
pg_dump \
  --schema-only \
  --table='public.cases' \
  --table='public.reports' \
  --table='public.uploads' \
  --no-owner \
  --no-privileges \
  --no-security-labels \
  --no-tablespaces \
  --no-comments \
  "$SUPABASE_DB_URL" > docs/sql/hairaudit-core-forensic-baseline-raw.sql
```

---

## Safe pg_dump Options Explained

| Flag | Purpose |
|------|---------|
| `--schema-only` | No data, only DDL |
| `--no-owner` | Removes `OWNER TO` clauses (different in staging vs prod) |
| `--no-privileges` | No `GRANT`/`REVOKE` (app-layer auth) |
| `--no-security-labels` | No provider-specific security labels |
| `--no-tablespaces` | No tablespace references (platform-specific) |
| `--no-comments` | Optional: remove comments if they contain env hints |

**Post-processing required:**
- Remove any `SET` statements that reference session variables
- Scrub project-specific defaults or storage references
- Verify no `CREATE EXTENSION` if already in migrations

---

## Schema Scrubbing Checklist

Before committing the baseline SQL:

- [ ] No `OWNER TO` statements
- [ ] No hardcoded project refs or connection strings
- [ ] No storage bucket paths that might differ across envs
- [ ] Default expressions use stable functions only (no `now()` in CHECK constraints)
- [ ] All `ALTER TABLE ... OWNER TO` removed
- [ ] No `SET search_path` that might leak internal schema names
- [ ] Indexes verified against Phase 1A inferred columns

---

## Review Checklist Before Committing Migration

### Structural Review

- [ ] Columns match Phase 1A inferred schema in `tableTypes.ts`
- [ ] Primary keys: `cases.id`, `reports.id`, `uploads.id`
- [ ] Foreign keys: `reports.case_id → cases.id`, `uploads.case_id → cases.id`
- [ ] Indexes on `cases.user_id`, `cases.patient_id`, `cases.status`
- [ ] Indexes on `reports.case_id`, `reports.status`
- [ ] Indexes on `uploads.case_id`, `uploads.type`

### Type Safety Review

- [ ] `cases.status` is `TEXT` (not ENUM—app-enforced via `statusCatalog.ts`)
- [ ] `reports.summary` is `JSONB`
- [ ] `uploads.metadata` is `JSONB`
- [ ] `created_at` defaults to `now()`
- [ ] `uuid` types for all IDs (not `text`)

### RLS Readiness Review

- [ ] `cases.user_id`, `patient_id`, `doctor_id`, `clinic_id` exist and are `uuid` type
- [ ] `reports.case_id` exists and is `uuid` type
- [ ] `uploads.case_id` exists and is `uuid` type
- [ ] No columns renamed from assumptions in `hairaudit-phase-0b-rls-draft.sql`

---

## Rollback Plan

If the baseline migration causes issues:

1. **Do not revert the migration file** (migrations must be forward-only)
2. Create a corrective migration: `YYYYMMDDHHMMSS_fix_baseline_issue.sql`
3. Issues requiring correction:
   - Missing column → `ALTER TABLE ADD COLUMN`
   - Wrong type → `ALTER TABLE ALTER COLUMN` (if data compatible)
   - Missing index → `CREATE INDEX CONCURRENTLY` (in separate migration)

**Emergency RLS disable:**
```sql
-- Only if production RLS causes access issues
ALTER TABLE public.cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads DISABLE ROW LEVEL SECURITY;
```

---

## Generated Type Workflow

### Environment Variables

The type generation script supports two modes:

**Mode 1: Linked Project (Recommended)**
```bash
# One-time setup (not stored in repo)
npx supabase login
npx supabase link  # provide staging project ref

# Generate anytime
npm run gen:supabase-types
```

**Mode 2: Explicit Credentials (CI/one-off)**
```bash
SUPABASE_ACCESS_TOKEN=<your-personal-access-token> \
SUPABASE_PROJECT_REF=<staging-project-ref> \
npm run gen:supabase-types
```

### Output Location

```
src/lib/supabase/database.types.ts
```

**Important:** This file is auto-generated. Do not edit manually.

### Type Generation Blockers

If generation fails, the script will print:
- Missing authentication instructions
- Link to Phase 1A documentation
- Fallback: use `src/lib/hairaudit/tableTypes.ts` (partial manual types)

### After Generation

1. Review the generated `Database` type for completeness
2. Run `npm run typecheck` to verify no conflicts
3. Run `npm run test:schema-phase1a` to ensure catalog consistency
4. Commit `database.types.ts` with a clear message:
   ```
   feat(schema): generate Supabase types from staging baseline

   Generated after Phase 1B baseline DDL capture.
   Refs: hairaudit-v2-phase-1b-baseline-schema-capture.md
   ```

---

## Type Adapter Bridge Pattern

Until all imports migrate to `database.types.ts`, use the bridge:

```typescript
// src/lib/hairaudit/generatedTypeBridge.ts
import type {
  CaseRow as FallbackCaseRow,
  ReportRow as FallbackReportRow,
  UploadRow as FallbackUploadRow,
} from './tableTypes';

// Conditional type that uses generated types when available
// Falls back to tableTypes.ts when database.types.ts not generated
export type GeneratedCaseRow = FallbackCaseRow;
export type GeneratedReportRow = FallbackReportRow;
export type GeneratedUploadRow = FallbackUploadRow;
```

**Migration path:**
1. Generate `database.types.ts` (Phase 1B complete)
2. Update bridge to import from `database.types.ts`
3. Incrementally replace `CaseRow` → `Database['public']['Tables']['cases']['Row']`
4. Remove bridge when all references updated

---

## Next Manual Commands

After completing this Phase 1B documentation:

```bash
# 1. Authenticate and link staging
npx supabase login
npx supabase link

# 2. Dump and review core tables
npx supabase db dump --schema-only > /tmp/staging_schema.sql
head -n 200 /tmp/staging_schema.sql  # review

# 3. Generate types
npm run gen:supabase-types

# 4. Verify everything works
npm run typecheck
npm run test:schema-phase1a

# 5. Staging regression (manual)
# - Create case → Upload photos → Submit → Verify PDF generated
```

---

## Recommended Phase 1C

After baseline DDL is captured and types are generated:

| Phase | Work |
|-------|------|
| **1C** | Replace `tableTypes.ts` fallbacks with generated types incrementally |
| **1C** | Add DB CHECK constraints on `cases.status` using frozen `CASE_STATUSES` catalog |
| **1C** | Document `doctor_cases` vs `cases` parallel model boundaries |
| **1C** | Community RLS product decision + edge rate limits |

---

## Related Files

| File | Purpose |
|------|---------|
| `docs/sql/hairaudit-phase-0b-rls-draft.sql` | RLS policies waiting for this baseline |
| `docs/sql/hairaudit-core-forensic-baseline-placeholder.sql` | Placeholder for verified DDL |
| `src/lib/hairaudit/tableTypes.ts` | Fallback types until generation complete |
| `src/lib/hairaudit/generatedTypeBridge.ts` | Adapter between fallback and generated |
| `src/lib/hairaudit/statusCatalog.ts` | Status enums that must match baseline |
| `src/lib/hairaudit/schemaRegistry.ts` | Table inventory and validation |
| `scripts/gen-supabase-types.mjs` | Type generation script |

---

*Phase 1B guide prepared for HairAudit V2 schema foundation. Do not apply RLS until this checklist is complete.*
