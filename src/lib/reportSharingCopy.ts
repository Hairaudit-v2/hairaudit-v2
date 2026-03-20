/**
 * Copy for report access and sharing (UI only; no backend sharing logic).
 * Prefer `reports.actions.useHintContext` via i18n for localizable chrome (Batch 10+).
 */

/** @deprecated Use `reports.actions.useHintContext` + `getTranslation` / `useI18n`. */
export const REPORT_USE_HINT =
  "You can share this report with your clinic or specialist.";

/** @deprecated Use `reports.actions.useHintContext` + `getTranslation` / `useI18n`. */
export const REPORT_USE_HINT_CONTEXT =
  "This report can support consultation or follow-up decisions.";
