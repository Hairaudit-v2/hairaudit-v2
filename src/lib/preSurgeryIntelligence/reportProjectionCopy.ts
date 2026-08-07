/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A / PHOTOREALISTIC-OUTCOME-2A — Patient-safe projection report copy.
 * Forbidden certainty / guarantee language must never appear.
 * Patient section shows only approved Illustrative Projected Outcome — never Graft Allocation Maps.
 */

import type { PreSurgeryProjectionMode } from "./types";
import { ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER } from "./projection/artifactTypes";

/** Section title (web + PDF) — only when a true projected-outcome artifact is approved. */
export const ILLUSTRATIVE_PROJECTED_RESULT_TITLE = "Illustrative Projected Outcome";

export const ILLUSTRATIVE_PROJECTED_RESULT_INTRO = ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER;

export const ILLUSTRATIVE_PROJECTED_RESULT_LIMITATION_PANEL = ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER;

export const PROJECTION_NOT_INCLUDED_EXPLANATION =
  "An Illustrative Projected Outcome image is not included in this review. Planning scores, graft ranges and suitability guidance above remain valid. A Graft Allocation Map may exist for clinical planning but is not shown here.";

export const PROJECTION_WITHHELD_EVIDENCE_EXPLANATION =
  "An Illustrative Projected Outcome visual was not included because of evidence limitations in the submitted photographs or clinical inputs. Planning guidance in this report remains based on the reviewed findings.";

export const PROJECTION_ASSET_FALLBACK_NOTICE =
  "The Illustrative Projected Outcome image could not be retrieved for this export. Snapshot identifiers and planning details below remain valid; the visual comparison is omitted.";

/** Ticket wording mapped onto existing governed modes (planned ≈ balanced). */
export const REPORT_PLANNING_MODE_LABELS: Record<PreSurgeryProjectionMode, string> = {
  conservative: "Illustrative Projected Outcome scenario: Conservative",
  planned: "Illustrative Projected Outcome scenario: Planned",
  optimistic_within_approved_range: "Illustrative Projected Outcome scenario: Optimistic",
};

/** Case-specific limitation codes surfaced in patient copy. */
export const CASE_SPECIFIC_LIMITATION_COPY = {
  insufficient_donor_measurement:
    "Donor capacity was not fully measurable from the submitted images; graft ranges remain provisional.",
  diffuse_thinning:
    "Diffuse thinning patterns limit how reliably coverage can be illustrated from photographs alone.",
  progression_uncertainty:
    "Future progression remains uncertain; this planning visual assumes stabilisation where clinically appropriate.",
  deferred_crown_coverage:
    "Crown coverage was deferred in this plan and is not illustrated as restored density.",
  treatment_stabilisation_requirement:
    "This illustration assumes medical stabilisation is completed before any surgical plan proceeds.",
  image_quality_limitations:
    "Image-quality limitations reduce how precisely coverage and hairline geometry can be illustrated.",
  provisional_graft_range:
    "The graft range shown is provisional and subject to in-person donor measurement.",
  hair_calibre_yield_unreliable:
    "Hair calibre and growth yield cannot be modelled reliably from this illustration.",
} as const;

export type CaseSpecificLimitationCode = keyof typeof CASE_SPECIFIC_LIMITATION_COPY;

/** Patterns that must never appear in patient-facing projection copy. */
export const FORBIDDEN_PROJECTION_REPORT_LANGUAGE = [
  /\bguaranteed result\b/i,
  /\bexpected result\b/i,
  /\bexact outcome\b/i,
  /\bpredicted final result\b/i,
  /\bthis is how you will look\b/i,
  /\bguaranteed density\b/i,
  /\bguaranteed graft survival\b/i,
  /\bexpected exact result\b/i,
  /\bpredicted result\b/i,
] as const;

export function findForbiddenProjectionReportLanguage(text: string): string | null {
  for (const pattern of FORBIDDEN_PROJECTION_REPORT_LANGUAGE) {
    if (pattern.test(text)) return pattern.source;
  }
  return null;
}

export function assertPatientSafeProjectionCopy(texts: string[]): void {
  for (const text of texts) {
    const hit = findForbiddenProjectionReportLanguage(text);
    if (hit) {
      throw new Error(`Forbidden projection report language matched: ${hit}`);
    }
  }
}
