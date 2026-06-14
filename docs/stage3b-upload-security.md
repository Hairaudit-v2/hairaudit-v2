# Stage 3B: Patient upload / signed URL hardening

## Scope

- **No UI redesign**; optional `caseId` on `GET /api/uploads/signed-url` is backward compatible.
- **No schema changes**; **no** report pipeline or storage bucket layout changes.

## Modules

| Area | Location |
|------|-----------|
| Consolidated server gates | `src/lib/security/caseAccess.server.ts` |
| Case-scoped storage path rules + signed-url path gate | `src/lib/uploads/caseFilesPath.ts` (`gateUploadSignedUrlStoragePath`, `filterUploadRowsToCaseStorageNamespace`, `isWellFormedCaseId`) |
| Shared image validation entry for case-files POST routes | `src/lib/uploads/caseFilesRouteImageValidation.server.ts` |

## Routes

- **`GET /api/uploads/signed-url`** — Session required; path must be `cases/{uuid}/…` or `audit_photos/{uuid}/…`; optional `caseId` query must match path UUID; `requireCaseAccess` before signing.
- **`GET /api/uploads/list`** — Session + `requireCaseAccess`; well-formed `caseId`; only rows whose `storage_path` belongs to that case namespace are signed and returned.

## Case creation (review only)

- **Canonical:** `POST /api/cases/create` — primary HTTP entry.
- **Legacy:** `POST /cases/create` — thin wrapper; both call **`handlePostCreateAuditCaseRoute`** in `src/lib/cases/createAuditCasePostHandler.server.ts` (same status codes, JSON, and logging as Stage 3C).
- **Separate product path:** `POST /api/surgery-upload/cases` — own insert for surgery drafts (documented in code).

## Tests

Run: `pnpm test:upload-auth` (includes path gate, list filter, and `caseFilesPath` coverage).

## Remaining risks (Stage 3C follow-up)

- **Legacy `uploadId`-only signing** — removed with `route1.ts` deletion; canonical signing is path + session + `requireCaseAccess` (`route.ts` only).
- **End-to-end** signed-url/list tests still need a Next request context (cookies); sync gates are unit-tested instead.
- **Academy** uploads use a different storage prefix; they correctly keep using `fileValidation` directly.
