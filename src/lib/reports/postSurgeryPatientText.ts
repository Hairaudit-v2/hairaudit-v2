/**
 * HA-FIX-8I — Patient-safe text helpers for post-surgery audit PDF reports.
 */

import type { HairAuditIntelligenceBundle } from "@/lib/hairaudit-intelligence/types";
import type { PostSurgeryRepairConsiderationId } from "./postSurgeryAuditReport";

/** Premium image-limited notice for page 1 of post-surgery PDF. */
export const POST_SURGERY_IMAGE_LIMITED_NOTICE =
  "Enhanced image-limited review: This report was prepared using the submitted images, supporting documentation, and clinician-entered clinical context available at the time of review. Some standard photo views were not available, so image-based interpretation is limited in those areas.";

export const PROCEDURAL_DETAILS_UNAVAILABLE =
  "Some procedural handling details could not be confirmed from the submitted materials.";

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /rule-based placeholder/gi,
  /\bnone_suggested\b/gi,
  /await extraction pattern review/gi,
  /imagingos/gi,
  /procedural intelligence\s*\(/gi,
  /donor intelligence\s*\(/gi,
  /repair surgery intelligence\s*\(/gi,
  /forensic hair-loss classification/gi,
  /graft integrity signals from/gi,
];

const INTERNAL_ENUM_FRAGMENT = /\b[a-z]+_[a-z_]+\b/g;

export function sanitizePatientReportText(text: string): string {
  let out = text.trim();
  if (!out) return out;

  for (const pattern of PLACEHOLDER_PATTERNS) {
    out = out.replace(pattern, "").trim();
  }

  if (!out) {
    return PROCEDURAL_DETAILS_UNAVAILABLE;
  }

  if (/\bnone_suggested\b/i.test(out) || /\bnot_assessable\b/i.test(out)) {
    return PROCEDURAL_DETAILS_UNAVAILABLE;
  }

  if (/rule-based placeholder|await extraction pattern review|imagingos/i.test(out)) {
    return PROCEDURAL_DETAILS_UNAVAILABLE;
  }

  out = out
    .replace(/Based on the uploaded images,\s*This may suggest/gi, "The submitted images suggest")
    .replace(/Based on the uploaded images,\s*this may suggest/gi, "The submitted images suggest")
    .replace(/Based on your uploaded images,\s*This may suggest/gi, "The submitted images suggest")
    .replace(/Based on your uploaded images,\s*this may suggest/gi, "The submitted images suggest")
    .replace(/Based on the uploaded images,/gi, "From the available views,")
    .replace(/Based on your uploaded images,/gi, "From the available views,")
    .replace(/\s{2,}/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();

  if (INTERNAL_ENUM_FRAGMENT.test(out) && out.split(" ").some((w) => w.includes("_"))) {
    return PROCEDURAL_DETAILS_UNAVAILABLE;
  }

  return out;
}

export function buildRepairPlanningGuidance(
  bundle: HairAuditIntelligenceBundle | null | undefined,
  repairId: PostSurgeryRepairConsiderationId
): string[] {
  const donorRisk = bundle?.donorIntelligence?.fields?.donorReserveRisk;
  const overharvest = bundle?.repairSurgery?.fields?.overharvestingIndicators;
  const depletion = bundle?.repairSurgery?.fields?.donorDepletion;

  const lines: string[] = [];

  if (donorRisk === "elevated" || overharvest === "likely" || depletion === "likely") {
    lines.push(
      "Based on available information, donor reserve may be limited — careful assessment is advised before any further extraction."
    );
  } else if (donorRisk === "moderate" || overharvest === "possible" || depletion === "possible") {
    lines.push(
      "Donor reserve appears moderately constrained — donor mapping and graft budgeting should be completed before planning further surgery."
    );
  } else {
    lines.push(
      "If repair is being considered, confirm donor reserve adequacy through in-person donor mapping before committing to additional extraction."
    );
  }

  lines.push(
    "Before any repair procedure, request donor mapping, scar and depletion review, and a realistic graft budget aligned to your goals.",
    "Density expectations should be discussed openly — refinement often prioritises natural appearance and donor preservation over maximum density.",
    "If donor depletion or visible scarring is suspected, exercise caution around further extraction until reserve is formally assessed."
  );

  if (repairId === "significant_planning" || repairId === "moderate_consultation") {
    lines.push(
      "A repair-focused consultation with an experienced clinician can help clarify whether refinement, camouflage, or staged planning is most appropriate."
    );
  }

  return lines;
}

export function buildPostSurgeryRecommendedNextSteps(
  repairId: PostSurgeryRepairConsiderationId
): string[] {
  const steps = [
    "Save this report for your treating clinician and bring it to your next follow-up.",
    "Continue documenting progress with monthly photos in consistent lighting.",
    "Ask your clinician to review donor reserve before any further extraction is considered.",
    "If considering repair, request donor mapping and graft budget planning.",
    "Discuss medical support options with your clinician if ongoing thinning is present.",
    "Seek prompt medical advice if you notice increasing redness, pain, swelling, discharge, or signs of infection.",
  ];

  if (repairId === "moderate_consultation") {
    steps.push("Consider a repair-focused consultation to discuss refinement options and timing.");
  }
  if (repairId === "significant_planning") {
    steps.push(
      "Significant repair planning may be beneficial — prioritise donor preservation in any further procedure discussion."
    );
  }

  return [...new Set(steps)];
}

type SectionFindingInput = {
  sectionTitle: string;
  reviewed: string;
  observed: string;
  meaning: string;
  nextCheck: string;
};

export function buildStructuredSectionFinding(input: SectionFindingInput): string {
  return sanitizePatientReportText(
    `${input.reviewed} ${input.observed} ${input.meaning} ${input.nextCheck}`
  );
}

export function enrichSectionFinding(
  rawFinding: string,
  fallback: SectionFindingInput
): string {
  const cleaned = sanitizePatientReportText(rawFinding);
  if (!cleaned || cleaned === PROCEDURAL_DETAILS_UNAVAILABLE) {
    return buildStructuredSectionFinding(fallback);
  }
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length >= 2) return cleaned;
  return buildStructuredSectionFinding({
    ...fallback,
    observed: cleaned.endsWith(".") ? cleaned : `${cleaned}.`,
  });
}
