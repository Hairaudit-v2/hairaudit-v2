/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — Patient-safe projection report copy.
 * Forbidden certainty / guarantee language must never appear.
 */

import type { PreSurgeryProjectionMode } from "./types";

/** Section title (web + PDF). Planning composite — not ImagingOS Projected Outcome. */
export const ILLUSTRATIVE_PROJECTED_RESULT_TITLE = "Illustrative Surgery Plan";

export const ILLUSTRATIVE_PROJECTED_RESULT_INTRO =
  "This planning illustration shows the proposed hairline and treatment zones. It is not a guarantee or photorealistic prediction of the final result.";

export const ILLUSTRATIVE_PROJECTED_RESULT_LIMITATION_PANEL =
  "Important: This image is an educational planning illustration showing proposed hairline and treatment zones. Actual growth, density, hair direction, calibre, healing and appearance vary between patients. Final design and graft allocation require an in-person assessment and agreement with the treating clinician.";

export const PROJECTION_NOT_INCLUDED_EXPLANATION =
  "An Illustrative Surgery Plan image is not included in this review. Planning scores, graft ranges and suitability guidance above remain valid.";

export const PROJECTION_WITHHELD_EVIDENCE_EXPLANATION =
  "An Illustrative Surgery Plan visual was not included because of evidence limitations in the submitted photographs or clinical inputs. Planning guidance in this report remains based on the reviewed findings.";

export const PROJECTION_ASSET_FALLBACK_NOTICE =
  "The Illustrative Surgery Plan image could not be retrieved for this export. Snapshot identifiers and planning details below remain valid; the visual comparison is omitted.";

/** Ticket wording mapped onto existing governed modes (planned ≈ balanced). */
export const REPORT_PLANNING_MODE_LABELS: Record<PreSurgeryProjectionMode, string> = {
  conservative: "Illustrative Surgery Plan scenario: Conservative",
  planned: "Illustrative Surgery Plan scenario: Balanced",
  optimistic_within_approved_range: "Illustrative Surgery Plan scenario: Maximum visual coverage",
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
