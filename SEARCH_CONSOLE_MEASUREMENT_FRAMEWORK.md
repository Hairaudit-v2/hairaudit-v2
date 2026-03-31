# Search Console measurement framework (HairAudit)

Internal playbook for monitoring whether the SEO implementation (Metadata API output, JSON-LD, internal linking, sitemap coverage) behaves as intended after deployment. Primary tool: **Google Search Console** (GSC). Optional: **GA4** landing-page reports.

---

## A. URL groups

Use **URL prefix**, **regex** filters (Performance → Search results → Page / Query), or saved comparisons.

| Group | Path patterns (examples) | Intent |
|--------|---------------------------|--------|
| **Homepage / brand + broad review** | `/` | Brand discovery; independent / forensic audit positioning |
| **Request review / transactional conversion** | `/request-review` | Submit audit; conversion |
| **Methodology / trust framework** | `/methodology`, `/how-it-works` | How audits work; credibility |
| **Sample report / proof-of-output** | `/sample-report`, `/demo-report` | Report shape & proof (track **separately**) |
| **FAQ / support + objections** | `/faq` | Process, privacy, trust objections |
| **Issue pages / symptom-intent** | `/hair-transplant-too-thin`, `/hair-transplant-not-growing`, `/hair-transplant-donor-overharvested`, `/bad-hair-transplant-hairline`, `/hair-transplant-graft-failure` | Short problem landings |
| **Long-form guides / educational** | `/hair-transplant-problems` + paths from `patientIntentArticlePathnames` in `src/lib/seo/patient-intent-articles/index.ts` | Deep education |
| **Clinics / B2B directory** | `/clinics`, `/clinics/*` | Directory (profile URLs may be noindex — check coverage) |
| **Professionals / B2B** | `/professionals`, `/professionals/apply`, `/professionals/methodology`, … | Standards & participation |

**Hub:** `/hair-transplant-problems` — distribution into issues + guides.

---

## B. Example query themes by group

Use as **filters / seeds** in GSC, not as ranking guarantees.

| Group | Example themes |
|--------|----------------|
| Brand / home | hair transplant audit, hairaudit, independent hair transplant audit |
| Conversion | hair transplant review, independent hair transplant review, hair audit submit |
| Trust | hair transplant audit methodology, forensic hair transplant review, how hair audit works |
| Proof | sample hair transplant report, hair audit report example, demo hair audit report |
| FAQ | hair audit faq, is hairaudit legit, hair audit process, hair audit privacy |
| Issues | failed hair transplant, did my hair transplant fail, donor overharvesting after fue, low density after hair transplant, unnatural hairline after transplant, hair transplant not growing |
| Guides | shock loss vs graft failure, hair transplant second opinion, when is delayed growth normal after hair transplant, hair transplant graft failure signs, bad hair transplant signs |
| Clinics | clinic transparency hair transplant, hairaudit clinics |
| Professionals | hair transplant audit standards, verified surgeon program, hairaudit professionals |

---

## C. Metrics to monitor

In **Performance → Search results** (and Pages / Queries exports):

1. **Impressions** — visibility by group; new URLs after launches.
2. **Clicks** — demand vs impressions.
3. **CTR** — title/meta fit; segment branded vs non-branded.
4. **Average position** — directional; slice by country/device if needed.
5. **Landing pages by query theme** — which URL wins for each cluster.
6. **Query ↔ URL drift** — same query shifting primary landing page over time.
7. **Impressions without clicks** — pages stuck with visibility but no engagement (title/meta or intent mismatch).
8. **Competing URLs for one query cluster** — multiple HairAudit URLs on the same query (see **D**).
9. **New / rising queries** — after content expansions; export periodically.

**Indexing:** Pages report — “Crawled — currently not indexed”, soft 404s, duplicate canonicals, exclusions vs robots.

---

## D. Cannibalization watchlist

| Risk | URLs / topics |
|------|----------------|
| Shock vs graft failure | `/shock-loss-vs-graft-failure` vs `/hair-transplant-graft-failure` vs graft-failure photo guide |
| Growth delay vs poor growth vs repair timing | `/when-is-hair-transplant-growth-delay-normal-vs-concerning` vs `/hair-transplant-not-growing` vs `/repair-vs-wait-after-poor-hair-transplant-growth` |
| Issue vs long-form guide | e.g. `/hair-transplant-too-thin` vs `/hair-transplant-density-too-low` |
| Homepage vs request-review | `/` vs `/request-review` for “review / audit” terms |
| Sample vs demo | `/sample-report` vs `/demo-report` |
| Methodology vs homepage | `/methodology` vs `/` for forensic / “how it works” language |

Cross-check titles differ and internal links reinforce primary/secondary roles (`SEO_CONTENT_CLUSTER_PLAN.md`).

---

## E. Review cadence

| Phase | Cadence | Focus |
|-------|---------|--------|
| First **6 weeks** after deployment | **Weekly** | New URL indexing, coverage errors, CTR on changed titles, watchlist queries |
| After stabilization | **Monthly** | Trends, cannibalization, sitemap vs indexed sets |

**Exports:** Monthly CSV of top queries + landing pages for regression comparison.

---

## F. Repo references (implementation, not GSC)

| Concern | Location |
|---------|-----------|
| Sitemap | `src/app/sitemap.ts` |
| Robots | `src/app/robots.ts` |
| `metadataBase` + default title | `src/app/layout.tsx` |
| Static page metadata helper | `src/lib/seo/pageMetadata.ts` (`createPageMetadata`) |
| Localized metadata | `src/lib/seo/localeMetadata.ts`, `src/lib/seo/publicLocaleRouting.ts` |
| JSON-LD base URL | `src/lib/seo/baseUrl.ts` (`getBaseUrl`) |
| Content cluster plan | `SEO_CONTENT_CLUSTER_PLAN.md` |

---

## G. Manual / ops (outside repo)

- **`NEXT_PUBLIC_APP_URL`** (or equivalent) must match the live origin used in GSC (www, HTTPS) so canonicals, OG URLs, and JSON-LD align.
- **Rich Results Test** on sample issue + sample guide.
- **SVG OG image:** some networks prefer raster; optional asset change if previews fail.
