# Stage 1: Upload API hardening (list + signed-url)

## Behaviour changes

### `GET /api/uploads/signed-url`

- **Before:** Any caller could request a signed URL for any object path in the `case-files` bucket using the service role (no session).
- **After:** Requires a logged-in user, derives the `case_id` from the storage path (`cases/{uuid}/…`), runs the same **case access** check as the rest of the portal (`canAccessCase`), rejects path traversal / malformed paths, and only then uses the Supabase client (preferring **service role** when configured) to sign **that path**.

Response shape is unchanged: `{ url: string }` on success.

### `GET /api/uploads/list`

- **Before:** Anyone could list patient uploads and obtain signed thumbnail URLs for any `caseId`.
- **After:** Requires a logged-in user and **case access** for the requested `caseId` before querying `uploads` or signing storage objects.

The optional `prefix` query parameter is interpreted as an **upload `type` prefix** (a trailing `:` is added if missing). If omitted, it defaults to `patient_photo:` so existing UIs keep the same filtering. An explicit empty `prefix=` is treated as the default (not “all types”), so listing cannot be widened accidentally.

## Shared helpers

See `src/lib/auth/permissions.ts` (`requireUser`, `requireCaseAccess`, role-scoped helpers), `src/lib/uploads/caseFilesPath.ts` (path parsing / case namespace validation), and `src/lib/uploads/listTypePrefix.ts` (safe default for the list route `prefix` query).

## Auditor email fallback

`src/lib/auth/isAuditor.ts` no longer treats `auditor@hairaudit.com` as an auditor in production unless `ALLOW_AUDITOR_EMAIL_OVERRIDE=true` or `NODE_ENV=development`. See `docs/AUDITOR_EMAIL_OVERRIDE_RETIREMENT.md`.
