# HairAudit Deployment Guide

This guide walks you through deploying the **hairaudit-v2** Next.js app (the app you've been building) to the **hairaudit** Vercel project.

## Current Setup

| Folder | Type | Purpose |
|--------|------|---------|
| `g:\hairaudit` | Old Firebase/HTML | Original static site — **not used for deployment** |
| `g:\hairaudit-v2` | Next.js + Supabase | **This is the app that deploys** |

---

## Step 1: Ensure hairaudit-v2 is Your Deploy Source

The Vercel project `hairaudit-git-main-hairaudits-projects` must deploy from the **hairaudit-v2** codebase (Next.js), not the old hairaudit (Firebase) folder.

**If Vercel is connected to a GitHub/GitLab repo:**
- That repo must contain the **hairaudit-v2** Next.js code
- If it currently has the old hairaudit (Firebase) code, you need to replace it with hairaudit-v2

**If you haven’t pushed hairaudit-v2 to git yet:**
- Create a repo (e.g. `hairaudit` on GitHub)
- Push the contents of `g:\hairaudit-v2` to that repo
- Connect Vercel to that repo

---

## Step 2: Push hairaudit-v2 to the Correct Repo

From `g:\hairaudit-v2`:

```bash
cd g:\hairaudit-v2
git init
git add .
git commit -m "HairAudit Next.js app - Supabase, Inngest, B12 linking"
git remote add origin https://github.com/YOUR_USERNAME/hairaudit.git
git branch -M main
git push -u origin main
```

If the repo already exists and is connected to Vercel, just push:

```bash
git add .
git commit -m "Update: B12 linking, gold theme, AI audit"
git push origin main
```

> **Note:** If `git` isn’t in your PATH, use GitHub Desktop or another Git client, or install Git for Windows.

---

## Step 3: Point Vercel at the Right Project

1. Go to [vercel.com](https://vercel.com) and open your **hairaudit** project
2. **Settings** → **General**
3. Check **Root Directory**
   - Leave blank if the repo root is the Next.js app
   - If the repo has hairaudit-v2 in a subfolder, set: `hairaudit-v2`
4. **Build Command:** `npm run build`
5. **Output Directory:** `.next` (default)
6. **Install Command:** `npm install`

---

## Step 4: Add Environment Variables in Vercel

In Vercel → Project → **Settings** → **Environment Variables**, add:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key | Production |
| `OPENAI_API_KEY` | `sk-...` (optional, for AI audit) | Production |
| `CASE_FILES_BUCKET` | `case-files` | Production |
| `REPORT_RENDER_TOKEN` | A random secret string | Production |
| `RESEND_API_KEY` | Resend API key (for audit failure emails) | Production |
| `NOTIFICATION_FROM_EMAIL` | Verified sender email (e.g. `noreply@hairaudit.com`) | Production |
| `AUDITOR_NOTIFICATION_EMAIL` | Email for auditor alerts (default: `auditor@hairaudit.com`) | Production |
| `NEXT_PUBLIC_APP_URL` | App URL for email links (e.g. `https://hairaudit.com`) | Production |

---

## Step 5: Supabase Auth Redirect URLs

In Supabase → **Authentication** → **URL Configuration**:

- **Site URL:** `https://hairaudit-git-main-hairaudits-projects.vercel.app`
- **Redirect URLs:** Add:
  - `https://hairaudit-git-main-hairaudits-projects.vercel.app/**`
  - `https://hairaudit-git-main-hairaudits-projects.vercel.app/auth/callback`

---

## Step 6: B12 Site Buttons (link to hairaudit.com)

In the B12 editor, set the Submit / Login buttons to point to the HairAudit app:

- **Submit your case:** `https://hairaudit.com/signup`
- **Login:** `https://hairaudit.com/login`

Any "Get started" or "Sign up" CTA buttons should also link to `https://hairaudit.com/signup`.

---

## Step 7: Inngest (for AI audits in production)

1. Sign up at [inngest.com](https://www.inngest.com)
2. Add your app with the Vercel URL
3. Add to Vercel env vars:
   - `INNGEST_SIGNING_KEY` (from Inngest dashboard)
4. Redeploy so Inngest can call your `/api/inngest` endpoint

---

## Checklist

- [ ] hairaudit-v2 code pushed to the repo Vercel uses
- [ ] Vercel Root Directory correct
- [ ] Environment variables set in Vercel
- [ ] Supabase redirect URLs updated
- [ ] B12 buttons point to Vercel URLs
- [ ] Inngest configured (if using AI audit)
- [ ] Redeploy triggered

---

## If Vercel Currently Deploys the Old hairaudit Folder

If the connected repo has the old Firebase project:

1. Create a new branch or backup
2. Replace the repo contents with `g:\hairaudit-v2`
3. Push to `main`
4. Vercel will redeploy with the Next.js app

The old `g:\hairaudit` folder can stay locally as a backup.
