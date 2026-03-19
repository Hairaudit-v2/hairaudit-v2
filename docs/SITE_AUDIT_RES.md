# Site Audit: RES, Core Web Vitals, SEO & Trust

**Date:** 2025-03-19  
**Scope:** Production-grade audit focused on Real Experience Score (RES), Core Web Vitals, crawlability, metadata, and user trust. Remediation applied where possible; remaining items require asset or content input.

---

## Executive summary

The HairAudit app (Next.js 16, React 19) has solid foundations: root `metadataBase`, shared `createPageMetadata` with canonicals, sitemap and robots, skip link and focus styles, and structured data on key pages. The audit identified and fixed several high-impact issues: **login/signup missing noindex and canonical**, **clinic not-found pages indexable**, **sitemap missing certification-explained**, **dashboard logo priority removed** (non-LCP), and **homepage ecosystem section code-split** to reduce main-thread and LCP impact. Remaining risks: **missing asset `/hair-audit-logo-white.png`** (referenced in header/login/signup/dashboard), **framer-motion used in many ScrollReveal instances and ecosystem diagram** (acceptable but adds JS cost), and **SiteHeader as client component** (required for nav/menu; keep as-is). Expected impact: better crawl clarity, fewer low-value indexed URLs, and slightly improved LCP/INP from smaller initial JS and clearer priority on true LCP image.

---

## Top 10 highest-impact issues

| # | Issue | Impact | Status |
|---|--------|--------|--------|
| 1 | Login/signup pages indexable, no canonical | SEO crawl waste, duplicate entry points | **Fixed** – noindex + canonical via createPageMetadata in layouts |
| 2 | Clinic slug not-found pages indexable | Thin/404-like pages in index | **Fixed** – noindex in generateMetadata when clinic not found |
| 3 | Sitemap missing `/certification-explained` | Important public page not in sitemap | **Fixed** – added to PUBLIC_ROUTES |
| 4 | Dashboard header logo used `priority` | Unnecessary LCP hint (dashboard is post-auth) | **Fixed** – removed priority from DashboardHeader logo |
| 5 | Homepage ecosystem section (framer-motion) in main bundle | Larger JS, more main-thread work | **Fixed** – dynamic import with ssr: true for code splitting |
| 6 | Missing asset `/hair-audit-logo-white.png` | 404 or fallback on header/login/signup/dashboard | **Needs asset** – add file to `public/` or replace with SVG |
| 7 | Many ScrollReveal (framer-motion) instances on homepage | Hydration and animation cost | **Accepted** – reduces jank via once + margin; optional future: CSS scroll-driven or reduce instances |
| 8 | SiteHeader is client-side (pathname, menu, ecosystem link) | Required for behavior; increases client bundle | **Accepted** – no change |
| 9 | Raw `<img>` in audit/community components without width/height | Possible CLS on dynamic images | **Partial** – some in fixed-aspect containers; add width/height where feasible |
| 10 | Homepage has both revalidate and force-dynamic | force-dynamic wins (needed for auth redirect) | **Accepted** – intentional |

---

## What was fixed

- **Login layout:** `createPageMetadata` with `pathname: "/login"`, `noindex: true`.
- **Signup layout:** `createPageMetadata` with `pathname: "/signup"`, `noindex: true`.
- **Clinic [slug] not found:** `generateMetadata` now returns `noindex: true` when clinic profile is not found.
- **Sitemap:** Added `/certification-explained` to `PUBLIC_ROUTES`.
- **DashboardHeader:** Removed `priority` from logo Image (dashboard is not public LCP).
- **Homepage:** `GlobalHairIntelligenceSection` loaded via `next/dynamic` with `ssr: true` to split ecosystem/diagram JS from main bundle.

---

## What still needs asset/content input

- **Add or replace `/hair-audit-logo-white.png`:** Referenced in `SiteHeader` (default theme), `DashboardHeader`, login, signup, auth/recovery. Either add the PNG to `public/` or provide a white SVG and update references.
- **OG/social image:** Default OG image is `/hairaudit-logo.svg`. For richer shares, consider a dedicated 1200×630 image and reference it in `createPageMetadata` / root metadata.
- **Optional:** Reduce number of ScrollReveal wrappers on long pages (e.g. request-review, for-clinics) or replace with CSS-only reveal to trim JS.

---

## Pages/components with highest performance risk

- **SiteHeader** – Client component, two logo variants (SVG + PNG), one priority on visible logo; high in tree on every page. Mitigation: only one logo visible per variant; ensure white PNG exists to avoid 404.
- **Homepage** – Many ScrollReveal sections + ecosystem diagram. Mitigation: ecosystem section now dynamically imported; ScrollReveal uses `once` and viewport margin to limit work.
- **Request-review / For-clinics / Demo-report** – Multiple ScrollReveal + gradients. Acceptable; consider reducing ScrollReveal count if metrics show INP/LCP issues.
- **Dashboard layout** – Server-side auth check; DashboardHeader and child routes pull in client components. Not in critical path for public RES; no change.

---

## Expected impact

- **RES / Core Web Vitals:** Small gain from ecosystem code-split (less initial JS); no regression from removing priority on dashboard logo. LCP remains dominated by header logo (ensure white PNG exists).
- **Crawl / indexing:** Fewer low-value URLs (login, signup, clinic not-found) and clearer canonical; certification-explained included in sitemap.
- **Trust / UX:** No functional change; existing schema, reassurance copy, and disclaimers retained.

---

## Verification

Run after changes:

- `pnpm lint` — **Passed**
- `pnpm exec tsc --noEmit` — **Passed**
- `pnpm build` — **Passed** (Next.js 16.1.6 production build)
- Optional: Lighthouse (LCP, INP, CLS) on homepage and request-review; check for 404 on `/hair-audit-logo-white.png`.

---

## Summary of changes (by category)

### Performance fixes

- **Homepage:** `GlobalHairIntelligenceSection` (framer-motion ecosystem diagram) loaded via `next/dynamic` with `ssr: true` to split JS and reduce main bundle.
- **Dashboard:** Removed `priority` from logo in `DashboardHeader` (dashboard is post-auth; logo is not public LCP).

### SEO fixes

- **Login layout:** Uses `createPageMetadata` with `pathname: "/login"` and `noindex: true`; canonical and robots set.
- **Signup layout:** Uses `createPageMetadata` with `pathname: "/signup"` and `noindex: true`.
- **Clinic [slug]:** When clinic is not found, `generateMetadata` now returns `noindex: true`.
- **Sitemap:** Added `/certification-explained` to `PUBLIC_ROUTES`.

### Trust / experience fixes

- No code changes in this pass; existing schema, ReviewProcessReassurance, MedicalProcedureFaqSchema, and beta banner retained.

### Accessibility fixes

- No code changes in this pass; skip link, focus-visible styles, and header ARIA attributes were already in place.

### Follow-up items requiring human input

- Add `/hair-audit-logo-white.png` to `public/` or replace all references with a white SVG.
- Optional: Add a dedicated OG image (e.g. 1200×630) for social sharing.
- Optional: Run Lighthouse and address any remaining LCP/INP/CLS issues; consider reducing ScrollReveal usage or switching to CSS-only reveal on long pages.

---

## Second-pass hardening

**Date:** 2025-03-19 (follow-up sweep)

### Newly fixed items (second pass only)

**Performance / LCP**

- **Homepage hero:** Removed `ScrollReveal` from the first section so the H1 and primary CTA paint immediately; avoids opacity-0 → visible animation delaying LCP.
- **Request-review, how-it-works, demo-report, for-clinics heroes:** Same change — hero blocks no longer wrapped in `ScrollReveal`, so above-the-fold H1/CTA paint without waiting on framer-motion.
- **SiteHeader logos:** Added `sizes="(max-width: 640px) 200px, 280px"` to both logo `Image` components to avoid overfetching; normalized alt to `"HairAudit"`.
- **DashboardHeader logo:** Added `sizes="180px"` and alt `"HairAudit"` for consistency.

**CLS**

- **CommunityResultsClient:** Thumbnail `<img>` now has `width={400}` and `height={144}` to reserve space and reduce layout shift.
- **PublicCaseClient:** Case image `<img>` elements given `width={352}` and `height={176}`.
- **RateMyHairTransplantClient:** Preview `<img>` elements given `width={224}` and `height={112}`.

**Crawlability / metadata**

- **Auth layout:** Added `src/app/auth/layout.tsx` with `robots: { index: false, follow: false }` and generic title/description so `/auth/recovery` and `/auth/magic-link` are noindex; no canonical to avoid overriding child paths.
- **Beta-access-message layout:** Switched to `createPageMetadata` with `pathname: "/beta-access-message"` and `noindex: true` for consistent canonical and OG/twitter.

**Accessibility**

- Logo `alt` unified to `"HairAudit"` in `SiteHeader` and `DashboardHeader` (brand consistency and clarity).

### Remaining blockers (still need assets, content, or product decisions)

- **`/hair-audit-logo-white.png`** — Still missing from `public/`. Add the file or replace with a white SVG and update all references (header, login, signup, recovery, dashboard). Blocks clean LCP on default (dark) theme until resolved.
- **Dedicated OG image** — Default remains `/hairaudit-logo.svg`. A 1200×630 asset would improve social sharing; requires design/asset.
- **ScrollReveal below the fold** — Remaining sections on landing pages still use `ScrollReveal`; acceptable for INP. If metrics show jank, consider CSS-only reveal or fewer instances.
- **Third-party / analytics** — Vercel Analytics and Speed Insights load in root layout; no change. Any future chat/widgets should be lazy-loaded or deferred.

---

## Third-pass performance hardening

**Date:** 2025-03-19 (RES / Core Web Vitals only)

### Exact issues fixed

**LCP / initial load**

- **Homepage:** Removed all `ScrollReveal` wrappers from the entire page. Hero was already static (pass 2); now every section renders as static content so no framer-motion runs on the homepage. This eliminates ScrollReveal (and its framer-motion dependency) from the homepage bundle for these sections.
- **Homepage ecosystem block:** Kept as dynamic import with `ssr: true` (Next.js 16 does not allow `ssr: false` in Server Components). Still code-splits the ecosystem diagram so its chunk loads separately from the main page bundle.
- **Root layout:** Analytics and Speed Insights left as direct imports; deferring them with `next/dynamic` and `ssr: false` would require a Client Component wrapper (not done in this pass).

**INP / JS execution**

- **Request-review, how-it-works, demo-report, for-clinics, methodology:** Removed every `ScrollReveal` wrapper and the `ScrollReveal` import from these pages. Content is plain static markup; no framer-motion on these high-traffic landing pages. Reduces parse/compile and execution cost and avoids animation work on scroll.

**No CLS or font changes in this pass** — previous passes already added image dimensions and sizes; no layout or font changes were made.

### Estimated impact

| Metric | Expected impact |
|--------|------------------|
| **LCP** | Improved: less JS before paint; no ScrollReveal/framer-motion on homepage or top landing pages so main content paints immediately. |
| **INP** | Improved: no ScrollReveal/framer-motion on homepage or top 5 landing pages; less main-thread work on load and scroll. |
| **CLS** | Neutral: no changes in this pass. |
| **TTFB** | Neutral: no change in this pass. |
| **JS bundle (initial)** | Reduced: framer-motion not required for homepage or request-review/how-it-works/demo-report/for-clinics/methodology when only these routes load; ecosystem section remains code-split with ssr: true. |

### Pages most improved

1. **Homepage (`/`)** — Largest gain: no ScrollReveal anywhere; all sections static; ecosystem remains code-split.
2. **Request-review (`/request-review`)** — All ScrollReveal removed; conversion path no longer depends on framer-motion.
3. **How-it-works (`/how-it-works`)** — All ScrollReveal removed.
4. **Demo-report (`/demo-report`)** — All ScrollReveal removed.
5. **For-clinics (`/for-clinics`)** — All ScrollReveal removed.
6. **Methodology (`/methodology`)** — All ScrollReveal removed.
7. **All pages** — Same layout; Analytics/Speed Insights unchanged (deferring would require a client wrapper).
