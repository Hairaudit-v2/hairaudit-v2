# Retiring ALLOW_AUDITOR_EMAIL_OVERRIDE

The `ALLOW_AUDITOR_EMAIL_OVERRIDE` env var allows `auditor@hairaudit.com` to be treated as an auditor even when `profiles.role` is not set. Once all auditors have `profiles.role = 'auditor'`, you can retire this temporary dependency.

## Exact Steps to Disable

### 1. Verify all auditors have profile.role set

Run in Supabase SQL:

```sql
-- List users who should be auditors (by email or known IDs)
SELECT p.id, p.role, u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'auditor@hairaudit.com'
   OR p.role = 'auditor';
```

Ensure every auditor row has `role = 'auditor'`. If any are `patient` or `NULL`, update them:

```sql
UPDATE profiles
SET role = 'auditor', updated_at = NOW()
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'auditor@hairaudit.com'
);
```

### 2. Remove the env var

In your deployment environment (Vercel, .env.local, etc.):

- Delete `ALLOW_AUDITOR_EMAIL_OVERRIDE`
- Or set `ALLOW_AUDITOR_EMAIL_OVERRIDE=false` (optional; absence = disabled)

### 3. Redeploy

Deploy the app so the change takes effect.

### 4. Smoke test

1. Log out
2. Go to `/login/auditor`
3. Sign in as `auditor@hairaudit.com`
4. Confirm redirect to `/dashboard/auditor`
5. Open a case, perform a Graft Integrity action
6. Confirm success

If step 4 fails (redirect to wrong dashboard), the profile.role was not set correctly. Re-run step 1.

### 5. (Optional) Remove email fallback from code

Once retired and stable, you can remove the email override logic from `src/lib/auth/isAuditor.ts` to simplify the codebase. The helper will then rely solely on `profiles.role`.

## Rollback

If you disable the override and auditors cannot log in:

1. Set `ALLOW_AUDITOR_EMAIL_OVERRIDE=true` again
2. Redeploy
3. Fix profile.role for affected users (step 1)
4. Retry retirement when ready
