# Patient Journey Access Audit — Manual QA Checklist

Last updated: 2026-06-23  
Scope: dual-pathway patient funnel (pre-surgery / post-surgery), auth, uploads, waiting, report/PDF.

## Environment checklist (Vercel + Supabase)

### Vercel (HairAudit production / preview)

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public browser + server auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public browser auth only |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only — never expose to client |
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical origin for auth redirects (no path suffix) |
| `INNGEST_EVENT_KEY` | Yes | Case submit / report pipeline |
| `CONTRIBUTION_TOKEN_SECRET` | Prod | At least one render/token secret in production |

**Verify:** Server logs on boot should **not** show `[auth/env] missing required auth env vars`.

### Supabase Auth

- [ ] **Anonymous sign-in enabled** (required for friction-free `/api/audit/start`)
- [ ] Redirect URLs allowlisted:
  - `{NEXT_PUBLIC_APP_URL}/auth/callback`
  - `{NEXT_PUBLIC_APP_URL}/auth/recovery`
- [ ] Email confirmation settings match expected signup flow
- [ ] Preview/staging project uses matching `NEXT_PUBLIC_APP_URL` (not hardcoded production fallback)

### Supabase Storage

- [ ] `case-files` bucket exists and server upload routes succeed
- [ ] Patient PDF bucket/path used by report download is reachable after authz
- [ ] Migration `20260623120000_patient_core_table_rls.sql` applied on staging before production
- [ ] After RLS: patient can read own `cases` / `uploads` / `reports`; cannot read other patients
- [ ] Intelligence snapshot tables remain service-role only

### RLS apply / rollback

Staging apply: `supabase db push` (or run migration SQL in dashboard).

Rollback (emergency):

```sql
ALTER TABLE public.cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS case_files_select_participant ON storage.objects;
```

---

## 1. Public CTA test

- [ ] Homepage hero → `/request-review#choose-pathway` (no audit created yet)
- [ ] Header / footer / mobile menu CTAs → pathway chooser
- [ ] Legacy URLs forward correctly:
  - `/free-audit` → chooser with hash
  - `/start` → chooser with hash
  - `/patient/review` → chooser with hash
  - `/patient/dashboard` → `/dashboard/patient`
  - `/patient/login` → `/login?from=patient`
- [ ] `/demo-report` loads sample report (no auth)

## 2. Pathway chooser test

- [ ] Both **Pre-Surgery Review** and **Post-Surgery Audit** buttons visible
- [ ] Clicking either POSTs to `/api/audit/start` with explicit `pathway`
- [ ] Missing pathway on API returns 400 with patient-safe message
- [ ] Success navigates to `/cases/{id}/patient/photos`

## 3. Signup / login test

- [ ] `/signup?from=request-review` defaults to patient role
- [ ] Email/OAuth callback lands on `/dashboard/patient` (not auditor login)
- [ ] `/login?from=patient&next=/cases/{id}/patient/photos` returns to upload after sign-in
- [ ] Magic link and Google OAuth preserve `next` when provided
- [ ] Patient login never redirects to `/login/auditor`

## 4. Returning patient resume test

- [ ] Logged-in patient with incomplete photos → dashboard CTA → correct case photos page
- [ ] Incomplete questions → questions page
- [ ] Contact pending → contact page
- [ ] Processing → case hub waiting state
- [ ] Report ready → case page with delivered report
- [ ] No open case → pathway buttons (no silent case creation)

## 5. Upload test (desktop)

### Pre-surgery (5 required)

- [ ] `preop_front`, `preop_left`, `preop_right`, `preop_top`, `preop_donor_rear`
- [ ] Progress shows 5/5 when complete
- [ ] Optional/recommended slots do not block Continue
- [ ] Continue → questions page

### Post-surgery (5 required)

- [ ] `preop_front`, `current_recipient_closeup`, `preop_top`, `preop_donor_rear`, `preop_donor_closeup`
- [ ] Same completion / continue behaviour as pre-surgery

## 6. Mobile upload test

- [ ] File picker opens on iOS Safari / Android Chrome
- [ ] Upload progress and step lock behave on narrow viewport
- [ ] Continue button reachable without horizontal scroll

## 7. Waiting page test

- [ ] After submit, case hub shows processing timeline (no crash if intelligence pending)
- [ ] Status polling runs without 403 for case owner
- [ ] Auto-redirect when report becomes ready

## 8. Report / PDF test

- [ ] Patient sees patient-safe summary only (no forbidden terms: AI, Forensic, AuditOS, etc.)
- [ ] PDF download works with patient session (`/api/reports/.../download`)
- [ ] Patient cannot open another patient's report/PDF (403/404)
- [ ] Missing intelligence data shows fallback copy, not a blank crash

---

## Rollback notes

If patient funnel regresses after deploy:

1. **Revert** login redirect / middleware `x-pathname` changes first (highest touch).
2. Confirm **anonymous auth** still enabled in Supabase — disabling blocks all new free audits.
3. Confirm `NEXT_PUBLIC_APP_URL` matches deployed hostname (auth loops often trace here).
4. Legacy pathway-less cases still read as `post_surgery` — do not mass-migrate without ops review.

---

## Automated verification (CI / local)

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec tsx --test tests/patientJourneyAccess.test.ts
pnpm exec tsx --test tests/authRedirects.test.ts
pnpm exec tsx --test tests/patientEntryArchitecture.test.ts
pnpm exec tsx --test tests/guidedPatientUploadWizard.test.ts
pnpm exec tsx --test tests/patientReviewPathway.test.ts
pnpm run test:patient-rls
pnpm run test:e2e:live-journey
pnpm test:e2e:hairaudit
```

E2E requires Supabase admin env; skipped automatically when unset (see `tests/e2e/helpers/globalSetup.ts`).
