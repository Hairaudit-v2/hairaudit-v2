# Report translation pipeline (Batch 9 — architecture only)

This document describes how **UI language**, **report/output language**, and **source language** are separated conceptually, what remains **English-only today**, and how multilingual audit delivery could evolve **without** the current Batch 9 groundwork touching live generators.

## What is translated today vs not

| Surface | Today | Notes |
|--------|--------|--------|
| App / marketing UI | `en` / `es` via `getTranslation`, profiles `preferred_language` | Batch 7+ product/marketing |
| Public page metadata | Locale from cookie + `Accept-Language` (Batch 8) | Not route-prefixed URLs |
| Audit report HTML body, findings narrative, AI-authored text | **English only** | Generation/finalize/PDF paths unchanged |
| PDF output | **English only** | No PDF string pipeline in Batch 9 |
| Rubric / `masterSurgicalMetadata` driven copy | **Untouched** | Clinical source of truth stays as implemented |

## Locale roles (code)

| Role | Type / helper | Meaning |
|------|----------------|--------|
| UI locale | `UiLocale`, `normalizeUiLocale` | Chrome the user interacts with; stored as `preferred_language` |
| Report output locale | `ReportOutputLocale`, `defaultReportOutputLocale`, `resolveReportOutputLocale` | Target language for **future** HTML/PDF patient-facing narratives |
| Source locale | `SourceContentLocale`, `REPORT_SOURCE_LOCALE_UNDETERMINED` | Language of submitted material when known; `"und"` if unknown |

See `src/lib/i18n/localeContexts.ts` and `REPORT_CONTENT_DEFAULT_LOCALE` in `src/lib/i18n/report.ts`.

## Future data model (not persisted yet)

`src/lib/i18n/reportTranslationBlueprint.ts` defines **blueprint** types only:

- `ReportTranslationStatus` — e.g. `none` → `pending` → `machine` → `human_reviewed` → `validated`
- `ReportTranslatedSectionId` — coarse sections (executive summary, findings, …)
- `ReportTranslationPlan` — `sourceLocale`, `targetLocale`, per-section review flags, provenance

Nothing in finalize, Inngest, or PDF builders reads this yet. Introducing DB columns or JSON should be a **separate, additive migration** with product sign-off.

## Glossary / terminology (config only)

`src/lib/i18n/reportTerminology.ts` maps stable slugs (e.g. `donorManagement`, `transection`) to **`reportGlossary.*`** keys in `en.json` / `es.json`. Use `getReportGlossaryLabel(slug, locale)` when building **new** report UI chrome (legends, tooltips)—**do not** wire into existing PDF or AI pipelines until translation is intentional.

## Planned stages for real report translation (future work)

1. **Report UI chrome** — headings, static labels, download buttons: extend dashboard/report components with `useI18n` / `getTranslation`, reuse `reportGlossary` where concepts must stay consistent.
2. **Structured report JSON + overlays** — store English canonical narrative; optional `ReportTranslationPlan` + translated blocks per section; render layer picks locale.
3. **AI-generated paragraphs** — offline or gated jobs that populate translated sections with `translationProvenance`; clinical review before `validated`.
4. **PDF** — separate template pass or post-process from structured translated HTML; keep one canonical English snapshot for compliance if required.
5. **Validation** — `human_reviewed` / `validated` flags in blueprint; block public release of non-validated clinical copy where policy requires it.

## Intentionally out of scope for Batch 9

- Changing scoring, prompts, or `masterSurgicalMetadata`
- Migrating database schema for translations (blueprint types are documentation-only)
- Calling `getReportGlossaryLabel` from PDF or auditor finalize paths

## Verification checklist after future wiring

- English remains default for report bodies until `report_output_locale` (or equivalent) is productized
- Fallback behavior matches `getTranslation` for any new keys
- PDF and API contracts versioned or feature-flagged when localized artifacts ship
