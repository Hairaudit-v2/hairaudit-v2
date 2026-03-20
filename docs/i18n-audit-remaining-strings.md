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
| `SiteFooter.tsx` | Column headings, link labels, descriptions | **later** | RSC; needs client footer or server locale cookie |
| `BetaBanner.tsx` | Beta disclaimer paragraph | **later** | RSC; same pattern |
| `app/layout.tsx` | Skip link text | **safe now** | Tiny client island possible |
| `app/page.tsx` (home) | Hero, CTAs, sections | **later** | Large surface; separate batch |

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
| `DoctorOnboardingForm.tsx`, `doctor/onboarding/page.tsx` | Form labels | **later** | Larger form batch |
| `DoctorParticipationSummaryCard.tsx`, `DoctorComingSoon.tsx` | Card copy | **later** | — |
| `doctor/reports/page.tsx`, `upload`, `training`, etc. | Page titles, empty states | **later** | Many files |

---

## Clinic portal (`/dashboard/clinic/*`)

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `clinic/layout.tsx` | `navItems` labels (Overview, Onboarding, …) | **later** | Server layout; needs client nav or message passing |
| `ClinicSidebarNav.tsx` | "Soon" badge | **safe now** | Client; small follow-up |
| `ClinicPortalShell`, `ClinicNextActionCard`, status chips | Dynamic strings from layout | **later** | Fed from server; refactor with care |
| `clinic/page.tsx` & feature panels | Large amount of marketing/ops copy | **later** | High volume |

---

## Patient portal (`/dashboard/patient/*`)

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `patient/page.tsx` | Sections beyond `PatientDashboardI18nIntro` | **later** | Very large file; module-by-module |
| `GraftIntegrityCard`, `DeleteDraftCaseButton` | Labels | **later** | — |
| `patient/reports/page.tsx` | List row chrome (if any hardcoded) | **later** | Keep report content out of scope |

---

## Auditor dashboard

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `auditor/page.tsx`, `AuditorDashboardClient.tsx` | Tables, filters | **avoid for now** / **later** | Internal power-user UI; lower priority |

---

## Login / auth pages

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `app/login/*` | Headings, errors | **later** | Dedicated auth i18n batch |

---

## Components shared across roles

| Location | Examples | Tag | Notes |
|----------|----------|-----|-------|
| `components/dashboard/*` | Various banners, cards | **later** | Per-component |
| `components/patient/*` | Next-action panels | **later** | — |

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

## Recommended **next safe batch (batch 3 candidates)**

1. **`ClinicSidebarNav`** — `Soon` badge → `dashboard.shared.comingSoon` or similar
2. **`app/layout.tsx`** skip link — `nav.skipToContent` (client island)
3. **`SiteFooter` + `BetaBanner`** — convert to client islands or pass-through (larger diff; own PR)

**Follow-up (later):** clinic `layout.tsx` server nav labels, patient `page.tsx` modules, login/auth copy.
