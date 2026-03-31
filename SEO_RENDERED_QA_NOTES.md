# SEO rendered QA notes (Next.js App Router)

Disciplined QA of **Metadata API** usage, **JSON-LD** components, **sitemap/robots**, and representative routes. No broad IA or content rewrite—verification against code paths and prior local `next build` + `next start` HTML checks.

When `NEXT_PUBLIC_APP_URL` is unset locally, `metadataBase` / `getBaseUrl()` fall back to `https://www.hairaudit.com` (`SITE_URL` / platform constants).

---

## 1. Next.js Metadata API audit

### 1.1 Root layout (`src/app/layout.tsx`)

| Item | Behavior |
|------|----------|
| **`metadataBase`** | `new URL(process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? SITE_URL)` — required for absolute canonicals and OG/Twitter URLs from relative paths. |
| **Default `title`** | `default: "HairAudit \| Independent Hair Transplant Audit"`, **`template: "%s"`** — child `title` strings replace the full title (no automatic suffix). |
| **Default `description` / OG / Twitter** | Site-wide fallback when a route does not override; most marketing routes set explicit metadata. |
| **Conflict with children** | Child `metadata` / `generateMetadata` **overrides** per-field; no duplicate title merge. |

### 1.2 Shared helpers

| Helper | Role |
|--------|------|
| **`createPageMetadata`** (`src/lib/seo/pageMetadata.ts`) | `title`, `description`, `alternates.canonical` (relative path → absolute via `metadataBase`), optional `languageAlternates`, `openGraph` (`url` = relative pathname), `twitter`, `robots` (default index/follow unless `noindex`). |
| **`createLocalizedPageMetadata`** (`src/lib/seo/localeMetadata.ts`) | Resolves `titleKey` / `descriptionKey` via `getTranslation`, uses `createPublicLocaleRoutingPlan` for canonical; **`hreflang` only when `distinctLocaleUrlsReady`** (currently **false** — no fake alternate URLs). |
| **`resolvePublicSeoLocale`** | Cookie + `Accept-Language` for localized **title/description** on the **same URL** (not separate routes). |

### 1.3 Route-level patterns

- **Static `export const metadata = createPageMetadata({...})`** — majority of app routes (FAQ, methodology, guides, issues, clinics index, etc.).
- **`generateMetadata`** — homepage (`page.tsx`), `sample-report`, `professionals`, `how-it-works` (localized); dynamic routes e.g. `clinics/[slug]` (includes noindex when needed).

### 1.4 Issue vs guide metadata single source

| Type | Primary copy source | Page `metadata` binding |
|------|---------------------|-------------------------|
| **Issue pages** | `src/lib/patientEducationIssues.ts` (`title`, `description`) | Each `src/app/<issue-slug>/page.tsx` uses `createPageMetadata({ title: \`${issue.title} \| HairAudit\` or similar, description: issue.description, pathname })` — **must stay in sync** with library (already wired). |
| **Long-form guides** | `src/lib/seo/patient-intent-articles/*.ts` (`seoTitle`, `metaDescription`, `pathname`) | Each guide `page.tsx` imports article object and passes `article.seoTitle` / `article.metaDescription` / `article.pathname`. |

**H1 vs `<title>`:** Guides use `article.h1` in body; metadata uses `seoTitle` (often includes `| HairAudit`). Issue pages use `title` as H1; metadata title typically matches + brand suffix. Homepage H1 is **editorially shorter** than the marketing title—intentional.

### 1.5 Canonical / OG / Twitter consistency

- **`alternates.canonical`** and **`openGraph.url`** are set to the **same pathname string** (relative) in `createPageMetadata`; Next emits **absolute** URLs using `metadataBase`. **No change needed** unless a route omits metadata entirely (then root defaults apply—most indexable routes are explicit).

---

## 2. JSON-LD component architecture

| Component | Emits | Used on |
|-----------|--------|---------|
| **`OrganizationWebSiteSchema`** | `Organization` + `WebSite` (2 scripts) | **Homepage only** (`page.tsx`) — avoids site-wide duplicate org schema. |
| **`BreadcrumbListSchema`** | `BreadcrumbList` with absolute `item` URLs via `getBaseUrl()` | Request review, FAQ, methodology, sample-report, demo-report, how-it-works, clinics index, professionals index, guides hub, **issue pages**, **patient guides** |
| **`FaqPageSchema`** | `FAQPage` only | **`/faq` only** — avoids stacking Service + FAQPage twice on the FAQ route. |
| **`MedicalProcedureFaqSchema`** | `Service` (audit offering) + optional `FAQPage` if `faqs.length > 0` | Request review, issue template, patient guides, hub, audit-examples, rate-my-hair-transplant, validation education |

**Patient guide (`PatientIntentArticlePage`):** `Article` (headline, url, `mainEntityOfPage`, `inLanguage: en`, publisher/logo) + **`FaqPageSchema` only when `faqs` are non-empty** (no separate `Service` JSON-LD — avoids duplicating the same headline/description as a faux “Service” named after the article).

**Issue pages (`IssueEducationPage`):** Same Service + FAQ pattern as above; **no Article type** (short landing, not a long-form article schema).

**Absolute URLs:** JSON-LD uses `getBaseUrl()` + paths; same env contract as `metadataBase`.

---

## 3. Representative routes — metadata source & schema

| Route type | Example paths | Metadata source | JSON-LD in page tree |
|------------|---------------|-----------------|----------------------|
| Homepage | `/` | `generateMetadata` → `createLocalizedPageMetadata` + `en.json` / `es.json` `marketing.meta.home` | Organization + WebSite |
| Conversion | `/request-review` | `createPageMetadata` in `request-review/page.tsx` | BreadcrumbList, Service + FAQPage |
| FAQ | `/faq` | `createPageMetadata` in `faq/page.tsx` | BreadcrumbList, FAQPage only |
| Trust | `/methodology`, `/how-it-works` | Static or `generateMetadata` + translations for how-it-works | BreadcrumbList |
| Proof | `/sample-report`, `/demo-report` | Localized sample-report; static demo-report | BreadcrumbList |
| Clinics / professionals index | `/clinics`, `/professionals` | `createPageMetadata` / localized professionals | BreadcrumbList |
| Guides hub | `/hair-transplant-problems` | `createPageMetadata` | BreadcrumbList, Service + FAQPage |
| Issue | `/hair-transplant-graft-failure`, … | `createPageMetadata` from `patientEducationIssues` | BreadcrumbList, Service + FAQPage |
| Long-form guide | `/shock-loss-vs-graft-failure`, … | `createPageMetadata` from article module | BreadcrumbList, Article, FAQPage (if `faqs` non-empty) |

**Localized routes (same URL, different language meta):** `/`, `/sample-report`, `/professionals`, `/how-it-works` per `LOCALIZED_PUBLIC_PATHNAMES` / `createLocalizedPageMetadata`. **No hreflang URLs** until `distinctLocaleUrlsReady` is true in `publicLocaleRouting.ts`.

---

## 4. Sitemap & robots (in-app)

| File | Notes |
|------|------|
| **`src/app/sitemap.ts`** | Static `PUBLIC_ROUTES` + spread `patientIntentArticlePathnames` + dynamic visible clinic profiles. **Issue slugs** listed explicitly. **Professionals sub-routes** (methodology, scoring-framework, etc.) **included** after discoverability fix (see §6). |
| **`src/app/robots.ts`** | `allow: /` with targeted `disallow` (dashboard, api, beta-access-message, legacy paths); `sitemap` = `{baseUrl}/sitemap.xml`. |
| **Index intent** | `/sample-report`, `/demo-report` are **indexed** by default (`robots: index` in metadata)—aligned with proof/discovery strategy. Legacy/disputed routes in `disallow` should stay out of sitemap intentionally. |

---

## 5. Issues found (cumulative QA)

| Issue | Severity | Status |
|-------|-----------|--------|
| Issue pages lacked BreadcrumbList JSON-LD vs guides | Medium | **Fixed** — `IssueEducationPage` + `slug` |
| `/demo-report` lacked BreadcrumbList JSON-LD | Low | **Fixed** — `demo-report/page.tsx` |
| **`/professionals/*` sub-routes missing from sitemap** | Medium | **Fixed** — added six paths to `PUBLIC_ROUTES` in `sitemap.ts` |
| Homepage H1 ≠ document title | Info | **By design** (hero vs SERP title) |
| OG image = SVG | Info | Acceptable; validate in social debuggers if needed |

---

## 6. Fixes implemented (this pass + prior pass)

1. **Sitemap** — `src/app/sitemap.ts`: add `/professionals/methodology`, `scoring-framework`, `evidence-standards`, `clinical-participation`, `legal-documentation`, `auditor-standards` (all public, indexable B2B pages).
2. **Documentation** — `createPageMetadata` JSDoc in `src/lib/seo/pageMetadata.ts` (pathname + `metadataBase` contract).
3. **Earlier phase** — issue breadcrumbs + demo-report `BreadcrumbListSchema` (see §5).
4. **Long-form guide JSON-LD** — `PatientIntentArticlePage`: removed redundant `Service` block that duplicated `Article` headline/description; keep **`Article` + `FaqPageSchema` only** when FAQs exist (`FaqPageSchema` renders nothing when empty).

---

## 7. Unresolved / requires live verification

Cannot be fully confirmed from repo alone:

- Live **canonical** host (www vs apex) vs GSC property.
- **Rich Results** validation in Google’s tool after deploy.
- **OG/Twitter** card rendering with SVG image on each network.
- **Search Console** coverage vs sitemap URL set.
- **Redirects** (HTTP→HTTPS, apex→www) from hosting/CDN.
- Production **`NEXT_PUBLIC_APP_URL`** value vs public site.

---

## 8. Manual production checklist

- [ ] **View page source** (or DevTools Elements) on homepage, `/request-review`, one issue, one guide, `/faq`, `/sample-report` — confirm one canonical, expected title/description, `robots` not noindex.
- [ ] **Canonical** matches final public URL (scheme + host + path).
- [ ] **OG / Twitter** meta present; preview in Facebook/Twitter/LinkedIn debuggers if needed.
- [ ] **Rich Results Test** on one issue URL and one guide URL.
- [ ] **Search Console** — URL inspection for new/changed URLs; **Coverage** for exclusions.
- [ ] **Sitemap** submitted / refreshed; spot-check `sitemap.xml` includes patient guides + issues + professionals subpages.
- [ ] **www / HTTPS** redirects consistent with canonical strategy.
- [ ] **Env:** `NEXT_PUBLIC_APP_URL` (or `SITE_URL` at build/runtime) matches production origin used in GSC.

---

## 9. Search Console monitoring

See **`SEARCH_CONSOLE_MEASUREMENT_FRAMEWORK.md`** for URL groups, query themes, metrics, cannibalization watchlist, and cadence.
