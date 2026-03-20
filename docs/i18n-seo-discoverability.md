# i18n SEO and discoverability (Batch 8 + Batch 18 groundwork)

This document describes how public-page metadata is localized today and how locale routing, `hreflang`, and canonical policy can evolve **without** breaking the current single-URL public setup.

## Current behavior

- **Keys:** `marketing.meta.*` in `en.json` / `es.json` (`home`, `howItWorks`, `professionals`, `sampleReport`).
- **Resolution:** `resolvePublicSeoLocale()` in `src/lib/seo/localeMetadata.ts`:
  1. Cookie `hairaudit.preferred_language` (same name as `LOCALE_STORAGE_KEY`), set from the client via `syncSeoLocaleCookie()` when the user picks a language or when a stored/profile preference loads.
  2. If absent or invalid, `Accept-Language` (first matching `es*` or `en*`).
  3. Default **English**.
- **Metadata:** `createLocalizedPageMetadata()` wraps `createPageMetadata()` with strings from `getTranslation()` (English fallback if a key is missing).
- **Pages:** Homepage, How it works, Professionals hub, Sample report use `generateMetadata()` with the helper above.
- **Canonical:** still the unprefixed page pathname (for example `/how-it-works`).
- **`hreflang`:** intentionally **not emitted** today because public locale-distinct URLs do not yet exist.

English default is unchanged when no cookie and no Spanish `Accept-Language` preference.

## Batch 18 routing groundwork

`src/lib/seo/publicLocaleRouting.ts` centralizes the future public-locale URL contract:

- `LOCALIZED_PUBLIC_PATHNAMES` lists the public pages already localized enough to participate in future locale-aware SEO
- `createPublicLocaleRoutingPlan(...)` defines canonical locale, route strategy, and whether locale-distinct URLs are actually published
- `buildLocalizedPublicPathname(...)` defines the future path shape for a prefix-based rollout (`/es/...`, English unprefixed)
- `buildPublicLocaleLanguageAlternates(...)` returns `undefined` unless locale-distinct URLs are explicitly marked ready

This is additive groundwork only. The current runtime still behaves as a single-URL public site.

## Canonical rules

Current rule set:

- English is the canonical baseline
- canonical stays on the current unprefixed public URL
- locale cookies and `Accept-Language` may localize metadata text, but they do not create a new canonical URL
- localized metadata must not imply that a distinct Spanish page URL exists when it does not

Future rule set once locale-distinct public routes are live:

1. Keep English as the default canonical baseline unless product/SEO policy explicitly changes.
2. Emit `alternates.languages` only for truly published locale URLs.
3. Include a consistent full set of alternates for each published locale plus `x-default`.
4. Keep one canonical per logical page; do not make cookie-driven variants self-canonical.

## Future route strategy

Today there is **no** per-locale URL segment; canonical in `createPageMetadata` remains the same pathname for all locales. Crawlers that only fetch the default HTML still see one URL per page.

The Batch 18 helper is designed around a safe future strategy:

- English route remains unprefixed: `/how-it-works`
- Spanish route becomes prefixed: `/es/how-it-works`
- Homepage becomes `/` for English and `/es` for Spanish
- report pages, PDFs, AI narratives, and gated product routes are out of scope here

When/if locale-specific URLs are introduced:

1. **`metadataBase`:** Set in `app/layout.tsx` (or per-segment layouts) to the site origin so Open Graph/Twitter URLs can be absolute.
2. **`alternates.canonical`:** One preferred URL per page (usually the default-locale or “x-default” target).
3. **`alternates.languages`:** Map language tags (`en`, `es`, `x-default`) to **absolute** URLs for each published variant. Keep the set consistent (every locale lists all alternates).
4. **Sitemap:** Emit href entries per locale URL if those URLs exist.

Wiring should stay centralized next to `createPageMetadata` / `createLocalizedPageMetadata` so route policy does not drift page-by-page.

## Future: OG/Twitter per locale

`createPageMetadata` already passes `title` and `description` into Open Graph and Twitter fields. Using `createLocalizedPageMetadata` automatically aligns social snippets with the resolved metadata locale. If locale-specific images or `siteName` overrides are needed later, extend `createPageMetadata` with optional overrides rather than duplicating metadata builders.

## Rollout risks and migration notes

- Do not emit `hreflang` for cookie-only or header-only localized experiences.
- Do not point canonical to a locale-prefixed URL until that endpoint is publicly routable and stable.
- Do not mix route strategies on a page-by-page basis; keep the mapping centralized.
- If locale-prefixed routes are later introduced, update sitemap generation in the same rollout.
- Verify that middleware, caching, and analytics treat `/foo` and `/es/foo` as distinct public URLs before turning on alternates.

## Related files

- `src/lib/seo/localeMetadata.ts` — resolution + localized metadata
- `src/lib/seo/pageMetadata.ts` — base OG/Twitter/canonical shape
- `src/lib/seo/publicLocaleRouting.ts` — additive future route / alternates mapping
- `src/lib/i18n/syncSeoLocaleCookie.ts` — client cookie mirroring storage
