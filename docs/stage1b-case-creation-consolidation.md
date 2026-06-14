# Stage 1B — Case creation consolidation

## Canonical path

- **`POST /api/cases/create`** — primary HTTP entry (used by `CreateCaseButton` and docs).
- **`src/lib/cases/createCase.ts`** — **`createAuditCase`** is the **only** place that inserts a row into `public.cases` for the standard patient/doctor/clinic audit flow (draft + `audit_type` / `submission_channel` / `visibility_scope` / participant linkage + post-insert `user_id` verification).
- **`POST /cases/create`** — legacy URL preserved; delegates to **`createAuditCase`** with the same cookies/session and returns the same JSON shape `{ ok, caseId? | error? }`.

## Out of scope (unchanged)

- **`POST /api/surgery-upload/cases`** — still creates a `cases` row **and** a `surgery_upload_details` row; it intentionally mirrors insert *shape* but is not merged into `createCase.ts` to avoid coupling surgery defaults/rollback to the audit flow.

## Behaviour notes

- **Anonymous:** both routes still require a Supabase session → **401** with `{ ok: false, error: "Not authenticated" }` on the legacy route (aligned with the API) and the API’s existing auth error strings unchanged where applicable.
- **Auditor:** **`createAuditCase`** returns **403** `{ ok: false, error: "Forbidden" }` so auditors cannot create orphan “patient-shaped” drafts via these endpoints (surgery upload and other tools keep their own flows).
- **Integration event:** after a successful verified insert, the service calls **`emitHairAuditEvent("hairaudit.case.created", …)`**, which remains a **no-op** unless `INTEGRATION_EVENTS_ENABLED=true` (see `src/lib/integrations/emit.ts`).
