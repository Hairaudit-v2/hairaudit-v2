# Supabase Migrations

HairAudit uses the Supabase CLI against project **HairAudit's Project**
(`vbzjkqhvzfunahmlxevb`).

## One-time CLI setup

```bash
# From repo root (CLI is a local devDependency)
npm run supabase:login
npm run supabase:link
```

`supabase init` already created `supabase/config.toml` (Postgres 17).
Project ref is pre-seeded in `supabase/.temp/project-ref` (gitignored).

## Day-to-day workflow

```bash
# Create a new migration file (preferred — do not invent timestamps by hand)
npx supabase migration new <descriptive_name>

# Compare local migration history vs remote
npm run supabase:migration:list

# Apply pending local migrations to the linked remote
npm run supabase:db:push
```

Prefer **local testing** (`npx supabase start` + migrate locally) before
`db push` to production when the change is non-trivial.

## History note

This database was partly migrated outside the CLI migration registry
(SQL Editor / MCP `apply_migration`). Schema is kept in sync with files under
`supabase/migrations/`, but remote history versions may not match every local
filename 1:1. Use `migration list` after linking to see the current gap, and
prefer CLI `db push` for all new changes going forward.

Snapshot of previously observed remote history:
`supabase/.remote-migrations.snapshot.json`.

## Manual fallback (SQL Editor)

Only if CLI link/push is unavailable: run the pending `.sql` files from
`supabase/migrations/` in version order in the Supabase SQL Editor.
