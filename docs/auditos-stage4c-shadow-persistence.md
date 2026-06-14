# AuditOS Stage 4C — Shadow snapshot persistence

Stage 4C adds **additive** storage for AuditOS shadow adapter output. Legacy `reports.summary` remains the only authoritative report payload for patients and PDFs.

## Migration summary

File: `supabase/migrations/20260615090000_hairaudit_auditos_shadow_snapshots.sql`

Table: `public.hairaudit_auditos_shadow_snapshots`

- **FKs:** `case_id → cases(id)` ON DELETE CASCADE; `report_id → reports(id)` ON DELETE CASCADE.
- **CHECK:** Automated kinds (`audit_completed`, `report_generated`) require non-null `report_id` and `report_version`; `manual_debug` is allowed without those constraints.
- **Dedupe:** Partial unique index on `(case_id, report_id, report_version, snapshot_kind)` for automated kinds so the app can upsert idempotently.
- **Indexes:** `(case_id, created_at DESC)`, partial on `report_id`, `snapshot_kind`, partial on `source_event_name`.
- **RLS:** Enabled with a **service_role-only** ALL policy. **No `GRANT` to `authenticated`** — auditors read via the server loader using the service role **after** an app-level auditor role check (same pattern as other internal diagnostics).
- **Trigger:** `updated_at` via `set_updated_at()` when that function exists.

## Environment flag

| Variable | Meaning |
|----------|---------|
| `HAIRAUDIT_AUDITOS_SHADOW_PERSIST_ENABLED` | Must be exactly `"true"` to write shadow rows from Inngest. **Default / production:** off. |

Logging remains controlled separately by `HAIRAUDIT_AUDITOS_SHADOW_LOGS` / non-production (Stage 4B).

## Persistence wiring points

| Hook | File | When |
|------|------|------|
| `audit_completed` | `src/lib/auditos/shadow/inngestAuditOsShadow.server.ts` → `maybePersistShadow` | After shadow build + optional log in `runAuditOsShadowAfterReportInsert` (called from `insert-report-row` in `src/lib/inngest/functions.ts`). |
| `report_generated` | Same module | After FI emit, when `shouldLogAuditOsShadow() \|\| isAuditOsShadowPersistEnabled()`, using `shadowContext` from finalize step (uploads + evidence manifest) to avoid extra queries when possible. |

`src/lib/auditos/shadow/persistAuditOsShadowSnapshot.server.ts`:

- Uses `tryCreateSupabaseAdminClient()` only (no user JWT writes).
- **Sanitization:** drops `rawLegacy` / `rawSummary`; re-sanitizes nested `normalized_report.scoring` and `normalized_report.evidenceManifest` (the adapter duplicates top-level blobs); nulls evidence `storagePath`; strips common PII keys from evidence item metadata; drops `patient_answers` / `patient_audit` keys from scoring `metadata` when present.
- **Idempotency:** `SELECT` by `(case_id, report_id, report_version, snapshot_kind)` then `UPDATE` or `INSERT` for automated kinds; `manual_debug` is insert-only (no unique index).

Failures return `{ ok: false }` and are logged from Inngest; they **do not** fail the audit job.

## What is stored

- Adapter version labels, normalized scoring / evidence / report JSON (sanitized), structural diff summary (`status`, `metrics`, truncated `warnings_preview`), full `warnings` text array (capped in sanitizer), `source_event_name`, timestamps.

## What is not stored

- Raw monolithic legacy summary as persisted authority (only derived normalized slices, without `rawSummary` / `rawLegacy`).
- Storage paths on evidence items (set to `null` in persisted JSON).
- No change to `reports` rows beyond existing Stage 4B behavior.

## Privacy boundaries

- Table has **no** patient/public RLS read policies; only service role in Postgres.
- Auditor UI uses `loadAuditOsShadowSnapshotsForAuditor` (`src/lib/auditos/shadow/loadAuditOsShadowSnapshots.server.ts`), which returns **only** when `resolvedRole === "auditor"` (server-side), then queries with service role.
- Do not add authenticated `SELECT` grants without an explicit security review.

## How auditors use it

- On `/cases/[caseId]` with the existing debug gate (`NODE_ENV !== "production"` or `HAIRAUDIT_AUDITOS_DEBUG_PANEL=true`), the **AuditOS shadow** panel lists recent persisted rows (kind, version, diff status, warning count, time) when any exist.
- Live adapter metrics remain in the collapsible JSON block.
- **Stage 4D:** Internal **AuditOS review** panel (structural comparison, evidence completeness, domain normalization) is documented in [`auditos-stage4d-auditor-review-tools.md`](./auditos-stage4d-auditor-review-tools.md) and is gated separately (see that doc).

## Rollback / disable strategy

1. Set `HAIRAUDIT_AUDITOS_SHADOW_PERSIST_ENABLED` unset or not `"true"` (immediate stop of new writes).
2. Optionally drop the table via a follow-up migration if you need to reclaim space (shadow data is non-authoritative).

## Tests

- `pnpm test:auditos-stage4c` — sanitizer, env default, service-role unavailable path, role gate, migration SQL contract.
- `pnpm test:auditos-stage4d` — Stage 4D review helpers, env gate, case-page wiring contract (see Stage 4D doc).

## Stage 4D pointer

See **[`auditos-stage4d-auditor-review-tools.md`](./auditos-stage4d-auditor-review-tools.md)** for persisted-snapshot review UI, env flags, and FI export readiness (design-only).

## Recommended Stage 4E

Additive **FI export readiness** workflow (internal review status, auditor mark ready/block, export-safe payload builder, no automatic FI export until explicitly enabled).
