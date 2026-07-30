/**
 * HA-DONOR-HEALING-1D — Donor zone annotation and qualitative heatmap summaries.
 *
 * Clinician-painted normalised polygons on rear/left/right donor photos.
 * Describes visible irregularity by zone — never density %, follicle death,
 * permanent depletion, confirmed overharvesting, or future graft capacity.
 */

import {
  DONOR_HEALING_ENTRY_CONTEXT,
  containsForbiddenDonorDiagnosticLanguage,
  type DonorHealingEntryContext,
} from "@/lib/patient/donorHealingEntry";
import { sanitizePatientReportText } from "@/lib/reports/postSurgeryPatientText";
import { caseHasDonorHealingEntryContext } from "@/lib/patient/donorHealingOrientationReport";
import {
  clampNormalisedPoint,
  validateAnnotationCoordinates,
} from "@/lib/preSurgeryIntelligence/annotations";
import type {
  ClinicalAnnotationGeometryType,
  NormalisedPoint,
} from "@/lib/preSurgeryIntelligence/types";
import {
  classifyDonorComparisonView,
  stripPatientPhotoPrefix,
  type DonorComparisonView,
} from "@/lib/patient/donorLongitudinalComparison";

export const DONOR_ZONE_ANNOTATION_VERSION = 1 as const;

export const DONOR_ZONE_IDS = [
  "occipital",
  "parietal_left",
  "parietal_right",
  "temporal_left",
  "temporal_right",
  "nuchal",
  "custom",
] as const;

export type DonorZoneId = (typeof DONOR_ZONE_IDS)[number];

export const DONOR_ZONE_LABELS: Record<DonorZoneId, string> = {
  occipital: "Occipital (rear central)",
  parietal_left: "Left parietal",
  parietal_right: "Right parietal",
  temporal_left: "Left temporal",
  temporal_right: "Right temporal",
  nuchal: "Nuchal / lower border",
  custom: "Custom region",
};

/** Patient-facing shorter labels (still clinical-neutral). */
export const DONOR_ZONE_PATIENT_LABELS: Record<DonorZoneId, string> = {
  occipital: "Central rear donor area",
  parietal_left: "Left upper donor area",
  parietal_right: "Right upper donor area",
  temporal_left: "Left side donor area",
  temporal_right: "Right side donor area",
  nuchal: "Lower rear donor border",
  custom: "Marked donor region",
};

export const DONOR_ZONE_INTENSITIES = [
  "broadly_even_appearance",
  "mild_visible_irregularity",
  "moderate_visible_irregularity",
  "marked_visible_irregularity",
  "not_assessable",
] as const;

export type DonorZoneIntensity = (typeof DONOR_ZONE_INTENSITIES)[number];

export const DONOR_ZONE_INTENSITY_LABELS: Record<DonorZoneIntensity, string> = {
  broadly_even_appearance: "Appearance looks broadly even in this zone",
  mild_visible_irregularity: "Mild visible irregularity in this zone",
  moderate_visible_irregularity: "Moderate visible irregularity in this zone",
  marked_visible_irregularity: "Marked visible irregularity in this zone",
  not_assessable: "This zone cannot be assessed reliably from the photograph",
};

export const DONOR_ZONE_VIEWS = ["rear", "left", "right"] as const;
export type DonorZoneView = (typeof DONOR_ZONE_VIEWS)[number];

export type DonorZoneGeometryType = Extract<
  ClinicalAnnotationGeometryType,
  "polygon" | "polyline" | "point"
>;

export type DonorZoneProvenanceSource =
  | "automated_preparation"
  | "clinician_confirmation"
  | "clinician_correction";

export type DonorZoneAnnotationItem = {
  id: string;
  uploadId: string;
  categoryKey: string;
  view: DonorZoneView;
  zoneId: DonorZoneId;
  intensity: DonorZoneIntensity;
  geometryType: DonorZoneGeometryType;
  coordinates: NormalisedPoint[];
  note?: string | null;
  createdAt: string;
};

/** Derived qualitative rollup — not a pixel grid. */
export type DonorZoneHeatmapSummary = {
  view: DonorZoneView;
  zoneId: DonorZoneId;
  intensity: DonorZoneIntensity;
  annotationCount: number;
};

export type DonorZoneProvenanceEvent = {
  at: string;
  source: DonorZoneProvenanceSource;
  annotationCount: number;
  actorUserId?: string | null;
};

export type DonorZoneProvenance = {
  source: DonorZoneProvenanceSource;
  preparedAt: string;
  preparedBySystem: boolean;
  confirmedAt?: string | null;
  confirmedByUserId?: string | null;
  history: DonorZoneProvenanceEvent[];
};

export type DonorZoneAnnotationSnapshot = {
  id: string;
  at: string;
  actorUserId: string | null;
  source: DonorZoneProvenanceSource;
  payloadDigest: string;
  payload: {
    annotationCount: number;
    annotationIds: string[];
    heatmapSummaries: DonorZoneHeatmapSummary[];
    narrative: string;
  };
};

/**
 * Full record stored on `reports.summary.donor_zone_annotation`.
 */
export type DonorZoneAnnotationRecord = {
  version: typeof DONOR_ZONE_ANNOTATION_VERSION;
  entryContext: DonorHealingEntryContext;
  annotations: DonorZoneAnnotationItem[];
  heatmapSummaries: DonorZoneHeatmapSummary[];
  narrative: string;
  provenance: DonorZoneProvenance;
  snapshots: DonorZoneAnnotationSnapshot[];
};

export type PatientSafeDonorZoneAnnotationSlice = {
  narrative: string;
  caveat: string;
  zones: Array<{
    zoneId: DonorZoneId;
    zoneLabel: string;
    intensity: DonorZoneIntensity;
    intensityLabel: string;
    view: DonorZoneView;
    note: string | null;
  }>;
  schematic: Array<{
    zoneId: DonorZoneId;
    intensity: DonorZoneIntensity;
  }>;
  provenanceLabel: string;
  provenanceSource: DonorZoneProvenanceSource;
};

export type BuildDonorZoneAnnotationInput = {
  answers?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  existingAnnotations?: readonly DonorZoneAnnotationItem[] | null;
  now?: Date;
};

export const DONOR_ZONE_ANNOTATION_CAVEAT =
  "Zone markings describe visible appearance in submitted photographs. They are not density measurements, graft counts, or predictions of future donor capacity.";

const INTENSITY_RANK: Record<DonorZoneIntensity, number> = {
  broadly_even_appearance: 0,
  mild_visible_irregularity: 1,
  moderate_visible_irregularity: 2,
  marked_visible_irregularity: 3,
  not_assessable: -1,
};

export function isDonorZoneId(value: unknown): value is DonorZoneId {
  return typeof value === "string" && (DONOR_ZONE_IDS as readonly string[]).includes(value);
}

export function isDonorZoneIntensity(value: unknown): value is DonorZoneIntensity {
  return (
    typeof value === "string" &&
    (DONOR_ZONE_INTENSITIES as readonly string[]).includes(value)
  );
}

export function isDonorZoneView(value: unknown): value is DonorZoneView {
  return typeof value === "string" && (DONOR_ZONE_VIEWS as readonly string[]).includes(value);
}

export function donorZoneLabel(zoneId: DonorZoneId): string {
  return DONOR_ZONE_LABELS[zoneId];
}

export function donorZonePatientLabel(zoneId: DonorZoneId): string {
  return DONOR_ZONE_PATIENT_LABELS[zoneId];
}

export function donorZoneIntensityLabel(intensity: DonorZoneIntensity): string {
  return DONOR_ZONE_INTENSITY_LABELS[intensity];
}

export function assertPatientSafeDonorZoneText(text: string): string {
  const cleaned = sanitizePatientReportText(text);
  if (containsForbiddenDonorDiagnosticLanguage(cleaned)) {
    return "Zone appearance notes are limited for this review.";
  }
  return cleaned;
}

export function resolveViewFromUpload(input: {
  categoryKey?: string | null;
  view?: unknown;
}): DonorZoneView | null {
  if (isDonorZoneView(input.view)) return input.view;
  const key = stripPatientPhotoPrefix(String(input.categoryKey ?? ""));
  const classified = classifyDonorComparisonView(key);
  return classified && isDonorZoneView(classified) ? classified : null;
}

export function createDonorZoneAnnotationItem(input: {
  id?: string;
  uploadId: string;
  categoryKey: string;
  view?: DonorZoneView | null;
  zoneId: DonorZoneId;
  intensity: DonorZoneIntensity;
  geometryType?: DonorZoneGeometryType;
  coordinates: NormalisedPoint[];
  note?: string | null;
  createdAt?: string;
}): DonorZoneAnnotationItem {
  if (!isDonorZoneId(input.zoneId)) throw new Error("Invalid donor zone id");
  if (!isDonorZoneIntensity(input.intensity)) throw new Error("Invalid intensity");
  if (input.zoneId === "custom" && !String(input.note ?? "").trim()) {
    throw new Error("Custom zone requires a note");
  }

  const geometryType: DonorZoneGeometryType = input.geometryType ?? "polygon";
  const err = validateAnnotationCoordinates(geometryType, input.coordinates);
  if (err) throw new Error(err);

  const view =
    resolveViewFromUpload({ categoryKey: input.categoryKey, view: input.view }) ??
    null;
  if (!view) throw new Error("Could not resolve donor view (rear/left/right)");

  return {
    id: input.id ?? `dza_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    uploadId: String(input.uploadId),
    categoryKey: stripPatientPhotoPrefix(input.categoryKey),
    view,
    zoneId: input.zoneId,
    intensity: input.intensity,
    geometryType,
    coordinates: input.coordinates.map(clampNormalisedPoint),
    note: input.note?.trim() ? String(input.note).trim() : null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Roll up annotations into per-view/zone qualitative summaries.
 * When multiple annotations share a zone+view, take the strongest irregularity.
 */
export function buildDonorZoneHeatmapSummaries(
  annotations: readonly DonorZoneAnnotationItem[]
): DonorZoneHeatmapSummary[] {
  const map = new Map<string, DonorZoneHeatmapSummary>();
  for (const a of annotations) {
    const key = `${a.view}:${a.zoneId}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        view: a.view,
        zoneId: a.zoneId,
        intensity: a.intensity,
        annotationCount: 1,
      });
      continue;
    }
    existing.annotationCount += 1;
    const nextRank = INTENSITY_RANK[a.intensity];
    const prevRank = INTENSITY_RANK[existing.intensity];
    if (nextRank > prevRank) {
      existing.intensity = a.intensity;
    }
  }
  return [...map.values()].sort(
    (x, y) =>
      x.view.localeCompare(y.view) ||
      x.zoneId.localeCompare(y.zoneId)
  );
}

export function buildDonorZoneNarrative(
  summaries: readonly DonorZoneHeatmapSummary[]
): string {
  if (summaries.length === 0) {
    return sanitizePatientReportText(
      "No donor zones have been marked for this review yet. A clinician can annotate rear, left, and right donor photographs when evidence allows."
    );
  }

  const irregular = summaries.filter(
    (s) =>
      s.intensity === "mild_visible_irregularity" ||
      s.intensity === "moderate_visible_irregularity" ||
      s.intensity === "marked_visible_irregularity"
  );
  if (irregular.length === 0) {
    const assessable = summaries.filter((s) => s.intensity !== "not_assessable");
    if (assessable.length === 0) {
      return sanitizePatientReportText(
        "Marked donor zones could not be assessed reliably from the available photographs."
      );
    }
    return sanitizePatientReportText(
      "Marked donor zones look broadly even in appearance on the reviewed photographs. This describes photographic appearance only."
    );
  }

  const names = irregular
    .slice(0, 4)
    .map((s) => donorZonePatientLabel(s.zoneId))
    .join(", ");
  return sanitizePatientReportText(
    `Visible irregularity was noted in: ${names}${
      irregular.length > 4 ? ", and additional marked zones" : ""
    }. These notes support discussion with your treating clinic and do not measure density or graft survival.`
  );
}

function simpleDigest(parts: string[]): string {
  let h = 0;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return `d${(h >>> 0).toString(16)}`;
}

export function buildDonorZoneSnapshot(args: {
  record: Pick<
    DonorZoneAnnotationRecord,
    "annotations" | "heatmapSummaries" | "narrative"
  >;
  source: DonorZoneProvenanceSource;
  actorUserId: string | null;
  at?: string;
}): DonorZoneAnnotationSnapshot {
  const at = args.at ?? new Date().toISOString();
  const annotationIds = args.record.annotations.map((a) => a.id).sort();
  const payload = {
    annotationCount: args.record.annotations.length,
    annotationIds,
    heatmapSummaries: args.record.heatmapSummaries.map((s) => ({ ...s })),
    narrative: args.record.narrative,
  };
  const payloadDigest = simpleDigest([
    String(payload.annotationCount),
    annotationIds.join(","),
    payload.heatmapSummaries
      .map((s) => `${s.view}:${s.zoneId}:${s.intensity}`)
      .join(";"),
  ]);
  return {
    id: `snap_${at.replace(/[:.]/g, "")}_${payloadDigest}`,
    at,
    actorUserId: args.actorUserId,
    source: args.source,
    payloadDigest,
    payload,
  };
}

export function provenanceLabelForDonorZone(
  source: DonorZoneProvenanceSource
): string {
  switch (source) {
    case "clinician_confirmation":
      return "Confirmed by reviewing clinician";
    case "clinician_correction":
      return "Updated after clinician review";
    default:
      return "Prepared automatically for clinician review";
  }
}

function withDerivedFields(
  annotations: DonorZoneAnnotationItem[],
  base: Omit<
    DonorZoneAnnotationRecord,
    "annotations" | "heatmapSummaries" | "narrative"
  >
): DonorZoneAnnotationRecord {
  const heatmapSummaries = buildDonorZoneHeatmapSummaries(annotations);
  const narrative = assertPatientSafeDonorZoneText(
    buildDonorZoneNarrative(heatmapSummaries)
  );
  return {
    ...base,
    annotations,
    heatmapSummaries,
    narrative,
  };
}

/** Build a fresh automated shell (empty annotations until clinician draws). */
export function buildAutomatedDonorZoneAnnotation(
  input: BuildDonorZoneAnnotationInput
): DonorZoneAnnotationRecord | null {
  if (!caseHasDonorHealingEntryContext(input)) return null;

  const preparedAt = (input.now ?? new Date()).toISOString();
  const annotations = [...(input.existingAnnotations ?? [])];
  return withDerivedFields(annotations, {
    version: DONOR_ZONE_ANNOTATION_VERSION,
    entryContext: DONOR_HEALING_ENTRY_CONTEXT,
    provenance: {
      source: "automated_preparation",
      preparedAt,
      preparedBySystem: true,
      confirmedAt: null,
      confirmedByUserId: null,
      history: [
        {
          at: preparedAt,
          source: "automated_preparation",
          annotationCount: annotations.length,
          actorUserId: null,
        },
      ],
    },
    snapshots: [],
  });
}

export function isDonorZoneAnnotationRecord(
  value: unknown
): value is DonorZoneAnnotationRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === DONOR_ZONE_ANNOTATION_VERSION &&
    v.entryContext === DONOR_HEALING_ENTRY_CONTEXT &&
    Array.isArray(v.annotations) &&
    Array.isArray(v.heatmapSummaries) &&
    typeof v.narrative === "string" &&
    v.provenance != null &&
    typeof v.provenance === "object" &&
    Array.isArray(v.snapshots)
  );
}

export function isClinicianReviewedDonorZoneAnnotation(
  record: DonorZoneAnnotationRecord
): boolean {
  return (
    record.provenance.source === "clinician_confirmation" ||
    record.provenance.source === "clinician_correction"
  );
}

export function upsertDonorZoneAnnotation(
  existing: DonorZoneAnnotationRecord,
  item: DonorZoneAnnotationItem
): DonorZoneAnnotationRecord {
  const annotations = existing.annotations.filter((a) => a.id !== item.id);
  annotations.push(item);
  return withDerivedFields(annotations, {
    version: existing.version,
    entryContext: existing.entryContext,
    provenance: {
      ...existing.provenance,
      // Editing while automated stays automated until confirm/correct.
      source:
        existing.provenance.source === "clinician_confirmation" ||
        existing.provenance.source === "clinician_correction"
          ? "clinician_correction"
          : existing.provenance.source,
    },
    snapshots: existing.snapshots,
  });
}

export function deleteDonorZoneAnnotation(
  existing: DonorZoneAnnotationRecord,
  annotationId: string
): DonorZoneAnnotationRecord {
  const annotations = existing.annotations.filter((a) => a.id !== annotationId);
  return withDerivedFields(annotations, {
    version: existing.version,
    entryContext: existing.entryContext,
    provenance: {
      ...existing.provenance,
      source:
        existing.provenance.source === "clinician_confirmation" ||
        existing.provenance.source === "clinician_correction"
          ? "clinician_correction"
          : existing.provenance.source,
    },
    snapshots: existing.snapshots,
  });
}

export function confirmDonorZoneAnnotation(
  existing: DonorZoneAnnotationRecord,
  opts: { actorUserId: string; at?: string }
): DonorZoneAnnotationRecord {
  const at = opts.at ?? new Date().toISOString();
  const next = withDerivedFields(existing.annotations, {
    version: existing.version,
    entryContext: existing.entryContext,
    provenance: {
      ...existing.provenance,
      source: "clinician_confirmation",
      confirmedAt: at,
      confirmedByUserId: opts.actorUserId,
      history: [
        ...existing.provenance.history,
        {
          at,
          source: "clinician_confirmation",
          annotationCount: existing.annotations.length,
          actorUserId: opts.actorUserId,
        },
      ],
    },
    snapshots: existing.snapshots,
  });
  const snapshot = buildDonorZoneSnapshot({
    record: next,
    source: "clinician_confirmation",
    actorUserId: opts.actorUserId,
    at,
  });
  return { ...next, snapshots: [...existing.snapshots, snapshot] };
}

export function correctDonorZoneAnnotation(
  existing: DonorZoneAnnotationRecord,
  opts: {
    actorUserId: string;
    at?: string;
    annotations?: readonly DonorZoneAnnotationItem[] | null;
  }
): DonorZoneAnnotationRecord {
  const at = opts.at ?? new Date().toISOString();
  const annotations = opts.annotations
    ? [...opts.annotations]
    : [...existing.annotations];
  const next = withDerivedFields(annotations, {
    version: existing.version,
    entryContext: existing.entryContext,
    provenance: {
      ...existing.provenance,
      source: "clinician_correction",
      confirmedAt: at,
      confirmedByUserId: opts.actorUserId,
      history: [
        ...existing.provenance.history,
        {
          at,
          source: "clinician_correction",
          annotationCount: annotations.length,
          actorUserId: opts.actorUserId,
        },
      ],
    },
    snapshots: existing.snapshots,
  });
  const snapshot = buildDonorZoneSnapshot({
    record: next,
    source: "clinician_correction",
    actorUserId: opts.actorUserId,
    at,
  });
  return { ...next, snapshots: [...existing.snapshots, snapshot] };
}

export function resolveDonorZoneAnnotationForReport(
  input: BuildDonorZoneAnnotationInput & { stored?: unknown }
): DonorZoneAnnotationRecord | null {
  const fromStored = isDonorZoneAnnotationRecord(input.stored)
    ? input.stored
    : isDonorZoneAnnotationRecord(input.summary?.donor_zone_annotation)
      ? (input.summary!.donor_zone_annotation as DonorZoneAnnotationRecord)
      : null;

  if (fromStored && isClinicianReviewedDonorZoneAnnotation(fromStored)) {
    return fromStored;
  }

  if (fromStored) {
    // Keep draft annotations when rebuilding automated shell.
    return buildAutomatedDonorZoneAnnotation({
      ...input,
      existingAnnotations: fromStored.annotations,
    });
  }

  return buildAutomatedDonorZoneAnnotation(input);
}

export function toPatientSafeDonorZoneAnnotationSlice(
  record: DonorZoneAnnotationRecord
): PatientSafeDonorZoneAnnotationSlice | null {
  if (!isClinicianReviewedDonorZoneAnnotation(record)) return null;

  const zones = record.annotations.map((a) => ({
    zoneId: a.zoneId,
    zoneLabel: assertPatientSafeDonorZoneText(donorZonePatientLabel(a.zoneId)),
    intensity: a.intensity,
    intensityLabel: assertPatientSafeDonorZoneText(
      donorZoneIntensityLabel(a.intensity)
    ),
    view: a.view,
    note: a.note
      ? assertPatientSafeDonorZoneText(a.note)
      : null,
  }));

  const schematicMap = new Map<DonorZoneId, DonorZoneIntensity>();
  for (const s of record.heatmapSummaries) {
    const prev = schematicMap.get(s.zoneId);
    if (!prev || INTENSITY_RANK[s.intensity] > INTENSITY_RANK[prev]) {
      schematicMap.set(s.zoneId, s.intensity);
    }
  }

  return {
    narrative: assertPatientSafeDonorZoneText(record.narrative),
    caveat: DONOR_ZONE_ANNOTATION_CAVEAT,
    zones,
    schematic: [...schematicMap.entries()].map(([zoneId, intensity]) => ({
      zoneId,
      intensity,
    })),
    provenanceLabel: provenanceLabelForDonorZone(record.provenance.source),
    provenanceSource: record.provenance.source,
  };
}

export function collectPatientFacingDonorZoneTexts(
  slice: PatientSafeDonorZoneAnnotationSlice
): string[] {
  const texts = [slice.narrative, slice.caveat, slice.provenanceLabel];
  for (const z of slice.zones) {
    texts.push(z.zoneLabel, z.intensityLabel);
    if (z.note) texts.push(z.note);
  }
  return texts.filter((t): t is string => typeof t === "string" && t.length > 0);
}

export function patientFacingDonorZoneContainsForbiddenLanguage(
  slice: PatientSafeDonorZoneAnnotationSlice
): boolean {
  return collectPatientFacingDonorZoneTexts(slice).some((t) =>
    containsForbiddenDonorDiagnosticLanguage(t)
  );
}
