# i18n audit: remaining hardcoded user-facing strings

**Scope:** authenticated dashboards, portals, onboarding, empty states, global chrome (excluding reports, PDFs, APIs, emails, surgical/AI copy).  
**Status:** living document; batches ship incrementally.

## Legend

| Tag | Meaning |
|-----|---------|
| **safe now** | Small surface, client-friendly or thin wrapper; low regression risk |
| **later** | Valuable but larger refactors, server components, or many strings |
| **avoid for now** | Legal/SEO copy blocks, emails, admin/dev tools, dynamic data |

---

## Global / marketing shell (unauthenticated pages)

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `SiteFooter.tsx` | Column headings, link labels, descriptions | **done (batch 4)** | Client + `nav.footer.*` |
| `BetaBanner.tsx` | Beta disclaimer paragraph | **done (batch 4)** | `nav.betaBanner.*` |
| `app/layout.tsx` | Skip link text | **done (batch 3)** | `SkipLinkI18n` + `nav.skipToMain` |
| `app/page.tsx` (home) | Hero, CTAs, sections | **done (batch 7)** | `HomePageMarketing` + `marketing.home.*`; server page keeps metadata / auth redirect |
| `how-it-works/page.tsx` | Marketing flow | **done (batch 7)** | `HowItWorksMarketing` + `marketing.howItWorks.*` |
| `professionals/page.tsx` + hub cards | Index title, cards | **done (batch 7)** | `ProfessionalsHub` + `marketing.professionals.*` |
| `ProfessionalsShell.tsx` | Sidebar + footer links | **done (batch 7)** | Same namespace; subpages still pass English article `title` / `intro` |
| `sample-report/page.tsx` | Page chrome (hero, sections, labels) | **done (batch 7)** | `SampleReportMarketing` + `marketing.sampleReport.*`; sample finding paragraphs / reco bullets stay English |
| `ReviewProcessReassurance.tsx` | Post-submit reassurance | **done (batch 7)** | `marketing.shared.*` |
| `CertifiedClinicsSection.tsx` | Cert teaser section | **done (batch 7)** | `marketing.home.certified*` |

---

## Authenticated dashboard shell

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `DashboardHeader.tsx` | "Dev: Switch role" | **avoid for now** | Dev-only |
| `SignOutButton.tsx` | "Sign out" | **done (batch 2)** | `dashboard.shared.signOut` |
| `app/dashboard/layout.tsx` | (no copy) | — | — |

---

## Doctor portal (`/dashboard/doctor/*`)

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `doctor/layout.tsx` | "Overview", "Onboarding" pills | **done (batch 2)** | `DoctorDashboardSubnav.tsx` + `pageNav*` keys |
| `DoctorDashboardProduction.tsx` | "Untitled case", status labels | **later** | Data-adjacent; keep English or future `common.*` |
| `DoctorOnboardingChecklist.tsx` | Title, subtitle, "Why this matters" | **done (batch 2)** | `checklist*` / `whyMatters*` keys |
| `DoctorOnboardingForm.tsx`, `doctor/onboarding/page.tsx` | Form labels | **done (batch 11)** | `dashboard.doctor.forms.*`, `forms.shared.*` |
| `DoctorParticipationSummaryCard.tsx` | Card copy | **later** | — |
| `DoctorComingSoon.tsx`, placeholder doctor routes | Coming-soon panels | **done (batch 5)** | `dashboard.doctor.placeholders.*`, `comingSoonEyebrow`, `placeholderBackToOverview` |
| `PortalPlaceholderPanel`, clinic settings/benchmarking/training | Placeholder pages | **done (batch 5)** | `dashboard.clinic.placeholders.*`, shared badge |

---

## Clinic portal (`/dashboard/clinic/*`)

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `clinic/layout.tsx` | `navItems` labels (Overview, Onboarding, …) | **later** | Server layout; needs client nav or message passing |
| `ClinicSidebarNav.tsx` | "Soon", portal chrome, mobile toggle | **done (batch 3)** | `comingSoon`, `sidebar*`, `open/closePortalNav` |
| `ClinicPortalShell`, `ClinicNextActionCard`, status chips | Dynamic strings from layout | **later** | Fed from server; refactor with care |
| `clinic/page.tsx` & feature panels | Large amount of marketing/ops copy | **later** | High volume |
| `ClinicProfileBuilder.tsx` | Basic/advanced profile fields, stack catalog, messages | **done (batch 11)** | `dashboard.clinic.forms.profileBuilder.*`; stored select **values** stay English; **labels** localized for display |
| `ClinicConversionPanel.tsx` | Eyebrow, readiness chip, details toggle, default teaser CTA | **done (batch 11)** | `dashboard.clinic.forms.conversionPanel.*`; parent **title/subtitle/actions** still passed as before |

---

## Patient portal (`/dashboard/patient/*`)

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `patient/page.tsx` | Data fetching, orchestration | — | Heavy UI moved to `components/patient/PatientDashboard*` clients (**batch 6A**) |
| `PatientDashboardCompletionCard`, `UnlockSection`, `WhyMattersSection`, `CaseHistorySection`, `GraftIntegrityRolloutNotice` | Dashboard sections | **done (batch 6A)** | `dashboard.patient.completion`, `unlock`, `whyMatters`, `caseHistory`, `graftIntegrity.rollout*` |
| `PatientNextActionPanel` | Next-action states | **done (batch 6A)** | `dashboard.patient.nextAction*`, `dashboard.reports.shareHint`, `viewReport`, `downloadPdf` |
| `GraftIntegrityCard` | Card chrome, empty/loading, static disclaimers | **done (batch 6A)** | `graftIntegrity.*`; API-fed text (`ai_notes`, limitations) unchanged |
| `DeleteDraftCaseButton` | Confirm, labels | **done (batch 6A)** | `dashboard.patient.deleteDraft.*` |
| `PatientReportsCompletedCaseList` | Completed-case list chrome | **done (batch 6A)** | `dashboard.reports.*` row strings + `shareHint` |
| `download-report.tsx` | Busy label | **done (batch 6A)** | `dashboard.reports.downloadPreparing` |
| `cases/.../patient/questions` | Page hero, step chrome, section titles/descriptions, review enums, shared controls | **done (batch 11)** | `dashboard.patient.forms.*`, `forms.shared.*`; **`patientAuditForm.ts` question prompts/options** unchanged (submission-stable) |

---

## Auditor dashboard

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `auditor/page.tsx`, `AuditorDashboardClient.tsx` | Tables, filters | **avoid for now** / **later** | Internal power-user UI; lower priority |

---

## Login / auth pages

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `app/login/page.tsx`, `login/auditor/page.tsx` | Headings, labels, app-owned helper copy | **done (batch 6B)** | `auth.login.*`, `auth.auditor.*`, `auth.common.*` |
| `app/signup/page.tsx` | Role picker, form labels, CTAs, resend/magic helpers | **done (batch 6B)** | `auth.signup.*`; bottom link reuses `nav.signIn` |
| `app/auth/recovery/page.tsx` | Reset UI | **done (batch 6B)** | `auth.recovery.*` |
| `app/auth/magic-link/MagicLinkClient.tsx` | Completing sign-in | **done (batch 6B)** | `auth.magicLink.*` |
| Supabase/API error `.message` strings | Provider text | — | Shown as returned; not localized |

---

## Components shared across roles

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `components/dashboard/*` | Various banners, cards | **later** | Per-component |
| `DoctorOnboardingPageHeader` | Doctor onboarding page title/subtitle | **done (batch 6B)** | `dashboard.doctor.onboardingPageTitle` / `onboardingPageSubtitle` |
| `components/patient/*` | Next-action panels | **done (batch 6A)** | — |

## Account / beta gating

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `beta-access-message/page.tsx` | Role-not-enabled notice | **done (batch 6B)** | `components/account/BetaAccessMessageClient.tsx` + `account.betaAccess.*` |

---

## Explicitly out of scope (per product policy)

- Report HTML/PDF strings, `masterSurgicalMetadata`, rubric copy
- API error messages returned to clients (can be a future API i18n layer)
- Email templates (`src/lib/transparency/emails.ts`, etc.)
- Admin-only tools unless clearly patient-facing

---

## Batch 2 (implemented)

1. **`SignOutButton`** — `dashboard.shared.signOut` (+ ES)
2. **`DoctorDashboardSubnav`** — new client; `dashboard.doctor.pageNavOverview` / `pageNavOnboarding`
3. **`DoctorOnboardingChecklist`** — `checklistTitle`, `checklistSubtitle`, `whyMattersLead`, `whyMattersBody` (+ ES)

**Rationale:** Client-only or thin client extraction; no report/PDF paths; under `I18nProvider` via dashboard shell.

## Batch 3 (implemented)

1. **`ClinicSidebarNav`** — `dashboard.shared.comingSoon`; `dashboard.clinic.sidebarPortalLabel`, `sidebarPortalTagline`, `openPortalNav`, `closePortalNav`
2. **Skip link** — `SkipLinkI18n` + `nav.skipToMain` (inside `I18nProvider`; same `#main-content` target)

## Batch 4 (implemented)

1. **`SiteFooter`** — client; `nav.footer.*`; reuses `nav.howItWorks`, `nav.requestReview`, `nav.sampleReport`, `nav.forProfessionals`
2. **`BetaBanner`** — client; `nav.betaBanner.lead` / `detail`
3. **`SurgicalEcosystemFooterBand`** — client; band title, aria labels, ecosystem role tags (`ecosystemTag*`)
4. **`CrossPlatformLink`** — client; `nav.footer.crossPlatform*` + `nav.ecosystem.exploreHa` for FI-mode CTA

## Batch 5 (implemented)

1. **`PortalPlaceholderPanel`** + **`ClinicPortalPlaceholder`** — clinic settings / benchmarking / training placeholders: shared badge `dashboard.shared.comingSoonBadge`; clinic chrome keys `placeholderBackToOverview`, `placeholderManageProfile`, `placeholderInvitedContributions`; per-page copy under `dashboard.clinic.placeholders.*`.
2. **`DoctorComingSoon`** + **`DoctorComingSoonPlaceholder`** — eyebrow + back link; placeholder pages (public profile, training, defaults, reports hub, upload) under `dashboard.doctor.placeholders.*` (+ `common.goToOverview` for shared secondary CTA).

## Batch 6A (implemented)

Patient portal: next-action panel, delete-draft control, graft integrity card UI chrome (not API bodies), completion / unlock / why-matters / case-history sections via client components, completed-reports list chrome, download button busy state. Keys under **`dashboard.patient.*`** and extended **`dashboard.reports.*`** (aligned `en` / `es`).

## Batch 6B (implemented)

Auth and account shell: **`auth.*`** (common, login, auditor, signup, recovery, magic link) and **`account.betaAccess.*`** in `en`/`es`. Wired: `/login`, `/login/auditor`, `/signup`, `/auth/recovery`, `/auth/magic-link` client, `/beta-access-message` via `BetaAccessMessageClient`. Small **doctor onboarding** header: `dashboard.doctor.onboardingPageTitle` / `onboardingPageSubtitle` + `DoctorOnboardingPageHeader`. Layout **metadata** for login/signup remains English (no route-locale pattern).

**Follow-up (later):** clinic **`layout.tsx`** server nav labels; optional deeper localization of **`patientAuditForm.ts`** field copy (large key surface).

## Batch 7 (implemented)

Public marketing UI (no SEO metadata changes, no locale routes): **`marketing.*`** in `en`/`es` with namespaces `shared`, `home`, `howItWorks`, `professionals`, `sampleReport`. Wired via client modules under `components/marketing/*`, **`ReviewProcessReassurance`**, **`CertifiedClinicsSection`**, and **`ProfessionalsShell`** (nav/footer). Sample report **demo** finding/recommendation body copy remains English; **ES `es.json`:** repaired `account` / `dashboard` nesting and aligned `marketing` + new `sampleReport.correction*` keys.

**Still later (not batch 7):** other static marketing routes (`/about`, `/faq`, program pages), **`professionals/*` article bodies**, **`/professionals/apply`** cards, **`GlobalHairIntelligenceSection`** internal node labels, tier badge spellings in **`CertifiedClinicsSection`**.

## Batch 10 (implemented)

**Report page chrome only** (HTML `/reports/.../html`, case **Latest report** section, **VersionHistoryDrawer**, **LatestReportCard**, **ReportShareButton**, **DownloadReport** errors/labels, **ScoreAreaGraph** headings/levels, **demo-report** marketing shell): top-level **`reports.*`** in `en`/`es` (`chrome`, `actions`, `status`, `errors`; nested `chrome.html`, `chrome.demo`). Server surfaces use **`resolvePublicSeoLocale`** + **`getTranslation`**; client uses **`useI18n`**. **`formatTemplate`** for `{{count}}` / `{{score}}` / `{{version}}`. Generated findings, AI text, rubric titles from payload, and PDF pipelines unchanged.

## Batch 11 (implemented)

**Signed-in workflows — form UI only** (no report/PDF/AI/finalize/scoring changes):

1. **`forms.shared.*`** — save/saving, navigation, retry, select placeholder, yes/no/clear, add/remove, etc. (`en`/`es`).
2. **Patient intelligence intake** — `cases/[caseId]/patient/questions/page.tsx` (hero); **`PatientAuditFormClient`** (stepper, advanced banner, review/photos CTAs, load/save messaging, **`PATIENT_AUDIT_SECTIONS` title/description via `dashboard.patient.forms.sections.*`, review summary + enum display via `reviewEnums.*`). Question **prompts** and **option labels** in **`patientAuditForm.ts`** left English so payloads and validation stay unchanged; API error strings still shown as returned.
3. **Doctor onboarding** — **`DoctorOnboardingForm`** → **`dashboard.doctor.forms.*`**.
4. **Clinic profile** — **`ClinicProfileBuilder`** → **`dashboard.clinic.forms.profileBuilder.*`**; **`ClinicConversionPanel`** shared chrome → **`dashboard.clinic.forms.conversionPanel.*`** (all existing call sites get localized panel chrome; optional `teaserCtaLabel` override preserved).

## Batch 9 (implemented — architecture only)

**Report-adjacent i18n groundwork** (no report body / PDF / AI changes): **`localeContexts.ts`** (UI vs report-output vs source locale), **`reportTranslationBlueprint.ts`** (future translation plan types), **`reportTerminology.ts`** + **`reportGlossary.*`** in `en`/`es` (controlled labels, not wired to generators). **`docs/i18n-report-translation-pipeline.md`**. **`REPORT_CONTENT_DEFAULT_LOCALE`** and `report.ts` JSDoc updated.

## Batch 8 (implemented)

**SEO metadata** for pages already localized in Batch 7: **`marketing.meta.*`** (`title` / `description`) in `en`/`es`. **`createLocalizedPageMetadata`** + **`resolvePublicSeoLocale`** (`src/lib/seo/localeMetadata.ts`): cookie `hairaudit.preferred_language` (mirrored from client via **`syncSeoLocaleCookie`**) then **`Accept-Language`**, default English. **`generateMetadata`** on `/`, `/how-it-works`, `/professionals`, `/sample-report`. Hreflang/localized canonical **not** implemented (same URL); see **`docs/i18n-seo-discoverability.md`**.
