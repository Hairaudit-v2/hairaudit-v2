# Stage 1B — Case creation consolidation

## Canonical path

- **`POST /api/cases/create`** — primary HTTP entry (used by `CreateCaseButton` and docs).
- **`src/lib/cases/createCase.ts`** — **`createAuditCase`** is the **only** place that inserts a row into `public.cases` for the standard patient/doctor/clinic audit flow (draft + `audit_type` / `submission_channel` / `visibility_scope` / participant linkage + post-insert `user_id` verification).
- **`POST /cases/create`** — legacy URL preserved; delegates to **`handlePostCreateAuditCaseRoute`** (`src/lib/cases/createAuditCasePostHandler.server.ts`), which authenticates, calls **`createAuditCase`**, and returns the same JSON shape and status codes as **`POST /api/cases/create`** (Stage 3C).

## Out of scope (unchanged)

- **`POST /api/surgery-upload/cases`** — still creates a `cases` row **and** a `surgery_upload_details` row; it intentionally mirrors insert *shape* but is not merged into `createCase.ts` to avoid coupling surgery defaults/rollback to the audit flow.

## Behaviour notes

- **Anonymous / invalid session:** both routes use the same handler → **401** with `{ ok: false, error: "Not authenticated" }` when there is no user, or **`Invalid session`** when `getUser` returns an auth error (same strings and status codes on both URLs).
- **Auditor:** **`createAuditCase`** returns **403** `{ ok: false, error: "Forbidden" }` so auditors cannot create orphan “patient-shaped” drafts via these endpoints (surgery upload and other tools keep their own flows).
- **Integration event:** after a successful verified insert, the service calls **`emitHairAuditEvent("hairaudit.case.created", …)`**, which remains a **no-op** unless `INTEGRATION_EVENTS_ENABLED=true` (see `src/lib/integrations/emit.ts`).
