/**
 * Shared helpers for rule-based intelligence engines (HA-INTELLIGENCE-1).
 */

import type {
  EvidenceUsedItem,
  IntelligenceConfidenceBand,
  IntelligenceEngineInput,
  IntelligenceExecutionMode,
  IntelligenceImageRef,
  IntelligenceReportFindingRef,
  IntelligenceSeverityBand,
} from "./types";

const FRONT_CATEGORIES = new Set([
  "preop_front",
  "current_front",
  "img_preop_front",
  "patient_current_front",
  "result_front",
  "postop_month12_front",
  "postop_month6_front",
  "postop_month3_front",
]);

const CROWN_CATEGORIES = new Set([
  "preop_crown",
  "preop_top",
  "current_crown",
  "current_top",
  "img_preop_crown",
  "img_preop_top",
  "patient_current_crown",
  "patient_current_top",
  "result_crown",
  "postop_month12_crown",
  "postop_month6_crown",
  "postop_month3_crown",
]);

const TEMPLE_CATEGORIES = new Set([
  "preop_left",
  "preop_right",
  "current_left",
  "current_right",
  "img_preop_left",
  "img_preop_right",
  "patient_current_left",
  "patient_current_right",
  "result_temples",
]);

const DONOR_CATEGORIES = new Set([
  "preop_donor_rear",
  "current_donor_rear",
  "patient_current_donor_rear",
  "img_preop_donor_rear",
  "img_preop_donor_sides",
  "donor_before",
  "donor_after",
  "donor_extraction",
  "day0_donor",
  "postop_healed_donor",
  "img_immediate_postop_donor",
  "img_followup_donor",
]);

const SURGICAL_CATEGORIES = new Set([
  "day0_recipient",
  "intraop",
  "postop_day0",
  "any_day0",
  "any_early_postop_day0_3",
  "img_immediate_postop_recipient",
  "img_intraop_extraction",
  "img_implantation_stage",
  "img_site_creation",
  "recipient_placement",
  "immediate_post_op",
]);

const GRAFT_HANDLING_CATEGORIES = new Set([
  "graft_tray_closeup",
  "graft_tray_overview",
  "img_graft_tray_closeup",
  "img_graft_tray_overview",
  "img_graft_inspection",
  "img_graft_microscopy",
  "graft_sorting",
  "graft_hydration_solution",
]);

const FOLLOWUP_CATEGORIES = new Set([
  "postop_healed",
  "postop_month12_front",
  "postop_month12_top",
  "postop_month12_crown",
  "postop_month6_front",
  "postop_month6_top",
  "postop_month6_crown",
  "result_front",
  "result_crown",
  "img_followup_front",
  "img_followup_top",
  "img_followup_crown",
]);

export function hasCategory(images: IntelligenceImageRef[], categories: Set<string>): boolean {
  return images.some((img) => categories.has(normalizeCategory(img.canonicalPhotoCategory)));
}

export function countCategory(images: IntelligenceImageRef[], categories: Set<string>): number {
  return images.filter((img) => categories.has(normalizeCategory(img.canonicalPhotoCategory))).length;
}

export function normalizeCategory(category: string): string {
  return String(category ?? "")
    .trim()
    .toLowerCase()
    .replace(/^patient_photo:/, "")
    .replace(/^doctor_photo:/, "")
    .replace(/^clinic_photo:/, "");
}

export function collectPhotoEvidence(
  images: IntelligenceImageRef[],
  categories: Set<string>,
  labelPrefix: string
): EvidenceUsedItem[] {
  const seen = new Set<string>();
  const items: EvidenceUsedItem[] = [];
  for (const img of images) {
    const cat = normalizeCategory(img.canonicalPhotoCategory);
    if (!categories.has(cat) || seen.has(cat)) continue;
    seen.add(cat);
    items.push({
      kind: "photo_category",
      ref: cat,
      label: `${labelPrefix}: ${cat.replace(/_/g, " ")}`,
      weight: 1,
    });
  }
  return items;
}

export function collectCoverageEvidence(
  ref: string,
  label: string,
  present: boolean
): EvidenceUsedItem | null {
  if (!present) return null;
  return { kind: "coverage", ref, label, weight: 0.5 };
}

export function matchReportFindings(
  findings: IntelligenceReportFindingRef[] | undefined,
  patterns: RegExp[]
): IntelligenceReportFindingRef[] {
  if (!findings?.length) return [];
  return findings.filter((f) => {
    const text = `${f.domain ?? ""} ${f.title}`.toLowerCase();
    return patterns.some((p) => p.test(text));
  });
}

export function findingsToEvidence(findings: IntelligenceReportFindingRef[]): EvidenceUsedItem[] {
  return findings.map((f, i) => ({
    kind: "report_finding" as const,
    ref: `finding_${i}_${slugRef(f.title)}`,
    label: f.title,
    weight: severityToWeight(f.severity),
  }));
}

function slugRef(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 40);
}

function severityToWeight(severity: IntelligenceReportFindingRef["severity"]): number {
  switch (severity) {
    case "critical":
      return 1;
    case "high":
      return 0.85;
    case "medium":
      return 0.6;
    case "low":
      return 0.35;
    default:
      return 0.5;
  }
}

export function maxSeverity(
  ...bands: IntelligenceSeverityBand[]
): IntelligenceSeverityBand {
  const order: IntelligenceSeverityBand[] = [
    "none",
    "minor",
    "moderate",
    "significant",
    "critical",
  ];
  let maxIdx = 0;
  for (const band of bands) {
    const idx = order.indexOf(band);
    if (idx > maxIdx) maxIdx = idx;
  }
  return order[maxIdx] ?? "none";
}

export function confidenceFromCoverage(
  evidenceCount: number,
  minForModerate: number,
  minForHigh: number
): IntelligenceConfidenceBand {
  if (evidenceCount <= 0) return "very_low";
  if (evidenceCount < minForModerate) return "low";
  if (evidenceCount < minForHigh) return "moderate";
  return "high";
}

export function downgradeConfidence(
  band: IntelligenceConfidenceBand,
  steps = 1
): IntelligenceConfidenceBand {
  const order: IntelligenceConfidenceBand[] = ["very_low", "low", "moderate", "high"];
  const idx = Math.max(0, order.indexOf(band) - steps);
  return order[idx] ?? "very_low";
}

export function hasLowQualityImages(images: IntelligenceImageRef[]): boolean {
  return images.some((img) => {
    const q = String(img.qualityStatus ?? "").toLowerCase();
    return q === "poor" || q === "unacceptable" || q === "low" || q === "fail";
  });
}

const PROTOCOL_GAP_STATUSES = new Set([
  "missing_view",
  "missing_required_view",
  "non_compliant",
  "major_deviation",
  "incomplete",
  "not_compliant",
]);

const SERIOUS_PROTOCOL_STATUSES = new Set([
  "major_deviation",
  "non_compliant",
  "serious_deviation",
]);

export function hasMissingProtocolViews(images: IntelligenceImageRef[]): boolean {
  return images.some((img) => {
    const protocol = String(img.protocolStatus ?? "").toLowerCase();
    if (!protocol) return false;
    return PROTOCOL_GAP_STATUSES.has(protocol) || protocol.includes("missing");
  });
}

export function hasStrongClassifierConfidence(images: IntelligenceImageRef[]): boolean {
  const confidences = images
    .map((img) => img.classifierConfidence)
    .filter((value): value is number => value != null && value > 0);
  if (!confidences.length) return false;
  const average = confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
  return average >= 0.75;
}

export function hasSeriousProtocolDeviations(images: IntelligenceImageRef[]): boolean {
  return images.some((img) =>
    SERIOUS_PROTOCOL_STATUSES.has(String(img.protocolStatus ?? "").toLowerCase())
  );
}

function cautiouslyElevateSeverity(
  severity: IntelligenceSeverityBand
): IntelligenceSeverityBand {
  const order: IntelligenceSeverityBand[] = [
    "none",
    "minor",
    "moderate",
    "significant",
    "critical",
  ];
  const idx = order.indexOf(severity);
  if (idx < 0 || idx >= order.length - 1) return severity;
  return order[idx + 1] ?? severity;
}

/** HA-INTELLIGENCE-4 — lightly adjust engine confidence/severity from classifier signals. */
export function refineEngineSignalsFromClassifier(args: {
  confidence: IntelligenceConfidenceBand;
  severity: IntelligenceSeverityBand;
  images: IntelligenceImageRef[];
}): { confidence: IntelligenceConfidenceBand; severity: IntelligenceSeverityBand } {
  let { confidence, severity } = args;

  if (hasMissingProtocolViews(args.images)) {
    confidence = downgradeConfidence(confidence);
  }
  if (hasStrongClassifierConfidence(args.images) && confidence === "low") {
    confidence = "moderate";
  }
  if (hasSeriousProtocolDeviations(args.images)) {
    severity = cautiouslyElevateSeverity(severity);
  }

  return { confidence, severity };
}

export function hasClassifierEnrichment(
  classifierByUploadId?: Record<string, Partial<IntelligenceImageRef>>
): boolean {
  if (!classifierByUploadId) return false;
  const NEUTRAL_QUALITY = new Set(["", "not_evaluated", "unknown"]);
  const NEUTRAL_PROTOCOL = new Set(["", "not_evaluated", "compliant", "unknown"]);
  return Object.values(classifierByUploadId).some((ref) => {
    if (!ref) return false;
    if (ref.classifierConfidence != null && ref.classifierConfidence > 0) return true;
    const quality = String(ref.qualityStatus ?? "").toLowerCase();
    if (quality && !NEUTRAL_QUALITY.has(quality)) return true;
    const protocol = String(ref.protocolStatus ?? "").toLowerCase();
    if (protocol && !NEUTRAL_PROTOCOL.has(protocol)) return true;
    if ((ref.imageLimitations?.length ?? 0) > 0) return true;
    if (ref.canonicalPhotoCategory) return true;
    return false;
  });
}

export function resolveExecutionMode(input: IntelligenceEngineInput): IntelligenceExecutionMode {
  if (input.metadata?.classifierEnriched === true) {
    return "classifier_enriched_rule_based";
  }
  return "rule_based_placeholder";
}

export function collectPerImageLimitations(images: IntelligenceImageRef[]): string[] {
  const limits: string[] = [];
  const seen = new Set<string>();
  for (const img of images) {
    for (const note of img.imageLimitations ?? []) {
      const trimmed = String(note ?? "").trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      limits.push(trimmed);
    }
  }
  return limits;
}

export function buildStandardLimitations(input: IntelligenceEngineInput): string[] {
  const limits: string[] = [
    "Assessment is based on uploaded images and available report notes only.",
    "This is not a medical diagnosis and should be reviewed by a qualified clinician.",
  ];
  if (!input.images.length) {
    limits.push("No clinical images were available for this review.");
  }
  if (hasLowQualityImages(input.images)) {
    limits.push("Image quality may limit interpretation of fine detail.");
  }
  for (const note of collectPerImageLimitations(input.images)) {
    limits.push(note);
  }
  return limits;
}

export function patientSafePrefix(): string {
  return "Based on the uploaded images, ";
}

export function patientSafeQualify(text: string): string {
  if (/^(this may suggest|based on|image quality|no clear|limited)/i.test(text.trim())) {
    return text;
  }
  return `This may suggest ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

export {
  FRONT_CATEGORIES,
  CROWN_CATEGORIES,
  TEMPLE_CATEGORIES,
  DONOR_CATEGORIES,
  SURGICAL_CATEGORIES,
  GRAFT_HANDLING_CATEGORIES,
  FOLLOWUP_CATEGORIES,
};
