/**
 * HA-PROJECTION-1C — Patient-safe section helpers for surgery-day projection reports.
 *
 * Consumes canonical 1A / 1B shapes only. Does not query uploads or forensic payloads.
 */

import type {
  ObservedFeature,
  ProjectionConfidence,
  ProvenancedNumber,
  ReconstructionConfidence,
  RecipientZone,
  SurgeryDayEvidenceRole,
  SurgeryDayProcedureReconstruction,
  SurgeryDayProjectedOutcome,
} from "@/lib/projection/types";
import { uniqueNormalizedZones, normalizeZoneList } from "@/lib/projection/surgeryDayZones";

export type ConfidenceDisplay = "Low" | "Moderate" | "High";

export type PatientFriendlyEvidenceRole =
  | "Preoperative front"
  | "Preoperative left"
  | "Preoperative right"
  | "Preoperative top"
  | "Preoperative crown"
  | "Preoperative donor"
  | "Preoperative hairline close-up"
  | "Surgery-day recipient"
  | "Surgery-day donor"
  | "Hairline design"
  | "Site-creation evidence"
  | "Implantation evidence"
  | "Procedure records";

export type ProcedureContextField = {
  label: string;
  value: string;
  provenanceNote?: string;
};

export type TreatmentAreaRow = {
  zoneLabel: string;
  stateLabel: string;
};

export type ObservedTodayBlock = {
  id: string;
  title: string;
  observation: string;
  confidence?: ConfidenceDisplay;
};

export type GraftEvidenceDisplay = {
  procedureRecords: Array<{ label: string; value: string; source?: string }>;
  imageDerivedEstimate: {
    rangeLabel: string;
    confidence: ConfidenceDisplay;
  } | null;
  conflictNote: string | null;
};

export type BiologicalTimelineStage = {
  period: string;
  description: string;
};

export type FutureComparisonMilestone = {
  label: string;
  description: string;
};

export type ProjectionImageGroupId =
  | "preoperative_baseline"
  | "surgery_day_recipient"
  | "surgery_day_donor"
  | "hairline_design"
  | "implantation_evidence";

export type ProjectionImageGroup = {
  id: ProjectionImageGroupId;
  title: string;
  images: Array<{ url: string; label: string }>;
};

const EVIDENCE_ROLE_LABELS: Record<SurgeryDayEvidenceRole, PatientFriendlyEvidenceRole> = {
  preop_front: "Preoperative front",
  preop_left: "Preoperative left",
  preop_right: "Preoperative right",
  preop_top: "Preoperative top",
  preop_crown: "Preoperative crown",
  preop_donor: "Preoperative donor",
  preop_hairline_closeup: "Preoperative hairline close-up",
  surgery_day_recipient: "Surgery-day recipient",
  surgery_day_donor: "Surgery-day donor",
  surgery_day_design: "Hairline design",
  surgery_day_site_creation: "Site-creation evidence",
  surgery_day_implantation: "Implantation evidence",
  surgery_day_graft_evidence: "Procedure records",
};

const ZONE_LABELS: Record<RecipientZone, string> = {
  hairline: "Hairline",
  temples: "Temples",
  frontal: "Frontal",
  forelock: "Forelock",
  mid_scalp: "Mid-scalp",
  crown: "Crown",
  other: "Other",
};

const DISPLAY_ZONE_ORDER: RecipientZone[] = [
  "hairline",
  "temples",
  "frontal",
  "forelock",
  "mid_scalp",
  "crown",
];

const IMAGE_GROUP_CATEGORY_HINTS: Record<ProjectionImageGroupId, RegExp[]> = {
  preoperative_baseline: [/preop_/i, /pre[-_]?op/i, /baseline/i],
  surgery_day_recipient: [/day0_recipient/i, /immediate_postop_recipient/i, /postop_recipient/i],
  surgery_day_donor: [/day0_donor/i, /immediate_postop_donor/i, /postop_donor/i],
  hairline_design: [/marking_design/i, /hairline_design/i, /design/i],
  implantation_evidence: [/implantation/i, /intraop_/i, /site_creation/i],
};

const IMAGE_GROUP_TITLES: Record<ProjectionImageGroupId, string> = {
  preoperative_baseline: "Preoperative baseline",
  surgery_day_recipient: "Surgery-day recipient",
  surgery_day_donor: "Surgery-day donor",
  hairline_design: "Hairline design",
  implantation_evidence: "Implantation / intraoperative evidence",
};

export const PROJECTION_CONFIDENCE_EXPLANATION =
  "Projection confidence reflects the completeness and quality of available evidence, not the probability of a successful transplant.";

export const DONOR_MATURE_APPEARANCE_NOTE =
  "Final donor appearance cannot be assessed from immediate postoperative images.";

export const CLINICAL_DISCLAIMER =
  "This projected analysis is an independent educational review based on surgery-day evidence available at the time of assessment. It is not a medical diagnosis or treatment plan, and it does not confirm a final clinical result. Discuss healing concerns and ongoing care with your treating clinic.";

export function formatConfidenceLabel(
  value: ReconstructionConfidence | ProjectionConfidence | string
): ConfidenceDisplay {
  const v = String(value ?? "").toLowerCase();
  if (v === "high") return "High";
  if (v === "moderate" || v === "medium") return "Moderate";
  return "Low";
}

export function patientFriendlyEvidenceRoles(
  roles: SurgeryDayEvidenceRole[]
): PatientFriendlyEvidenceRole[] {
  const out: PatientFriendlyEvidenceRole[] = [];
  const seen = new Set<PatientFriendlyEvidenceRole>();
  for (const role of roles) {
    const label = EVIDENCE_ROLE_LABELS[role];
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString("en-US") : String(n);
}

function provenanceSourceLabel(source: ProvenancedNumber["source"]): string {
  switch (source) {
    case "clinic_reported":
      return "Clinic record";
    case "auditor_confirmed":
      return "Auditor-confirmed record";
    case "patient_reported":
      return "Patient-reported";
    case "ai_estimated":
      return "Image-derived estimate";
    default:
      return "Recorded value";
  }
}

export function buildProcedureContextFields(
  reconstruction: SurgeryDayProcedureReconstruction
): ProcedureContextField[] {
  const ctx = reconstruction.procedureContext;
  const fields: ProcedureContextField[] = [];

  if (ctx.procedureDate) {
    fields.push({ label: "Procedure date", value: ctx.procedureDate });
  }
  if (ctx.procedureType) {
    fields.push({ label: "Procedure type", value: ctx.procedureType });
  }

  // Keep graft counts separate — never average conflicting sources.
  const clinic = reconstruction.graftEvidence.clinicReportedCount ?? ctx.actualGraftCount ?? ctx.reportedGraftCount;
  if (clinic != null && Number.isFinite(clinic)) {
    fields.push({
      label: "Clinic-reported graft count",
      value: formatNumber(clinic),
      provenanceNote: "Source: Clinic record",
    });
  }

  const patientReported = reconstruction.graftEvidence.provenance.find(
    (p) => p.source === "patient_reported"
  );
  if (patientReported && Number.isFinite(patientReported.value)) {
    const sameAsClinic = clinic != null && patientReported.value === clinic;
    if (!sameAsClinic) {
      fields.push({
        label: "Patient-reported graft count",
        value: `approximately ${formatNumber(patientReported.value)}`,
        provenanceNote: "Source: Patient-reported",
      });
    }
  }

  if (ctx.estimatedHairCount != null && Number.isFinite(ctx.estimatedHairCount)) {
    fields.push({
      label: "Estimated hair count",
      value: formatNumber(ctx.estimatedHairCount),
    });
  }
  if (ctx.averageHairsPerGraft != null && Number.isFinite(ctx.averageHairsPerGraft)) {
    fields.push({
      label: "Average hairs per graft",
      value: String(ctx.averageHairsPerGraft),
    });
  }
  if (ctx.punchSizeMm != null && Number.isFinite(ctx.punchSizeMm)) {
    fields.push({
      label: "Punch size",
      value: `${ctx.punchSizeMm} mm`,
    });
  }
  if (ctx.extractionMethod) {
    fields.push({ label: "Extraction method", value: ctx.extractionMethod });
  }
  if (ctx.implantationMethod) {
    fields.push({ label: "Implantation method", value: ctx.implantationMethod });
  }
  if (ctx.treatedAreas.length) {
    fields.push({
      label: "Treated areas (recorded)",
      value: ctx.treatedAreas.join(", "),
    });
  }

  return fields;
}

export function hasConflictingGraftCounts(
  reconstruction: SurgeryDayProcedureReconstruction
): boolean {
  const values = new Set<number>();
  if (reconstruction.graftEvidence.clinicReportedCount != null) {
    values.add(reconstruction.graftEvidence.clinicReportedCount);
  }
  for (const p of reconstruction.graftEvidence.provenance) {
    if (p.source === "clinic_reported" || p.source === "patient_reported" || p.source === "auditor_confirmed") {
      values.add(p.value);
    }
  }
  const ctx = reconstruction.procedureContext;
  if (ctx.reportedGraftCount != null) values.add(ctx.reportedGraftCount);
  if (ctx.actualGraftCount != null) values.add(ctx.actualGraftCount);
  return values.size > 1;
}

export function buildTreatmentAreaRows(
  reconstruction: SurgeryDayProcedureReconstruction
): TreatmentAreaRow[] {
  const observed = uniqueNormalizedZones(
    normalizeZoneList(reconstruction.recipient.observedTreatedAreas, "other")
  );
  const recorded = uniqueNormalizedZones(
    normalizeZoneList(reconstruction.procedureContext.treatedAreas, "areas_treated")
  );
  const treated = new Set<RecipientZone>([...observed, ...recorded]);

  if (treated.size === 0) return [];

  const primary: RecipientZone | null =
    treated.has("frontal") || treated.has("hairline")
      ? "frontal"
      : treated.has("mid_scalp")
        ? "mid_scalp"
        : null;

  const rows: TreatmentAreaRow[] = [];
  for (const zone of DISPLAY_ZONE_ORDER) {
    const zoneLabel = ZONE_LABELS[zone];
    if (treated.has(zone)) {
      if (zone === primary || (zone === "hairline" && primary === "frontal")) {
        rows.push({
          zoneLabel,
          stateLabel: zone === "hairline" || zone === "frontal" ? "Primary treatment" : "Treated",
        });
      } else if (zone === "forelock") {
        rows.push({ zoneLabel, stateLabel: "Partial / native hair may be present" });
      } else if (zone === "mid_scalp" && primary === "frontal") {
        rows.push({ zoneLabel, stateLabel: "Treated / partial" });
      } else {
        rows.push({ zoneLabel, stateLabel: "Treated" });
      }
      continue;
    }
    // Context-only absence labels for common zones when other treatment is known
    if (zone === "temples") {
      rows.push({ zoneLabel, stateLabel: "Not identified" });
    } else if (zone === "crown") {
      rows.push({ zoneLabel, stateLabel: "Not identified as primary treatment" });
    }
  }
  return rows;
}

function featureBlock(
  id: string,
  title: string,
  feature: ObservedFeature | null | undefined
): ObservedTodayBlock | null {
  if (!feature?.observation?.trim()) return null;
  return {
    id,
    title,
    observation: feature.observation.trim(),
    confidence: formatConfidenceLabel(feature.confidence),
  };
}

export function buildObservedTodayBlocks(
  reconstruction: SurgeryDayProcedureReconstruction
): ObservedTodayBlock[] {
  const blocks: ObservedTodayBlock[] = [];

  if (reconstruction.recipient.observedTreatedAreas.length) {
    blocks.push({
      id: "recipient_treated_areas",
      title: "Recipient / treated areas",
      observation: `Treatment appears associated with: ${reconstruction.recipient.observedTreatedAreas.join(", ")}.`,
    });
  }

  const hairline = featureBlock("hairline_design", "Hairline design", reconstruction.recipient.hairlineDesign);
  if (hairline) blocks.push(hairline);

  const placement = featureBlock(
    "recipient_placement",
    "Recipient placement",
    reconstruction.recipient.recipientPlacement
  );
  if (placement) blocks.push(placement);

  const density = featureBlock(
    "density_distribution",
    "Density distribution",
    reconstruction.recipient.densityDistribution
  );
  if (density) blocks.push(density);

  const direction = featureBlock(
    "direction_and_angulation",
    "Direction and transition",
    reconstruction.recipient.directionAndAngulation
  );
  const transition = featureBlock(
    "symmetry_and_transition",
    "Direction and transition",
    reconstruction.recipient.symmetryAndTransition
  );
  if (direction && transition) {
    blocks.push({
      id: "direction_and_transition",
      title: "Direction and transition",
      observation: `${direction.observation} ${transition.observation}`,
    });
  } else if (direction) {
    blocks.push(direction);
  } else if (transition) {
    blocks.push({ ...transition, id: "direction_and_transition", title: "Direction and transition" });
  }

  if (reconstruction.baseline.available) {
    const native = featureBlock(
      "baseline_native",
      "Baseline comparison",
      reconstruction.baseline.nativeHairPattern
    );
    const relationship = featureBlock(
      "baseline_relationship",
      "Baseline comparison",
      reconstruction.baseline.treatmentRelationship
    );
    if (native && relationship) {
      blocks.push({
        id: "baseline_comparison",
        title: "Baseline comparison",
        observation: `${native.observation} ${relationship.observation}`,
      });
    } else if (native) {
      blocks.push({ ...native, id: "baseline_comparison", title: "Baseline comparison" });
    } else if (relationship) {
      blocks.push({ ...relationship, id: "baseline_comparison", title: "Baseline comparison" });
    }
  }

  if (reconstruction.donor) {
    const donorBits: string[] = [];
    if (reconstruction.donor.extractionPattern?.observation) {
      donorBits.push(reconstruction.donor.extractionPattern.observation);
    }
    if (reconstruction.donor.extractionDistribution?.observation) {
      donorBits.push(reconstruction.donor.extractionDistribution.observation);
    }
    for (const concern of reconstruction.donor.visibleConcerns) {
      if (concern.observation) donorBits.push(concern.observation);
    }
    if (donorBits.length) {
      blocks.push({
        id: "donor_observations",
        title: "Donor observations",
        observation: donorBits.join(" "),
      });
    }
  }

  for (const obs of reconstruction.overallObservations) {
    if (!obs.observation?.trim()) continue;
    blocks.push({
      id: `overall_${obs.key}`,
      title: obs.label || "Additional observation",
      observation: obs.observation.trim(),
      confidence: formatConfidenceLabel(obs.confidence),
    });
  }

  return blocks;
}

export function buildGraftEvidenceDisplay(
  reconstruction: SurgeryDayProcedureReconstruction
): GraftEvidenceDisplay {
  const procedureRecords: GraftEvidenceDisplay["procedureRecords"] = [];
  const clinic = reconstruction.graftEvidence.clinicReportedCount;
  if (clinic != null && Number.isFinite(clinic)) {
    procedureRecords.push({
      label: "Reported grafts",
      value: formatNumber(clinic),
      source: "Clinic record",
    });
  }

  for (const p of reconstruction.graftEvidence.provenance) {
    if (p.source === "clinic_reported" && clinic != null && p.value === clinic) continue;
    if (p.source === "ai_estimated") continue;
    procedureRecords.push({
      label:
        p.source === "patient_reported"
          ? "Patient-reported grafts"
          : p.source === "auditor_confirmed"
            ? "Auditor-confirmed grafts"
            : "Recorded grafts",
      value: formatNumber(p.value),
      source: provenanceSourceLabel(p.source),
    });
  }

  const avg = reconstruction.procedureContext.averageHairsPerGraft;
  if (avg != null && Number.isFinite(avg)) {
    procedureRecords.push({
      label: "Average hairs per graft",
      value: String(avg),
    });
  }
  const punch = reconstruction.procedureContext.punchSizeMm;
  if (punch != null && Number.isFinite(punch)) {
    procedureRecords.push({
      label: "Punch size",
      value: `${punch} mm`,
    });
  }

  const gii = reconstruction.graftEvidence.imageDerivedEstimate;
  const imageDerivedEstimate =
    gii && Number.isFinite(gii.min) && Number.isFinite(gii.max)
      ? {
          rangeLabel: `${formatNumber(gii.min)}–${formatNumber(gii.max)}`,
          confidence: formatConfidenceLabel(gii.confidence),
        }
      : null;

  return {
    procedureRecords,
    imageDerivedEstimate,
    conflictNote: hasConflictingGraftCounts(reconstruction)
      ? "Available records contain differing graft-count figures. These have been kept separate rather than averaged."
      : null,
  };
}

export function buildDonorObservationLines(
  reconstruction: SurgeryDayProcedureReconstruction
): string[] {
  if (!reconstruction.donor) return [];
  const lines: string[] = [];
  if (reconstruction.donor.extractionPattern?.observation) {
    lines.push(reconstruction.donor.extractionPattern.observation);
  }
  if (reconstruction.donor.extractionDistribution?.observation) {
    lines.push(reconstruction.donor.extractionDistribution.observation);
  }
  for (const concern of reconstruction.donor.visibleConcerns) {
    if (concern.observation?.trim()) lines.push(concern.observation.trim());
  }
  if (lines.length) lines.push(DONOR_MATURE_APPEARANCE_NOTE);
  return lines;
}

export function buildBiologicalTimeline(): BiologicalTimelineStage[] {
  return [
    {
      period: "0–1 month",
      description: "Healing, crust resolution and early shedding.",
    },
    {
      period: "1–3 months",
      description:
        "Transplanted shafts may shed while follicles enter a resting phase.",
    },
    {
      period: "3–6 months",
      description: "Early visible growth may begin.",
    },
    {
      period: "6–9 months",
      description: "Increasing growth, calibre and styling potential may occur.",
    },
    {
      period: "9–12 months",
      description: "Further maturation commonly develops.",
    },
    {
      period: "12–18 months",
      description:
        "Some patients may continue to experience refinement, particularly in slower-maturing areas.",
    },
  ];
}

export function buildFutureComparisonMilestones(): FutureComparisonMilestone[] {
  return [
    { label: "Month 3", description: "Early progress review" },
    { label: "Month 6", description: "Intermediate outcome review" },
    { label: "Month 9", description: "Maturation review" },
    { label: "Month 12", description: "Mature outcome review" },
  ];
}

export function buildRecommendedNextSteps(): string[] {
  return [
    "Follow the treating clinic's postoperative instructions.",
    "Capture consistent follow-up photos in similar lighting and angles.",
    "Complete future HairAudit milestone reviews when available.",
    "Contact the treating clinic if healing concerns arise.",
  ];
}

export function buildProjectionImageGroups(
  photosByCategory:
    | Record<string, { signedUrl: string | null; label: string }[]>
    | undefined,
  presentRoles: SurgeryDayEvidenceRole[]
): ProjectionImageGroup[] {
  if (!photosByCategory) return [];

  const roleHints = new Set(presentRoles);
  const groups: ProjectionImageGroup[] = [];

  for (const id of Object.keys(IMAGE_GROUP_TITLES) as ProjectionImageGroupId[]) {
    if (id === "preoperative_baseline" && !presentRoles.some((r) => r.startsWith("preop_"))) {
      continue;
    }
    if (id === "surgery_day_recipient" && !roleHints.has("surgery_day_recipient")) continue;
    if (id === "surgery_day_donor" && !roleHints.has("surgery_day_donor")) continue;
    if (id === "hairline_design" && !roleHints.has("surgery_day_design")) continue;
    if (
      id === "implantation_evidence" &&
      !roleHints.has("surgery_day_implantation") &&
      !roleHints.has("surgery_day_site_creation")
    ) {
      continue;
    }

    const images: Array<{ url: string; label: string }> = [];
    for (const [categoryKey, items] of Object.entries(photosByCategory)) {
      const matches = IMAGE_GROUP_CATEGORY_HINTS[id].some((re) => re.test(categoryKey));
      if (!matches) continue;
      for (const item of items ?? []) {
        if (!item.signedUrl) continue;
        images.push({
          url: item.signedUrl,
          label: item.label?.trim() || IMAGE_GROUP_TITLES[id],
        });
      }
    }
    if (!images.length) continue;
    groups.push({
      id,
      title: IMAGE_GROUP_TITLES[id],
      images: images.slice(0, 4),
    });
  }

  return groups;
}

/** Domains currently emitted by 1B — report must not invent missing ones. */
export function projectedCharacteristicsForReport(outcome: SurgeryDayProjectedOutcome) {
  return outcome.projectedCharacteristics ?? [];
}
