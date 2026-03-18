# UX consistency pass (post–recent fixes)

Summary of the consistency audit and repairs across patient, doctor, and clinic journeys.

## Repairs made

### 1. Redirect consistency (clinic)
- **Clinic → Doctors page:** When no clinic profile exists, the app now redirects to `/dashboard/clinic` instead of `/dashboard`, so clinic users stay in the clinic area and behaviour matches other clinic pages (profile, onboarding, etc.).

### 2. Status labels (case page aligned with patient dashboard)
- **Case page status pill:** Uses the same user-facing labels as the patient dashboard:
  - **Report Ready** — when case is complete and a report PDF exists (same emerald styling as dashboard).
  - **Processing** — when status is `submitted` or `processing`.
  - **Complete** — when complete but no PDF yet.
  - **Audit failed** — when status is `audit_failed`.
  - Other raw statuses are shown with underscores replaced by spaces.
- Avoids confusion between case page and “My audit requests” on the patient dashboard.

### 3. CTA label consistency (case page)
- **Upload CTA:** For the patient flow, the main case workspace now shows **“Upload Photos”** (matching the patient dashboard) instead of “Upload Evidence”. Doctor/clinic flows still use “Upload Evidence”.

## What was checked (no changes)

- **Patient dashboard:** Start New Audit (CreateCaseButton), Upload Photos, Complete Intake Questions, View Previous Reports all point to valid routes; no `/cases` dead links.
- **Patient reports page:** “Previous reports” title and “Back to dashboard” / “Go to dashboard” are consistent with dashboard wording.
- **Doctor dashboard:** Onboarding steps use CreateCaseButton for “Create your first case”; other steps link to `/cases/[id]/doctor/photos`, `/cases/[id]`, `/leaderboards/doctors`. No empty or broken links.
- **Clinic dashboard:** Links to profile, workspaces, submit-case, leaderboards, and case pages are valid.
- **Case page:** `uploadEntryPath` and `continuePath` resolve to the canonical patient/doctor/clinic routes; no redirect loops.
- **Submission flow:** Submit button and “What happens next” panel unchanged; no duplicate or conflicting CTAs.

## Intentional “coming soon” / placeholder areas

- **Doctor dashboard**
  - **Reports** (`/dashboard/doctor/reports`): “A single place to see all your audit reports and pending actions is coming soon. For now, open any case from your overview to view its report and resolve feedback.”
  - **Public profile** (`/dashboard/doctor/public-profile`): “Profile and visibility settings for how you appear on leaderboards and in the directory are coming soon. Your submitted cases already contribute to benchmarking.”
- **Clinic dashboard**
  - **Benchmarking** (`/dashboard/clinic/benchmarking`), **Training** (`/dashboard/clinic/training`), **Settings** (`/dashboard/clinic/settings`): Use `PortalPlaceholderPanel`; nav items are marked `placeholder: true` so the UI can treat them as coming soon.

These are intentional and do not imply broken or half-implemented flows; they set clear expectations.

## Typecheck

`pnpm exec tsc --noEmit` passes with no errors.
