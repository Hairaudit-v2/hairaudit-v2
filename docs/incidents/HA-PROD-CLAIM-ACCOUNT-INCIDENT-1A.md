# HA-PROD-CLAIM-ACCOUNT-INCIDENT-1A

**Status:** Fix shipped in repo; production resolution requires migration apply + deploy + smoke.  
**Date:** 2026-07-14  
**Incident uid:** `d7698f54-5e0e-4ce4-9355-3910ece3ede1`  
**Case:** `b7ea67d0-2e72-470a-b682-939eb3653caf` (draft; photos/uploads preserved)

## Exact Postgres error

```
SQLSTATE 23505
duplicate key value violates unique constraint "users_email_partial_key"
Key (email)=(<patient email>) already exists.
```

GoTrue Admin `updateUserById` + `@supabase/supabase-js` surface this as:

```
code: unexpected_failure
message: Error updating user
```

Reproduced 2026-07-14 against project `vbzjkqhvzfunahmlxevb` with a second anonymous user claiming an already-registered email.

## Failing object

| Layer | Object | Role |
|-------|--------|------|
| Constraint | `auth.users` → `users_email_partial_key` | Direct cause of UPDATE abort |
| Trigger | `public.handle_beta_profile` (`on_auth_user_created` INSERT-only pre-fix) | Not the failure path; INSERT of anonymous users with null email already succeeded |
| App | `/api/audit/claim-account` | Misclassified opaque Auth error as HTTP 500 |

No custom UPDATE trigger was required to explain the failure. Constraint evidence supersedes the trigger hypothesis for this incident.

## Auth trigger audit (repo + intended prod post-migration)

| Trigger | Event | Function | SECURITY DEFINER | search_path | Writes | Anon/null→email |
|---------|-------|----------|------------------|-------------|---------|-----------------|
| `on_auth_user_created` | AFTER INSERT | `handle_beta_profile` | yes | `public` | `profiles` UPSERT | Inserts profile with null email |
| `on_auth_user_updated_profile` | AFTER UPDATE OF email, raw_user_meta_data | `handle_beta_profile` | yes | `public` | `profiles` UPSERT | Idempotent email/name sync |

Related hardening: `20260702140000` bulk-revoked EXECUTE on SECURITY DEFINER functions from `PUBLIC`/`anon`. Migration re-grants `supabase_auth_admin` EXECUTE on `handle_beta_profile`.

## Fix artifacts

- Migration: `supabase/migrations/20260714090000_hairaudit_anon_claim_auth_users_fix.sql`
- App: `src/lib/audit/claimAnonymousAccount.ts` + `src/app/api/audit/claim-account/route.ts`
- Tests: `tests/claimAnonymousAccount.test.ts`, `tests/claimAccountAuthTriggerMigration.test.ts`

## Affected date range

- **Confirmed failure:** 2026-07-14 ~08:39:41 AEST (2026-07-13 ~22:39:41 UTC)
- **Anonymous funnel exposure:** from friction-free claim rollout through deploy of this fix
- Inventory window used for stranded draft scan: **2026-06-01 → 2026-07-14**

## Stranded case inventory (2026-07-14 probe)

Draft patient cases with `patient_email IS NULL` owned by `is_anonymous` users: **14 owners / 15 cases** (includes demo-era junk from June).

Priority recovery:

| uid | case id(s) | notes |
|-----|------------|-------|
| `d7698f54-5e0e-4ce4-9355-3910ece3ede1` | `b7ea67d0-2e72-470a-b682-939eb3653caf` | Confirmed incident; 6 uploads/photos; migration clears diagnostic `@hairaudit.test` probe email only |
| `c2a2f40d-16a5-46c4-9ca4-89837e15e829` | two drafts 2026-07-13 | Still blank email — patient can retry claim |
| `3d891495-ee86-4a54-a80e-4461a456d1b2` | one draft | Has email on auth user but still `is_anonymous` + null `cases.patient_email` — complete claim/submit manually |

Do **not** delete patient cases, uploads, or auth uids.

## Recovery plan (no data deletion)

1. Apply migration `20260714090000_hairaudit_anon_claim_auth_users_fix.sql` to production.
2. Deploy app with claim-account conflict mapping + correlation ids.
3. For incident case `b7ea67d0-…`: after migration, session user is anonymous again (probe email cleared). Patient retries contact with a **non-registered** email, or signs in if they intended an existing account.
4. If the original email was already registered: instruct patient to sign in with that account, then staff attaches draft case ownership (`user_id`/`patient_id`) to the signed-in uid via service-role update — only after verifying identity out-of-band.
5. Re-scan draft/`is_anonymous` rows weekly until count stabilizes; prioritize post-2026-07-13 rows with photo uploads.

## Production smoke (required — not unit tests)

1. Start post-surgery audit (`/api/audit/start`)
2. Upload required photos
3. Complete questions
4. Contact → claim with **fresh** email → expect `ok: true`
5. Submit case → processing
6. Repeat claim with **already-registered** email on a new anon session → expect HTTP 409 `email_exists`, safe copy, correlationId in logs — **not** HTTP 500 `unexpected_failure`
