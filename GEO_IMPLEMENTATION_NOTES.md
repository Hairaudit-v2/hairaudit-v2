# GEO implementation notes (first pass)

This documents the first GEO-oriented pass completed in the codebase: answer-first structure, citation-friendly blocks, clearer page roles, and strengthened methodology/trust framing—without spammy SEO rewrites.

---

## Pages and components updated

### New shared components

| File | Purpose |
| --- | --- |
| `src/components/patient-education/GeoContentBlocks.tsx` | Reusable `GeoShortAnswer`, `GeoKeyTakeaways`, `GeoContextLine`, `GeoPhotosCannotConfirm`—subtle styling, optional `tone`, `aria-label` on regions |

### Templates

| File | Change |
| --- | --- |
| `src/components/patient-education/PatientIntentArticlePage.tsx` | Renders optional `article.shortAnswer` and `article.keyTakeaways` after intro (before “Next steps”) |
| `src/components/patient-education/IssueEducationPage.tsx` | Renders optional `shortAnswer`, `whatThisPageExplains`, `photosCannotConfirm` after intro; uses `PatientEducationLinkedText` where markdown links may appear |

### Types and data

| File | Change |
| --- | --- |
| `src/lib/seo/patient-intent-articles/types.ts` | `PatientIntentArticle` extended with optional `shortAnswer`, `keyTakeaways` |
| `src/lib/patientEducationIssues.ts` | `PatientIssueContent` extended with optional `shortAnswer`, `whatThisPageExplains`, `photosCannotConfirm`; copy added for graft failure, not growing, donor overharvested |

### Marketing / core routes

| File | Change |
| --- | --- |
| `src/app/methodology/page.tsx` | Added `GeoShortAnswer` (framework summary), `GeoContextLine` for clinic vs independent + photo limits with internal links; replaced generic closing copy with methodology-specific links (guides hub, how-it-works)—removed duplicate “many patients only realise…” line that also appeared on request-review |
| `src/app/request-review/page.tsx` | Added `GeoContextLine` (“what this page is for” vs guides/methodology) and `GeoShortAnswer` (submission outcome, limits) |

### Long-form guides (article modules)

Optional `shortAnswer` + `keyTakeaways` added to:

- `src/lib/seo/patient-intent-articles/shock-loss-vs-graft-failure.ts`
- `src/lib/seo/patient-intent-articles/hair-transplant-second-opinion-vs-clinic-opinion.ts`
- `src/lib/seo/patient-intent-articles/hair-transplant-graft-failure-what-photos-can-and-cannot-show.ts`
- `src/lib/seo/patient-intent-articles/normal-donor-healing-after-fue.ts`
- `src/lib/seo/patient-intent-articles/hair-transplant-density-too-low.ts`
- `src/lib/seo/patient-intent-articles/when-is-hair-transplant-growth-delay-normal-vs-concerning.ts`
- `src/lib/seo/patient-intent-articles/repair-vs-wait-after-poor-hair-transplant-growth.ts`

---

## GEO patterns introduced

- **Short answer** — One compact block after the intro for extractable, quotable framing.
- **Key takeaways** — Bulleted lift-out on long-form guides; includes internal links where useful.
- **What this page helps explain** — On selected issue pages, clarifies short landing vs deep guides (reduces duplicate intent).
- **What photos alone cannot confirm** — Bullet list on high-stakes issue pages (graft failure, growth, donor).
- **Page role callouts** — Request-review explicitly points education to `/hair-transplant-problems` and framework to `/methodology`.
- **Methodology trust** — Explicit “clinic vs independent” and “what photos cannot replace” with links to canonical scope articles.

---

## Page-role distinctions preserved

- **Request-review** is labeled as conversion/submission; guides and methodology are linked out.
- **Methodology** ends with framework/process links, not patient-anxiety duplicate of request-review.
- **Issue pages** remain short overviews; long answers stay in article modules.
- **Guides** gain extractable blocks but keep existing section structure and CTAs.

---

## Overlap risks still remaining

- **Issue pages without new optional fields** (`hair-transplant-too-thin`, `bad-hair-transplant-hairline`) still rely on intro + sections only; could gain the same optional pattern later.
- **Many article modules** do not yet have `shortAnswer` / `keyTakeaways`; extraction quality varies by page.
- **Sample report** is largely i18n-driven (`SampleReportMarketing`); no GEO block added in this pass to avoid partial-locale inconsistency.
- **Homepage** unchanged (i18n + SEO sensitivity); any hero tweak should go through locale files with care.
- **FAQ** unchanged; still the right place for logistics—avoid duplicating long-form guide paragraphs there.

---

## Next recommended GEO expansion

1. Add optional GEO fields to remaining issue entries in `patientEducationIssues.ts`.
2. Add `shortAnswer` / `keyTakeaways` to scope articles: `what-an-independent-hair-transplant-audit-can-and-cannot-do`, `can-a-hair-transplant-be-audited-from-photos`, `when-should-you-seek-an-independent-hair-transplant-review`.
3. Consider a localized one-line “proof-of-output” strip on sample report (all supported locales).
4. Optional: enrich `Article` JSON-LD with `abstract`/`description` aligned to `shortAnswer` where it does not conflict with existing schema strategy.

---

## Verification

- `npm run build` completed successfully after these changes.
