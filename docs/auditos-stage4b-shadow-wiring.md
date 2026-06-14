# AuditOS Stage 4B — Shadow wiring (read-only)

Stage 4B wires **AuditOS adapters** into the existing HairAudit audit pipeline as **shadow outputs only**. No stored scoring values, report payloads, PDFs, or patient/admin UI change unless optional debug surfaces are enabled.

## Where shadow build runs

| Location | When | What happens |
|----------|------|----------------|
| `src/lib/inngest/functions.ts` — step `insert-report-row` (success path) | Immediately after `reports` insert with `.select("id, created_at")` | `runAuditOsShadowAfterReportInsert` (`src/lib/auditos/shadow/inngestAuditOsShadow.server.ts`) builds `buildAuditOsShadowSnapshot`, runs `diffAuditOsShadowSnapshot`, optionally logs, then best-effort `emitAuditOsEvent("hairaudit.audit.completed", …)`. |
| `src/lib/inngest/functions.ts` — step `finalize-pdf-ready-phase` | After PDF path is stored and case marked `complete` | `emitAuditOsReportGeneratedSafe` loads the report row and emits `hairaudit.report.generated` when FI events are enabled. |

Nothing is written to new tables; the report `summary` JSON and insert shape are unchanged from Stage 4A behavior.

## Environment flags

| Variable | Effect |
|----------|--------|
| `HAIRAUDIT_AUDITOS_SHADOW_LOGS` | When `"true"`, shadow metrics and warnings are logged from Inngest (`logger.info`) after each successful report insert. |
| `NODE_ENV` | When `development` or `test`, shadow logs are also emitted automatically (unless you rely only on the explicit flag in production-like local runs). |
| `HAIRAUDIT_FI_EVENTS_ENABLED` | Must be `"true"` for `emitAuditOsEvent` to call the integration sink. Default / production without this flag: **no FI emission**. |
| `HAIRAUDIT_AUDITOS_DEBUG_PANEL` | When `"true"`, allows the **auditor-only** AuditOS shadow debug panel on the case page even in production. When unset, the panel only appears when `NODE_ENV !== "production"`. |

## What is logged

When shadow logging is active (`shouldLogAuditOsShadow` in `src/lib/auditos/shadow/auditOsShadowEnv.server.ts`):

- `diffStatus` (`ok` \| `warning`)
- `metrics` — structural parity counters (overall presence, domain counts, evidence item counts, rough section counts, confidence/limitations flags)
- `adapterVersions` — static adapter labels for traceability
- Combined `warnings` from snapshot build + diff

## What is not changed

- Deterministic scoring and persisted `reports.summary` content
- PDF generation and print routes
- Patient/clinic/doctor UI (except optional auditor debug JSON)
- Supabase schema (no new columns required for Stage 4B)
- Default FI behavior remains off until `HAIRAUDIT_FI_EVENTS_ENABLED=true`

## FI event payloads (minimal)

Allowed keys are enforced in `sanitizeAuditOsFiPayload` (`src/lib/auditos/events/emitAuditOsEvent.server.ts`): `case_id`, `report_id`, `report_version`, `pipeline_phase`, `event_schema`, `scoring_engine_version`, `scoring_version`, `evidence_manifest_version`, `generated_at`. Patient name, email, phone, and photo URLs are not allowlisted and are stripped.

## Enabling auditor debug

1. Sign in as an **auditor** and open `/cases/[caseId]`.
2. Ensure `NODE_ENV` is not `production`, **or** set `HAIRAUDIT_AUDITOS_DEBUG_PANEL=true`.
3. Expand **AuditOS shadow (internal)** below the rerun panel (only when a forensic report exists).

## Code map

- `src/lib/auditos/shadow/buildAuditOsShadowSnapshot.server.ts` — tolerant snapshot builder (per-adapter try/catch).
- `src/lib/auditos/shadow/diffAuditOsShadowSnapshot.ts` — structural parity diff (not clinical).
- `src/lib/auditos/shadow/inngestAuditOsShadow.server.ts` — Inngest wiring + FI emit wrappers.
- `src/components/auditor/AuditOsShadowDebugPanel.tsx` — gated auditor UI.

## Tests

- `pnpm test:auditos-stage4a` — Stage 4A boundaries + sanitizer smoke tests.
- `pnpm test:auditos-stage4b` — shadow partial success, adapter warnings, diff ok/warning, FI sanitizer, default no emission.

## Remaining risks

- **Structural diff heuristics** can false-positive `warning` when legacy summary shape drifts; tune thresholds in Stage 4D if noisy.
- **Inngest step payload size**: shadow logging only sends compact metrics, not full normalized objects.
- **Auditor debug** still runs adapter code server-side; keep gated in production unless explicitly enabled.

## Stage 4C (additive persistence)

Optional DB persistence of shadow rows is documented in `docs/auditos-stage4c-shadow-persistence.md` and gated by `HAIRAUDIT_AUDITOS_SHADOW_PERSIST_ENABLED=true`.
