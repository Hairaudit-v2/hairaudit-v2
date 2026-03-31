# SEO audit — implementation notes (HairAudit marketing site)

This document summarizes the March 2026 SEO pass: metadata, on-page copy, internal linking, structured data, and items that still require manual verification in production tooling.

## Pages and components updated (high level)

| Area | Changes |
|------|---------|
| **Homepage** | `en.json` / `es.json` `marketing.meta.home`, hero and step copy, new “Learn more” link block (methodology, guides, shock loss vs graft failure, FAQ), clinic/pro audience bridge with links to `/clinics` and `/professionals`. `HomePageMarketing.tsx`. |
| **Localized marketing** | `marketing.meta.howItWorks`, `professionals`, `sampleReport` (EN/ES). `marketing.howItWorks` CTA strings. |
| **Request review** | Title, description, H1, intro (independence + non-diagnostic framing), breadcrumb JSON-LD, descriptive footer links (methodology, FAQ, professionals, clinics), example-report CTA label. |
| **FAQ** | Title, description, H1, intro, breadcrumb JSON-LD, expanded footer CTAs (request review, sample report, methodology, professionals). |
| **Clinics directory** | Title/description aligned to QA/transparency; breadcrumb JSON-LD; hero links include request review + how-it-works. |
| **Methodology** | Title, description, H1, body bullets (donor, density, design, implantation, technique, confidence), breadcrumbs, next-step links (request audit, demo report, FAQ, how-it-works). |
| **Demo report** | Title/description differentiated from `/sample-report` (interactive vs marketing walkthrough). |
| **For clinics, About, Services** | Stronger, non-duplicate titles and descriptions. |
| **Hair transplant graft failure (issue)** | Page metadata + `patientEducationIssues` title/description. |
| **Long-form graft article** | `hair-transplant-graft-failure-what-photos-can-and-cannot-show.ts` title/meta tweaked to avoid duplicate positioning vs the issue page. |
| **Patient guides hub** | Breadcrumb JSON-LD; hero CTAs (audit, sample report, methodology, FAQ). |
| **How it works / Sample report / Professionals** | Breadcrumb JSON-LD wrappers in `page.tsx`. |
| **Site footer** | New “Methodology & review scope” link → `/methodology` (`nav.footer.linkMethodology` EN/ES). |
| **Issue education template** | `IssueEducationPage.tsx`: CTA labels, demo report link, contextual links (guides hub, second-opinion article, methodology). |
| **Patient intent articles** | `PatientIntentArticlePage.tsx`: richer `Article` JSON-LD (`url`, `mainEntityOfPage`, `inLanguage`, publisher `logo`); breadcrumb JSON-LD; descriptive next-step and footer anchors. |
| **Root layout** | Default `title`, `description`, Open Graph, Twitter aligned to forensic audit positioning. |

## Schema (JSON-LD)

| Type | Location / behavior |
|------|---------------------|
| **Organization + WebSite** | `OrganizationWebSiteSchema.tsx` — added factual `description` on Organization; WebSite unchanged structurally. |
| **BreadcrumbList** | New `BreadcrumbListSchema.tsx`; used on request-review, FAQ, clinics, methodology, hair-transplant-problems, how-it-works, sample-report, professionals, and patient-intent articles (alongside visible breadcrumbs where present). |
| **FAQPage** | Unchanged on `/faq` (`FaqPageSchema`). Still emitted with **Service + FAQPage** on pages using `MedicalProcedureFaqSchema`. |
| **Service (replaces MedicalProcedure)** | `MedicalProcedureFaqSchema.tsx` now outputs `@type: Service` for the audit offering (not `MedicalProcedure`, to avoid implying a clinical treatment schema). FAQ block unchanged. |
| **Article** | Patient-intent guides: expanded fields as above. |

No review stars, no fabricated credentials, no treatment outcome promises in schema.

## Internal linking

- Homepage: methodology, guides hub, `/shock-loss-vs-graft-failure`, FAQ, clinics, professionals.
- Request review, FAQ, methodology, clinics, patient hub, issue template, article template: descriptive anchors toward audit request, sample report, FAQ, methodology, second-opinion content, professionals/clinics as relevant.
- Footer: methodology under Patients.

## Technical SEO (in repo)

- **Canonicals / OG / Twitter**: Still driven by `createPageMetadata` + root `metadataBase` (`layout.tsx`). No change to trailing-slash policy in code.
- **Sitemap**: `src/app/sitemap.ts` unchanged; continues to list `PUBLIC_ROUTES` and public clinic profiles.
- **Robots**: `src/app/robots.ts` unchanged; references `${baseUrl}/sitemap.xml`.

## Content / topical coverage (existing article system)

The repo already ships patient-intent articles and issue pages. Search intents from the brief map roughly as follows (no new slugs added in this pass):

| Intent | Existing slugs (examples) |
|--------|---------------------------|
| Did my transplant fail? / graft failure | `/hair-transplant-graft-failure`, `/shock-loss-vs-graft-failure`, `/hair-transplant-graft-failure-what-photos-can-and-cannot-show` |
| Donor overharvesting | `/hair-transplant-donor-overharvested`, `/overharvested-donor-area`, `/can-an-overharvested-donor-be-corrected` |
| Bad hairline / design | `/bad-hair-transplant-hairline`, `/unnatural-hairline-after-hair-transplant` |
| Low density | `/hair-transplant-too-thin`, `/hair-transplant-density-too-low` |
| Second opinion / timing | `/when-should-you-seek-an-independent-hair-transplant-review`, `/hair-transplant-second-opinion-vs-clinic-opinion`, `/thinking-about-a-second-hair-transplant`, `/when-is-a-hair-transplant-final` |
| Repair vs wait / disputes | `/how-to-prepare-for-a-hair-transplant-complaint-or-dispute`, `/hair-transplant-repair-after-overseas-surgery` |
| “Normal” donor appearance | Partially covered by donor guides above; a dedicated “normal donor” article could still be added later if analytics warrant it. |

## Manual verification checklist (outside repo)

- **Google Search Console**: Property verification, sitemap submission (`/sitemap.xml`), inspect key URLs after deploy.
- **Production URL**: Confirm `NEXT_PUBLIC_APP_URL` / `SITE_URL` match the live canonical host (www vs non-www, HTTPS); fix redirects at CDN/host if needed.
- **Core Web Vitals**: Measure on real URLs; no CWV changes were targeted in this pass.
- **Hreflang**: Still single URL per page; localized UI only — see `docs/i18n-seo-discoverability.md` if locale-specific URLs are added later.
- **Rich results testing**: Validate FAQ and Article JSON-LD with Google’s Rich Results Test on a sample of pages.
