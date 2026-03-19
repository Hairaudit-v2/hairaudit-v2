/**
 * Audit report bodies stay English-only in this phase.
 * Future: separate translation layer (e.g. AI-assisted) can render from stored report JSON
 * without changing generation pipelines.
 */
export const REPORT_CONTENT_DEFAULT_LOCALE = "en" as const;
