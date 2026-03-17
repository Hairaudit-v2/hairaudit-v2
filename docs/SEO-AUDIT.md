# HairAudit — Full SEO Audit

**Audit date:** March 17, 2025  
**Scope:** Site-wide metadata, technical SEO, content structure, and discoverability.

---

## Executive summary

The site has a solid SEO foundation: root metadata, `metadataBase`, sitemap, `robots.txt`, canonical/OG via `createPageMetadata`, and good internal linking. The main gaps are: **inconsistent metadata** on many content pages (missing canonical/OG), **duplicate content** at `/sample-audit` vs `/sample-report`, **no structured data (JSON-LD)**, **dynamic clinic pages** not in the sitemap, and a few **image alt** and **page-title** refinements.

---

## 1. Technical SEO

### 1.1 What’s working

| Item | Status |
|------|--------|
| **Root layout metadata** | `layout.tsx` sets `metadataBase`, default title, description, `openGraph`, `twitter` |
| **Sitemap** | `app/sitemap.ts` — 33 public routes, priorities (home 1, request-review 0.9, rest 0.7), `changeFrequency` |
| **Robots** | `app/robots.ts` — allows `/`, disallows dashboard, cases, api, admin, dev; references sitemap |
| **Canonical / OG helper** | `createPageMetadata()` in `lib/seo/pageMetadata.ts` — canonical, OG, Twitter, optional noindex |
| **Redirect + canonical** | `/request-audit` → `/request-review` with canonical to avoid duplicate URLs |
| **Skip link** | “Skip to main content” in root layout for accessibility (indirect SEO benefit) |
| **`revalidate`** | Home page uses `revalidate = 600` for ISR |

### 1.2 Gaps and recommendations

- **Trailing slashes** — Next.js default is no trailing slash. Ensure production and any CDN/redirects are consistent (no mixed canonical with/without slash).
- **robots.ts** — Consider explicitly allowing key paths if you add more granular rules later (current `allow: "/"` is fine).

---

## 2. Metadata consistency

### 2.1 Pages using `createPageMetadata` (canonical + OG + Twitter)

These are in good shape:

- `/`, `/how-it-works`, `/request-review`, `/sample-report`, `/faq`, `/about`, `/privacy`, `/terms`, `/disclaimer`
- `/professionals`, `/professionals/apply`, `/professionals/methodology`, `/professionals/evidence-standards`, `/professionals/scoring-framework`, `/professionals/legal-documentation`, `/professionals/clinical-participation`, `/professionals/auditor-standards`
- `/verified-surgeon-program`, `/services`, `/follicle-intelligence`

### 2.2 Pages with plain `metadata` (missing canonical + full OG/Twitter URL)

These only set `title` and `description`; they inherit root OG but **do not set page-specific canonical or `og:url`**. That can dilute link equity and make shares show the homepage URL.

| Page | Current | Recommendation |
|------|---------|----------------|
| `hair-transplant-not-growing` | title, description | Use `createPageMetadata` with pathname `"/hair-transplant-not-growing"` |
| `hair-transplant-too-thin` | title, description | Use `createPageMetadata` |
| `hair-transplant-donor-overharvested` | title, description | Use `createPageMetadata` |
| `hair-transplant-graft-failure` | title, description | Use `createPageMetadata` |
| `hair-transplant-problems` | title, description | Use `createPageMetadata` |
| `bad-hair-transplant-hairline` | title, description | Use `createPageMetadata` |
| `rate-my-hair-transplant` | title, description | Use `createPageMetadata` |
| `is-my-hair-transplant-normal` | title, description | Use `createPageMetadata` |
| `great-hair-transplants` | title, description | Use `createPageMetadata` |
| `best-hair-transplant-results` | title, description | Use `createPageMetadata` |
| `methodology` | title, description | Use `createPageMetadata` |
| `audit-examples` | title, description | Use `createPageMetadata` |
| `community-results` | title, description | Use `createPageMetadata` |
| `clinics` | title, description | Use `createPageMetadata` |
| `benchmark-vision` | title, description | Use `createPageMetadata` |
| `sample-audit` | title, description, canonical: `/sample-audit` | See “Duplicate content” below |

**Action:** Refactor each of the above to use `createPageMetadata({ title, description, pathname: "/..." })` so every public page has a canonical URL and correct OG/Twitter URL.

---

## 3. Duplicate content: `/sample-audit` vs `/sample-report`

- **Current:** `/sample-audit` renders the same component as `/sample-report` but sets `canonical: "/sample-audit"`. That creates two indexable URLs with identical content.
- **Recommendation (choose one):**
  - **Option A (preferred):** Redirect `/sample-audit` → `/sample-report` (like `request-audit` → `request-review`), set `noindex` on the alias if you keep it, or remove the alias and link only to `/sample-report`.
  - **Option B:** If you must keep both URLs, set `canonical: "/sample-report"` on `/sample-audit` and add `robots: { index: false, follow: true }` on `/sample-audit` so only `/sample-report` is the canonical target.

---

## 4. Sitemap vs routes

- **Sitemap** includes 33 static routes; it does **not** include:
  - **Dynamic clinic profiles** `/clinics/[slug]` — these are public and would benefit from being in the sitemap (e.g. fetch all visible `clinic_slug`s and add URLs).
- **Leaderboards** (`/leaderboards/doctors`, `/leaderboards/clinics`) — currently require auth and redirect to login; correctly excluded from sitemap. If you add public leaderboard views later, add them to the sitemap and metadata.

**Recommendation:** Implement a dynamic sitemap (or sitemap index) that includes `/clinics/[slug]` URLs for clinics with `profile_visible === true`, so search engines can discover and crawl clinic pages.

---

## 5. Dynamic clinic pages: metadata

- **Current:** `clinics/[slug]/page.tsx` uses `generateMetadata()` with title and description only (no `alternates.canonical`, no `openGraph`, no `twitter`).
- **Impact:** Canonical and share URLs may fall back to root or be incomplete.
- **Recommendation:** In `generateMetadata`, return the same shape as `createPageMetadata` for that page: `alternates.canonical: \`/clinics/${slug}\``, plus `openGraph` and `twitter` with the same title/description and URL. Reuse logic or a shared helper so clinic pages get full metadata.

---

## 6. Content and structure

### 6.1 Homepage

- **Single H1:** “Was Your Hair Transplant Done Properly?” — good.
- **Sections:** Clear H2s (How HairAudit Works, Your HairAudit Report Includes, etc.).
- **Internal links:** CTA to `/request-review` and `/sample-report`; consider adding one or two contextual links to key education pages (e.g. “hair transplant problems” or “how it works”) in body copy if it fits.

### 6.2 Heading hierarchy

- No evidence of multiple H1s per page in the main flows; section structure is logical.
- Recommendation: On long pages (e.g. sample report, methodology), ensure H2 → H3 hierarchy is consistent and that key phrases appear in headings where it reads naturally.

### 6.3 Image alt text

- **Logo/OG image:** `/hairaudit-logo.svg` used with alt “HairAudit” in metadata — good.
- **Inline images:** Some components use generic alt (e.g. “upload”, “Donor thumbnail”, “Recipient thumbnail”). Where images are decorative or repetitive, `alt=""` or a short descriptive alt is fine; for content images (e.g. in reports or education), use specific, concise alt text (e.g. “Donor area, post-op day 7”) for accessibility and image SEO.

---

## 7. Structured data (JSON-LD)

- **Current:** No JSON-LD found (Organization, WebSite, FAQPage, MedicalWebPage, etc.).
- **Recommendation:** Add at least:
  - **Organization** (and optionally **WebSite**) on the homepage with name, url, logo, sameAs if you have social profiles.
  - **WebSite** with `potentialAction` (SearchAction) if you add site search.
  - **FAQPage** on `/faq` if the FAQ is a list of questions/answers.
  - For clinic pages, consider **LocalBusiness** or a relevant medical/professional type if it matches your positioning.

This helps rich results and can improve CTR in SERPs.

---

## 8. Mobile and performance (brief)

- **Speed Insights / Analytics:** Present in root layout; no SEO issues.
- **Viewport / charset:** Handled by Next.js default document.
- **Web app manifest:** Not present; optional for SEO but recommended if you want “Add to Home Screen” and better mobile treatment.

---

## 9. Security and crawlability

- **Sensitive paths:** Correctly disallowed in `robots.ts`: `/dashboard/`, `/cases/`, `/admin/`, `/api/`, `/dev`, and alias paths like `/request-audit`, `/beta-access-message`, `/verified-program`.
- **Login-only pages:** Leaderboards and dashboards redirect unauthenticated users; they are not in the sitemap — good.

---

## 10. Priority action list

| Priority | Action |
|----------|--------|
| **High** | Resolve duplicate content: redirect `/sample-audit` → `/sample-report` or set canonical + noindex on `/sample-audit`. |
| **High** | Standardize metadata: switch all content pages that currently use plain `metadata` to `createPageMetadata` with the correct pathname (see list in §2.2). |
| **Medium** | Add full metadata (canonical, OG, Twitter) to `clinics/[slug]` via `generateMetadata`. |
| **Medium** | Add JSON-LD: Organization/WebSite on homepage, FAQPage on `/faq`. |
| **Medium** | Extend sitemap to include dynamic `/clinics/[slug]` URLs for visible clinics. |
| **Low** | Improve alt text on content images (reports, education) where it adds value. |
| **Low** | Consider Web app manifest and theme-color for mobile. |

---

## 11. Quick reference — files touched by SEO

| File | Role |
|------|------|
| `src/app/layout.tsx` | Root metadata, metadataBase, default OG/Twitter |
| `src/app/sitemap.ts` | Static sitemap (consider adding dynamic clinic URLs) |
| `src/app/robots.ts` | Allow/disallow, sitemap URL |
| `src/lib/seo/pageMetadata.ts` | Canonical + OG + Twitter + robots helper |
| `src/app/request-audit/page.tsx` | Redirect to `/request-review` + canonical |
| `src/app/sample-audit/page.tsx` | Duplicate of sample-report — fix canonical/redirect |
| `src/app/clinics/[slug]/page.tsx` | generateMetadata — add canonical + OG |
| Content pages listed in §2.2 | Switch to `createPageMetadata` |

---

*End of SEO audit.*
