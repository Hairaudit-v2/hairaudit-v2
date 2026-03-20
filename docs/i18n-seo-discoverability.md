# i18n SEO and discoverability (Batch 8+)

This document describes how public-page metadata is localized today and how hreflang / canonical work could evolve **without** the current single-URL setup.

## Current behavior (Batch 8)

- **Keys:** `marketing.meta.*` in `en.json` / `es.json` (`home`, `howItWorks`, `professionals`, `sampleReport`).
- **Resolution:** `resolvePublicSeoLocale()` in `src/lib/seo/localeMetadata.ts`:
  1. Cookie `hairaudit.preferred_language` (same name as `LOCALE_STORAGE_KEY`), set from the client via `syncSeoLocaleCookie()` when the user picks a language or when a stored/profile preference loads.
  2. If absent or invalid, `Accept-Language` (first matching `es*` or `en*`).
  3. Default **English**.
- **Metadata:** `createLocalizedPageMetadata()` wraps `createPageMetadata()` with strings from `getTranslation()` (English fallback if a key is missing).
- **Pages:** Homepage, How it works, Professionals hub, Sample report use `generateMetadata()` with the helper above.

English default is unchanged when no cookie and no Spanish `Accept-Language` preference.

## Future: hreflang and localized canonicals

Today there is **no** per-locale URL segment; canonical in `createPageMetadata` remains the same pathname for all locales. Crawlers that only fetch the default HTML still see one URL per page.

When/if locale-specific URLs are introduced (e.g. `/es/how-it-works` or `?lang=es` with stable canonical policy):

1. **`metadataBase`:** Set in `app/layout.tsx` (or per-segment layouts) to the site origin so Open Graph/Twitter URLs can be absolute.
2. **`alternates.canonical`:** One preferred URL per page (usually the default-locale or “x-default” target).
3. **`alternates.languages`:** Map language tags (`en`, `es`, `x-default`) to **absolute** URLs for each published variant. Keep the set consistent (every locale lists all alternates).
4. **Sitemap:** Emit href entries per locale URL if those URLs exist.

A stub type `SeoAlternatesPlan` lives in `localeMetadata.ts` as a reminder of this shape; wiring should stay centralized next to `createPageMetadata` / `createLocalizedPageMetadata`.

## Future: OG/Twitter per locale

`createPageMetadata` already passes `title` and `description` into Open Graph and Twitter fields. Using `createLocalizedPageMetadata` automatically aligns social snippets with the resolved metadata locale. If locale-specific images or `siteName` overrides are needed later, extend `createPageMetadata` with optional overrides rather than duplicating metadata builders.

## Related files

- `src/lib/seo/localeMetadata.ts` — resolution + localized metadata
- `src/lib/seo/pageMetadata.ts` — base OG/Twitter/canonical shape
- `src/lib/i18n/syncSeoLocaleCookie.ts` — client cookie mirroring storage
