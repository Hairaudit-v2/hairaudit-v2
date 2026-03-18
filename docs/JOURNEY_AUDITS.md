# HairAudit Journey Audits

Audit of patient, doctor, and clinic journeys with identified gaps and recommendations.

---

## 1. Patient Journey Audit

### Intended flow (as implemented)

| Step | Touchpoint | Route / behaviour |
|------|------------|-------------------|
| 1. Discover | Homepage, SEO, “Get Your Surgery Audited” | `/` → CTA to `/request-review` |
| 2. Learn | Request Review page | `/request-review` — value prop, privacy, “Continue to Secure Upload” → `/signup` |
| 3. Sign up | Signup | `/signup` — role “Patient (Beta)”, email/password; redirect to `/dashboard` after confirm |
| 4. Role routing | Dashboard router | `/dashboard` → `getEffectiveUserRole` → patient → `/dashboard/patient`; others → `/beta-access-message` if not doctor/clinic/auditor |
| 5. Patient dashboard | My cases + completion | `/dashboard/patient` — “Start New Audit” (→ `/cases` redirects to `/dashboard`), “Create new audit case” (API `POST /api/cases/create` → `/cases/{id}`) |
| 6. Create case | Create case | `CreateCaseButton` → `POST /api/cases/create` → redirect to `/cases/{caseId}` |
| 7. Case workspace | Single case view | `/cases/{caseId}` — patient sees: Continue Questions → `/cases/{id}/patient/questions`, Upload Evidence → `/cases/{id}/patient/photos`, Submit, Download Report |
| 8. Photos | Patient photo upload | `/cases/{caseId}/patient/photos` (also entry from `/cases/{caseId}/patient` which renders same upload UI) |
| 9. Questions | Patient intake | `/cases/{caseId}/patient/questions` — patient audit form (PATIENT_AUDIT_SECTIONS, required + advanced) |
| 10. Submit | Submit for audit | `SubmitButton` on case page; triggers submission → Inngest `runAudit` |
| 11. Post-submit | Processing / complete | Case status: submitted → processing → complete (or audit_failed). Report written to `reports`; PDF built via Inngest |
| 12. View report | Report access | Case page shows “Download Report” (PDF if `pdf_path`); HTML report at `/reports/{caseId}/html` (token/access checked) |
| 13. Optional | Invite clinic | `InviteClinicContributionCard` — patient can send contribution request to clinic/doctor (email + link `/contribute/{token}`) |

### Gaps and recommendations

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| 1 | **No “report ready” notification** | High | Patient is only notified on **audit failure** (`notifyPatientAuditFailed`). There is no email when the report completes successfully. Add a “Your HairAudit report is ready” email (with link to dashboard or report) after report generation completes in Inngest. |
| 2 | **Request Review sends patients to signup without context** | Medium | `/request-review` CTAs go to `/signup`. Users may not realise they need an account first. Consider a one-line note (“You’ll create a free account to submit securely”) or a short “Create account to continue” step before signup. |
| 3 | **“Start New Audit” / “View Previous Reports” point to `/cases`** | Medium | `/cases` redirects to `/dashboard`, so “Start New Audit” doesn’t start a new case; “View Previous Reports” doesn’t show a report list. Either link “Start New Audit” to a create-case action (or `/dashboard/patient` with prominent Create Case) and “View Previous Reports” to a filtered view (e.g. cases with status complete) or a dedicated “My reports” list. |
| 4 | **No clear “report ready” state on dashboard** | Medium | Patient dashboard shows case list and completion % but doesn’t prominently highlight “Report ready” or “View your report” for completed cases. Add a clear status or CTA for completed cases (e.g. “View report” / “Download PDF”) on the dashboard. |
| 5 | **Confusing dual entry to photos** | Low | Patient can reach photos via `/cases/{id}/patient` (which renders `PatientPhotoUpload`) or `/cases/{id}/patient/photos`. Ensure both paths show the same UI and that in-app links are consistent (e.g. “Upload photos” → `/cases/{id}/patient/photos`). |
| 6 | **Beta access and role clarity** | Low | If role is not patient/doctor/clinic/auditor, user hits `/beta-access-message` with no way to “switch” role. Signup already sets role; consider clarifying in beta message that they should sign up again with the correct role or contact support. |
| 7 | **No explicit “what to expect” after submit** | Low | Request Review lists steps but case page doesn’t restate “You’ll get an email when…” (especially once report-ready email exists). Add a short “What happens next” under Submit (e.g. “We’ll email you when your report is ready”). |

---

## 2. Doctor Journey Audit

### Intended flow (as implemented)

| Step | Touchpoint | Route / behaviour |
|------|------------|-------------------|
| 1. Discover | Homepage, Request Review, Professionals | `/`, `/request-review` (“Apply for Participation”), `/professionals/apply` |
| 2. Apply | Professional participation | `/professionals/apply` — mailto to auditor@hairaudit.com; no in-app form. Verified program link to `/verified-surgeon-program`. |
| 3. Sign up | Signup as doctor | `/signup` — role “Doctor (Beta)”; same email/password flow; after confirm → `/dashboard` → role → `/dashboard/doctor` |
| 4. Doctor dashboard | Cases list | `/dashboard/doctor` — “Doctor workspace”, Create Case (same `CreateCaseButton` → `/cases/{id}`), list of cases (doctor_id, clinic_id, or user_id). |
| 5. Case flow | Form then photos | For each case: Case page → “Continue Questions” → `/cases/{id}/doctor/form`, “Upload Evidence” → `/cases/{id}/doctor/photos`. Submit and Download Report on case page. |
| 6. Report visibility | Case page + PDF | Same case page and report PDF as patient; doctor sees doctor-specific summary and contribution paths. |
| 7. Sub-pages | Redirects | `/dashboard/doctor/upload`, `/dashboard/doctor/reports`, `/dashboard/doctor/defaults`, `/dashboard/doctor/public-profile`, `/dashboard/doctor/training` all redirect to `/dashboard/doctor`. No dedicated upload/reports/defaults/public-profile/training UI yet. |

### Gaps and recommendations

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| 1 | **No structured onboarding after signup** | High | Doctors land on dashboard with “Create case” only. There’s no onboarding checklist (e.g. “Complete profile”, “Add your first case”, “Understand scoring”). Add a short doctor onboarding flow or checklist (can mirror clinic onboarding pattern) and link from dashboard. |
| 2 | **Doctor/report defaults not exposed** | Medium | `dashboard/doctor/defaults` redirects to dashboard. If the product intent is “set default answers for future cases”, that UI is missing. Either implement defaults (and un-redirect) or remove the nav entry to avoid dead ends. |
| 3 | **Upload and Reports are placeholders** | Medium | `/dashboard/doctor/upload` and `/dashboard/doctor/reports` redirect to `/dashboard/doctor`. If doctors should have “bulk upload” or “all my reports” views, implement them; otherwise remove or repurpose these routes and any nav that points to them. |
| 4 | **Public profile and training not implemented** | Medium | `/dashboard/doctor/public-profile` and `/dashboard/doctor/training` redirect to dashboard. If doctors are to have a public profile (e.g. for leaderboards) or training content, add minimal pages or clearly label “Coming soon” instead of redirecting. |
| 5 | **No clear path from “Apply” to “Approved”** | Medium | Participation is via email. There’s no in-app status like “Participation pending” or “Approved – you can submit cases”. Consider a simple participation status (e.g. in profile or banner) and, if applicable, gating case creation until approved. |
| 6 | **Cases query is broad** | Low | Doctor dashboard loads cases where `doctor_id = user OR clinic_id = user OR user_id = user`. Ensure this matches product intent (e.g. “my cases” vs “cases I’m linked to”) and that doctors don’t see unintended cases. |
| 7 | **No doctor-specific report view** | Low | Doctor sees the same case/report page as others (with role-based sections). If you want a “doctor summary” view (e.g. for sharing with patients or for benchmarking), consider a dedicated view or export. |

---

## 3. Clinic Journey Audit

### Intended flow (as implemented)

| Step | Touchpoint | Route / behaviour |
|------|------------|-------------------|
| 1. Discover | Homepage, Request Review, Professionals | Same as doctor; “Apply for Participation” → `/professionals/apply` (mailto). |
| 2. Sign up | Signup as clinic | `/signup` — “Clinic (Beta)”; then `/dashboard` → `/dashboard/clinic`. |
| 3. Clinic profile | Auto-created | On first load, `clinic_profiles` row created/linked (`linked_user_id`, `clinic_email`). `clinic_portal_profiles` and capabilities loaded. |
| 4. Clinic dashboard | Overview | `/dashboard/clinic` — profile completion %, cases, onboarding steps, links to Profile, Workspaces, Submit Case, Onboarding. Sparkline (completions), transparency progress, badge widget, conversion panel. |
| 5. Onboarding | Guided steps | `/dashboard/clinic/onboarding` — steps: profile, clinical stack, workspaces, submit case, public profile. Links to profile builder, workspaces, etc. |
| 6. Profile | Clinic identity + stack | `/dashboard/clinic/profile` — basic/advanced profile, clinical stack (methods, devices). |
| 7. Workspaces | Patient-invited cases | `/dashboard/clinic/workspaces` — `clinic_case_workspaces` for cases where clinic was invited to contribute. |
| 8. Submit case | Internal submission | `/dashboard/clinic/submit-case` — submit a case as clinic (internal/benchmark path). |
| 9. Clinic cases | List of clinic cases | `/dashboard/clinic/clinic-cases` — cases where `clinic_id = user`. |
| 10. Contribution | Patient invite link | Patient sends contribution request → clinic/doctor get email with `/contribute/{token}`. `ContributionPortalForm` — clinic can submit form + photos; status and Inngest events drive lifecycle. |
| 11. Benchmarking / public | Benchmarking, leaderboards, badge | `/dashboard/clinic/benchmarking`, `/dashboard/clinic/public-preview`, `/dashboard/clinic/doctors`. Leaderboards: `/leaderboards/clinics`, `/leaderboards/doctors`. Public clinic page: `/clinics/[slug]`. |
| 12. Settings | Clinic settings | `/dashboard/clinic/settings`. |

### Gaps and recommendations

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| 1 | **Participation approval not visible in-app** | High | Like doctors, clinics apply via email. There’s no in-app “Participation status” or “Approved for submission”. Add a clear status (e.g. on dashboard or profile) and, if case submission is gated, enforce it and explain why when not approved. |
| 2 | **Workspace vs “my cases” can be confusing** | Medium | “Workspaces” = cases where the clinic was **invited** (patient contribution request). “Clinic cases” / case list = cases where clinic is `clinic_id`. Terminology and dashboard copy should distinguish “Cases you were invited to contribute to” vs “Cases you submitted” (and, if relevant, “Cases linked to your clinic”). |
| 3 | **Onboarding completion vs capability count** | Medium | Onboarding steps and “capability count” (e.g. clinical stack items) drive conversion prompts. Ensure the definition of “onboarding complete” and “profile complete” is consistent across dashboard, onboarding page, and any eligibility checks (e.g. for leaderboards/badges). |
| 4 | **Contribution request lifecycle clarity** | Medium | Clinic receives email with `/contribute/{token}`. If token is expired or already used, they see “Invalid contribution link”. Consider a clearer message (“This link has expired” vs “already used”) and, if possible, a way to request a new link from the patient or support. |
| 5 | **Doctor–clinic linkage** | Medium | Clinic has “doctors” (e.g. `/dashboard/clinic/doctors`). Ensure that when a clinic contributes to a case (via workspace or submit-case), the correct doctor/clinic association is stored and reflected in reports and leaderboards. |
| 6 | **Benchmarking visibility** | Low | Benchmarking and leaderboard eligibility depend on `benchmark_eligible_count`, `validated_case_count`, etc. Make sure the dashboard and benchmarking page explain what “benchmark eligible” and “validated” mean and what actions improve them. |
| 7 | **Public profile vs profile builder** | Low | “Prepare your public profile” and “Profile” (builder) are separate concepts. Ensure nav and onboarding steps don’t conflate “clinic profile data” with “public listing visibility” (e.g. `profile_visible`, slug). |

---

## Summary table

| Journey | High-severity gaps | Medium-severity gaps |
|---------|--------------------|----------------------|
| **Patient** | No “report ready” email | Request Review → signup context; “Start New Audit” / “View Previous Reports” links; report-ready prominence on dashboard |
| **Doctor** | No post-signup onboarding | Defaults/upload/reports/public-profile/training placeholders; no in-app participation status |
| **Clinic** | No in-app participation status | Workspace vs “my cases” clarity; onboarding/capability consistency; contribution link expiry messaging |

Recommend addressing high-severity items first (patient report-ready email, doctor onboarding, clinic/doctor participation status), then medium items for consistency and clarity across all three journeys.
