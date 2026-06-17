# HairAudit V2 — Phase 0 Security Hardening Plan

**Date:** 2026-06-17  
**Scope:** Security-only pass before FI OS convergence  
**Reference audit:** [hairaudit-ecosystem-convergence-audit.md](./hairaudit-ecosystem-convergence-audit.md)  
**Status:** Phase 0A implemented (safe fixes); Phase 0B deferred (high-risk migrations)

---

## Summary

Phase 0 closes critical application-layer vulnerabilities without changing product workflows. Database RLS, community API hardening, and middleware auth enforcement are documented for Phase 0B because they require staged migration and production validation.

---

## Remediation Matrix

### 1. Unauthenticated debug APIs

| Field | Detail |
|-------|--------|
| **Vulnerability** | Unauthenticated listing of cases and report metadata via service role |
| **Files** | `src/app/api/debug/cases/route.ts`, `src/app/api/debug/reports/route.ts` |
| **Risk** | **HIGH** — exposes forensic case/report metadata to anyone |
| **Current behaviour** | `GET` handlers call `createSupabaseAdminClient()` with no auth |
| **Required fix** | Block in production (404); require authenticated auditor in non-production |
| **Migration** | **Safe now** — implemented via `requireDevRouteAccess()` |
| **Verification** | `npm run test:security-phase0` — route guard tests; manual: `curl -i /api/debug/cases` returns 404 in production |

---

### 2. Unauthenticated audit seed/dev helpers

| Field | Detail |
|-------|--------|
| **Vulnerability** | Unauthenticated report seeding and answer mutation |
| **Files** | `src/app/api/audit/seed-answers/route.ts`, `src/app/api/audit/fill-minimum/route.ts`, `src/app/api/audit/save-answers/route.ts` |
| **Risk** | **HIGH** — arbitrary report row creation/update |
| **Current behaviour** | Service-role writes with no session check; `seed-answers` had public health-check `GET` |
| **Required fix** | Same guard as debug routes (`requireDevRouteAccess`) |
| **Migration** | **Safe now** — routes are dev-only helpers; production flows use `/api/patient-answers`, `/api/doctor-answers`, `/api/clinic-answers` |
| **Verification** | `npm run test:security-phase0`; grep routes for `requireDevRouteAccess` |

**Preserved:** `src/app/api/audit/save-manual/route.ts`, `src/app/api/audit/finalize/route.ts` — already auditor-gated.

---

### 3. Self-service doctor/clinic role escalation

| Field | Detail |
|-------|--------|
| **Vulnerability** | Any authenticated user can `POST /api/profiles` with `{ role: "doctor" }` or `{ role: "clinic" }` |
| **Files** | `src/app/api/profiles/route.ts`, policy: `src/lib/security/profileRolePolicy.ts` |
| **Risk** | **HIGH** — unauthorized access to doctor/clinic dashboards and case creation semantics |
| **Current behaviour** | Requested role applied directly (auditor had special case only) |
| **Required fix** | Allow doctor/clinic only on first profile upsert when `user.user_metadata.role` matches signup intent; reject escalation for existing profiles |
| **Migration** | **Safe now** — signup flow (`src/app/signup/page.tsx`, `src/app/auth/callback/route.ts`) already sets metadata role; legitimate onboarding preserved |
| **Verification** | `npm run test:security-phase0` — `resolveProfileUpsertRole` tests; manual: patient cannot POST `{ role: "doctor" }` after profile exists (403) |

---

### 4. Contribution token secret fallback to service role key

| Field | Detail |
|-------|--------|
| **Vulnerability** | Predictable token HMAC if `CONTRIBUTION_TOKEN_SECRET` unset |
| **Files** | `src/lib/transparency/contributionTokens.ts`, `src/lib/security/secrets.ts` |
| **Risk** | **MEDIUM** — contribution portal token forgery if env misconfigured |
| **Current behaviour** | Fallback chain: `CONTRIBUTION_TOKEN_SECRET` → `SUPABASE_SERVICE_ROLE_KEY` → hardcoded string |
| **Required fix** | Require dedicated secret in production; dev-only constant in non-production |
| **Migration** | **Safe now** — set `CONTRIBUTION_TOKEN_SECRET` in Vercel before deploy |
| **Verification** | `npm run test:security-phase0`; production startup logs via `validateAuthEnv.ts` |

---

### 5. Report render token secret fallback to service role key

| Field | Detail |
|-------|--------|
| **Vulnerability** | Render tokens signed with service role key when dedicated secret missing |
| **Files** | `src/app/api/print/report/route.ts`, `src/app/api/print/legacy-report/route.ts`, `src/app/reports/[caseId]/html/page.tsx`, `src/lib/reports/renderPdfInternal.ts`, `src/app/api/audit/finalize/route.ts`, `src/app/api/internal/build-pdf/route.ts` |
| **Risk** | **MEDIUM** — token forgery for Playwright PDF/HTML render paths |
| **Current behaviour** | Fallback chain included `SUPABASE_SERVICE_ROLE_KEY` |
| **Required fix** | Use `REPORT_RENDER_TOKEN` or `INTERNAL_API_KEY` only; never service role for signing |
| **Migration** | **Safe now** if `REPORT_RENDER_TOKEN` or `INTERNAL_API_KEY` already set in production (typical). Verify Vercel env before deploy. |
| **Verification** | `npm run test:security-phase0`; PDF pipeline smoke test in staging |

**Preserved:** Report HTML page still allows session-based access when no render token; Playwright path uses signed token.

---

### 6. Internal API key chains using service role

| Field | Detail |
|-------|--------|
| **Vulnerability** | Internal routes accept/propagate service role key as generic internal auth |
| **Files** | `src/app/api/internal/render-pdf/route.ts` (auth validation), `src/app/api/audit/finalize/route.ts`, `src/app/api/internal/build-pdf/route.ts` |
| **Risk** | **MEDIUM** — blurred boundary between DB admin key and route auth |
| **Current behaviour** | `SUPABASE_SERVICE_ROLE_KEY` in allowed-key lists for outbound and inbound internal calls |
| **Required fix (0A)** | Remove service role from outbound key resolution in finalize/build-pdf |
| **Required fix (0B)** | Remove service role from `isInternalAuthorized()` in render-pdf; rotate to dedicated `INTERNAL_API_KEY` |
| **Migration** | **0B done** — `src/lib/security/internalApiAuth.ts`; confirm `INTERNAL_API_KEY` in production |
| **Verification** | `npm run test:security-phase0b`; staging PDF generation |

---

### 7. Core tables lacking RLS (`cases`, `reports`, `uploads`)

| Field | Detail |
|-------|--------|
| **Vulnerability** | Direct Supabase anon/authenticated client access bypasses app-layer gates |
| **Files** | Supabase migrations (new), all routes using admin client |
| **Risk** | **HIGH** — defense-in-depth gap |
| **Current behaviour** | App-layer `canAccessCase`, signed-URL path gates; no Postgres RLS on core tables |
| **Required fix** | RLS policies mirroring case participant + auditor model |
| **Migration** | **Phase 0B — staged** — requires migration testing, anon key audit, possible client SDK usage review |
| **Verification** | Supabase policy tests; regression on upload/list/signed-url routes |

---

### 8. Community APIs without auth/RLS

| Field | Detail |
|-------|--------|
| **Vulnerability** | Unauthenticated case creation/rating |
| **Files** | `src/app/api/community-cases/route.ts`, `src/app/api/community-cases/rate/route.ts`, `src/app/api/community-cases/detail/route.ts` |
| **Risk** | **MEDIUM** — spam, DB bloat |
| **Required fix** | Rate limiting + optional auth + RLS on `community_cases`, `community_case_ratings` |
| **Migration** | **Phase 0B** — product decision on public vs authenticated submission |
| **Verification** | Load test + abuse simulation |

---

### 9. Middleware auth gaps

| Field | Detail |
|-------|--------|
| **Vulnerability** | New pages under `/dashboard` could be public if layout omitted |
| **Files** | `middleware.ts`, dashboard layouts |
| **Risk** | **MEDIUM** — accidental public exposure |
| **Current behaviour** | Layout-level gates; middleware passes all `/api/*` and most pages |
| **Required fix** | Explicit protected path patterns in middleware |
| **Migration** | **Phase 0B** — route inventory + regression on public marketing pages |
| **Verification** | Auth redirect tests extended for new paths |

---

### 10. Legacy direct upload bypass

| Field | Detail |
|-------|--------|
| **Vulnerability** | `src/app/cases/[caseId]/upload-panel.tsx` uploads directly to Supabase |
| **Files** | Orphan upload panel |
| **Risk** | **LOW** — bypasses server validation if re-wired |
| **Required fix** | Delete or disable component (Phase 2 upload consolidation) |
| **Migration** | **Deferred** — not wired in production nav |
| **Verification** | Grep for `upload-panel` imports |

---

### 11. Dev role cookie (`dev_role`)

| Field | Detail |
|-------|--------|
| **Vulnerability** | Development cookie can override role in case creation |
| **Files** | `src/lib/cases/createAuditCasePostHandler.server.ts`, `src/app/api/dev/set-role/route.ts` |
| **Risk** | **LOW** — only when `NODE_ENV=development` |
| **Current behaviour** | `set-role` already blocked outside development |
| **Required fix** | No change in 0A; document production check |
| **Migration** | **Safe** — already dev-only |
| **Verification** | `npm run test:create-case` — dev cookie ignored in production |

---

### 12. Auditor email override in production

| Field | Detail |
|-------|--------|
| **Vulnerability** | `ALLOW_AUDITOR_EMAIL_OVERRIDE=true` grants auditor access by email |
| **Files** | `src/lib/auth/isAuditor.ts` |
| **Risk** | **LOW–MEDIUM** if enabled in production |
| **Required fix** | Ensure `ALLOW_AUDITOR_EMAIL_OVERRIDE=false` in production; log error if true |
| **Migration** | **Safe now** — env validation warning added |
| **Verification** | Vercel env audit |

---

## Environment Variables (Production Required)

| Variable | Purpose | Phase |
|----------|---------|-------|
| `CONTRIBUTION_TOKEN_SECRET` | Contribution portal HMAC | **0A — required** |
| `REPORT_RENDER_TOKEN` or `INTERNAL_API_KEY` | PDF/HTML render tokens + internal calls | **0A — required** |
| `ALLOW_AUDITOR_EMAIL_OVERRIDE` | Must be `false` or unset | **0A — audit** |
| `SUPABASE_SERVICE_ROLE_KEY` | Server DB only — not for token signing | unchanged |

---

## Phase 0A Implementation (This Pass)

| Item | Status |
|------|--------|
| Gate `/api/debug/*` | Done |
| Gate `/api/audit/seed-answers`, `fill-minimum`, `save-answers` | Done |
| Profile role escalation policy | Done |
| Remove service-role token secret fallbacks | Done |
| Internal API key outbound chains (finalize, build-pdf) | Done |
| Production env validation warnings | Done |
| Tests: `tests/securityPhase0.test.ts` | Done |

---

## Phase 0B (Deferred — High Risk)

1. **RLS on `cases`, `reports`, `uploads`** — draft SQL in `docs/sql/hairaudit-phase-0b-rls-draft.sql`; inventory in `docs/hairaudit-v2-phase-0b-rls-access-inventory.md`; **not applied**
2. ~~**Remove `SUPABASE_SERVICE_ROLE_KEY` from `/api/internal/render-pdf` auth allowlist**~~ — **Done (0B)**
3. **Community API rate limiting + RLS** — payload guards added; edge rate limit + RLS Phase 1
4. **Middleware protected-route patterns**
5. **Delete `upload-panel.tsx` orphan**
6. **Rotate contribution tokens if legacy hashes used service role secret**

---

## Verification Commands

```bash
npm run typecheck
npm run lint
npm run test:security-phase0
npm run test:create-case
npm run test:upload-auth
npm run test:report-access
npm run test:auth-redirects
```

Note: There is no top-level `npm test` script. Use the scripts above individually.

---

## Migration Risks Before Deploy

1. **`CONTRIBUTION_TOKEN_SECRET`** — if unset in production, contribution links will fail at runtime. Set before deploy; existing hashed tokens must be reissued if secret changes.
2. **`REPORT_RENDER_TOKEN` / `INTERNAL_API_KEY`** — PDF pipeline requires at least one. Confirm Vercel env matches staging.
3. **Profile role policy** — users who escalated to doctor/clinic before this fix retain existing roles; new escalation blocked.

---

## Intentionally Preserved Behaviour

- Patient/doctor/clinic answer APIs (`/api/patient-answers`, etc.)
- All upload APIs with existing auth + path gates
- Auditor manual audit (`save-manual`, `finalize`)
- Inngest audit pipeline
- Report download and signed-URL TTLs
- Signup onboarding for doctor/clinic via metadata-matched first profile
- `/api/dev/set-role` in development only

---

*Phase 0A completed 2026-06-17.*
