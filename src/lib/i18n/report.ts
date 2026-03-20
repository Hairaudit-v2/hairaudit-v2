/**
 * Audit report **generated bodies** (findings, AI narrative, rubric-fed copy) stay English-only
 * until a dedicated report-output pipeline exists.
 *
 * @see `localeContexts.ts` — UI locale vs report-output locale vs source locale
 * @see `reportTranslationBlueprint.ts` — future persisted translation metadata shape
 * @see `docs/i18n-translated-narrative-contract.md` — future translated narrative lifecycle/storage contract
 * @see `reportTerminology.ts` — controlled glossary labels (not wired into PDF/HTML output yet)
 * @see `docs/i18n-report-translation-pipeline.md`
 */
export const REPORT_CONTENT_DEFAULT_LOCALE = "en" as const;
