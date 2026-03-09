/**
 * Visibility-safe handling for auditor notes and section feedback.
 * - internal_only: never in patient report or clinic-facing views
 * - included_in_report: only in final patient-facing report
 * - included_in_clinic_feedback: only in clinic-facing feedback exports/views
 */

export const VISIBILITY_SCOPES = ["internal_only", "included_in_report", "included_in_clinic_feedback"] as const;
export type VisibilityScope = (typeof VISIBILITY_SCOPES)[number];

export type OverrideRowWithVisibility = {
  domain_key: string;
  ai_score: number;
  ai_weighted_score: number | null;
  manual_score: number;
  manual_weighted_score: number | null;
  delta_score: number;
  override_note: string | null;
  visibility_scope?: string | null;
  [k: string]: unknown;
};

export type SectionFeedbackRow = {
  section_key: string;
  feedback_note: string;
  visibility_scope?: string | null;
  feedback_type?: string | null;
  [k: string]: unknown;
};

/** Overrides that may be shown in the final patient-facing report (score application uses all overrides; this is for notes). */
export function filterReportVisibleOverrides(overrides: OverrideRowWithVisibility[]): OverrideRowWithVisibility[] {
  return overrides.filter((o) => o.visibility_scope === "included_in_report");
}

/** Overrides that may be shown in clinic-facing feedback. */
export function filterClinicVisibleOverrides(overrides: OverrideRowWithVisibility[]): OverrideRowWithVisibility[] {
  return overrides.filter((o) => o.visibility_scope === "included_in_clinic_feedback");
}

/** Section feedback that may be shown in the final patient-facing report. */
export function filterReportVisibleSectionFeedback(feedback: SectionFeedbackRow[]): SectionFeedbackRow[] {
  return feedback.filter((f) => f.visibility_scope === "included_in_report");
}

/** Section feedback that may be shown in clinic-facing views. */
export function filterClinicVisibleSectionFeedback(feedback: SectionFeedbackRow[]): SectionFeedbackRow[] {
  return feedback.filter((f) => f.visibility_scope === "included_in_clinic_feedback");
}

const DOMAIN_TITLES: Record<string, string> = {
  SP: "Surgical Planning",
  DP: "Donor & Planning",
  GV: "Graft Viability",
  IC: "Implant & Closure",
  DI: "Documentation Integrity",
};

/**
 * Build concise "Auditor Change Summary" lines for the final report, only from report-visible overrides with a note.
 * One line per domain, e.g. "Surgical Planning score moderated after expert review due to incomplete planning documentation."
 */
export function buildAuditorChangeSummaryLines(
  reportVisibleOverrides: OverrideRowWithVisibility[]
): string[] {
  const lines: string[] = [];
  for (const o of reportVisibleOverrides) {
    const note = typeof o.override_note === "string" ? o.override_note.trim() : "";
    const domainTitle = DOMAIN_TITLES[o.domain_key] ?? o.domain_key;
    const delta = typeof o.manual_score === "number" && typeof o.ai_score === "number"
      ? o.manual_score - o.ai_score
      : null;
    const direction = delta != null && delta < 0 ? "moderated" : delta != null && delta > 0 ? "adjusted upward" : "adjusted";
    const suffix = note ? (note.length > 160 ? ` ${note.slice(0, 160)}…` : ` ${note}`) : "";
    lines.push(`${domainTitle} score ${direction} after expert review.${suffix}`);
  }
  return lines;
}

/** Default section_key -> domain_key for grouping report-visible feedback into domain notes. */
export const SECTION_TO_DOMAIN: Record<string, string> = {
  hairline_design: "IC",
  donor_management: "DP",
  extraction_quality: "GV",
  recipient_placement: "IC",
  density_distribution: "IC",
  graft_handling: "GV",
  documentation_integrity: "DI",
  healing_aftercare: "IC",
  benchmark_eligibility: "DI",
};

/** Build auditor note text for a domain: override note (if report-visible) plus report-visible section feedback for that domain. */
export function buildAuditorNoteForDomain(
  domainKey: string,
  reportVisibleOverrides: OverrideRowWithVisibility[],
  reportVisibleFeedback: SectionFeedbackRow[]
): string {
  const parts: string[] = [];
  const ov = reportVisibleOverrides.find((o) => o.domain_key === domainKey);
  const note = typeof ov?.override_note === "string" ? ov.override_note.trim() : "";
  if (note) parts.push(note);
  for (const f of reportVisibleFeedback) {
    if (SECTION_TO_DOMAIN[f.section_key] === domainKey && f.feedback_note?.trim()) {
      parts.push(f.feedback_note.trim());
    }
  }
  return parts.join(" ");
}
