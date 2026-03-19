# Auth redirect checklist

Use this checklist to avoid regressions in HairAudit auth flows (patient, clinic, doctor, auditor, recovery, callback, magic-link).

## Canonical host

- **Production:** Use **https** only. Set `NEXT_PUBLIC_APP_URL` to the canonical origin (e.g. `https://www.hairaudit.com`).
- **Enforcement:** `getCanonicalAppUrl()` in `src/lib/auth/redirects.ts` upgrades `http` → `https` when host includes `hairaudit.com`. All auth redirect URLs should be built with this helper.

## Required Supabase redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL:** Canonical https origin (e.g. `https://www.hairaudit.com`).
- **Redirect URLs** must include:
  - `https://www.hairaudit.com/auth/callback` (code exchange; OAuth + email confirmation)
  - `https://www.hairaudit.com/auth/magic-link` (magic link sign-in)
  - `https://www.hairaudit.com/auth/recovery` (password reset)

If these are missing, Supabase may send users to the Site URL (homepage) with `?code=...`; the app repairs that by redirecting `/?code=...` → `/auth/callback?code=...`.

## Role → destination mapping

| Role    | Post-auth destination   |
|---------|-------------------------|
| patient | `/dashboard` → `/dashboard/patient` |
| clinic  | `/dashboard/clinic`     |
| doctor  | `/dashboard/doctor`     |
| auditor | `/dashboard/auditor`   |
| (other) | `/dashboard`           |

Implemented in `dashboardPathForRole()` and in `/auth/callback` when `next` is missing (profile role is used).

## Callback vs recovery vs magic-link

| Flow              | Auth return route   | When used |
|-------------------|---------------------|-----------|
| **Callback**      | `/auth/callback`    | OAuth (Google), email signup confirmation, and when homepage receives `?code=...` (repair). Exchanges `code` for session; respects `next` or uses role-based path. |
| **Recovery**      | `/auth/recovery`    | Password reset. User sets new password then is redirected to `/login`. |
| **Magic-link**    | `/auth/magic-link`  | Email magic link sign-in. Sets session from hash, then redirects to `/dashboard` (which does role-based redirect). |

## Security

- **`next` parameter:** Only internal relative paths are allowed (starts with `/`, no `//`, no `:`). Implemented in `sanitizeNextPath()`; invalid values are ignored and role default is used.
- **Homepage auth repair:** Only `code`, `next`, and `signup_role` are forwarded from `/?code=...` to `/auth/callback`; no arbitrary query params.

## Automated regression tests

Run:

```bash
pnpm tsx --test tests/authRedirects.test.ts
```

Or add to CI:

```bash
pnpm test:auth-redirects
```

Tests cover: `sanitizeNextPath`, `dashboardPathForRole`, `getCanonicalAppUrl`, `getHomepageAuthRedirectTarget`, `/auth/callback` redirects (with/without `next`, invalid `next`, `signup_role`, and exchange failure).

## Manual QA (gaps)

- **E2E:** Full OAuth roundtrip (Google → callback → role dashboard) and email confirmation click-through are not automated; verify in staging.
- **Supabase config:** Redirect URL list in the dashboard is not tested by code; confirm after deploy.
- **Recovery:** End-to-end reset flow (email link → recovery page → new password → redirect to login) is best checked manually or via E2E.
