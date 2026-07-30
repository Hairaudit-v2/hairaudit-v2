/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Annotation geometry helpers (normalised coordinates).
 */

import { PRE_SURGERY_ANNOTATION_VERSION } from "./versions";
import type {
  ClinicalAnnotationGeometryType,
  ClinicalAnnotationType,
  ClinicalImageAnnotation,
  NormalisedPoint,
} from "./types";

export const ANNOTATION_TYPE_LABELS: Record<ClinicalAnnotationType, string> = {
  existing_hairline: "Existing hairline",
  proposed_hairline: "Proposed hairline",
  recipient_zone: "Proposed recipient zone",
  donor_zone: "Donor zone",
  donor_caution: "Donor caution zone",
  frontal_tuft: "Frontal tuft",
  forelock: "Forelock",
  temple_left: "Left temple recession",
  temple_right: "Right temple recession",
  mid_scalp: "Mid-scalp thinning",
  crown: "Crown thinning",
  scar: "Scar",
  obscured: "Obscured by hair",
  insufficient_evidence: "Density not reliably assessable",
  custom: "Custom",
};

export function clampNormalisedPoint(p: NormalisedPoint): NormalisedPoint {
  return {
    x: Math.min(1, Math.max(0, p.x)),
    y: Math.min(1, Math.max(0, p.y)),
  };
}

export function validateAnnotationCoordinates(
  geometryType: ClinicalAnnotationGeometryType,
  coordinates: NormalisedPoint[]
): string | null {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return "Coordinates required";
  }
  for (const p of coordinates) {
    if (typeof p.x !== "number" || typeof p.y !== "number" || Number.isNaN(p.x) || Number.isNaN(p.y)) {
      return "Coordinates must be numeric";
    }
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
      return "Coordinates must be normalised to 0–1";
    }
  }
  if (geometryType === "point" && coordinates.length !== 1) return "Point requires exactly one coordinate";
  if (geometryType === "polyline" && coordinates.length < 2) return "Polyline requires at least two points";
  if (geometryType === "polygon" && coordinates.length < 3) return "Polygon requires at least three points";
  return null;
}

export type CreateAnnotationInput = {
  caseId: string;
  imageId: string;
  annotationType: ClinicalAnnotationType;
  geometryType: ClinicalAnnotationGeometryType;
  coordinates: NormalisedPoint[];
  note?: string;
  createdBy: string;
  source?: "ai_suggestion" | "clinician";
  approved?: boolean;
  supersedesAnnotationId?: string | null;
  imageWidthPx?: number | null;
  imageHeightPx?: number | null;
  imageOrientationDegrees?: 0 | 90 | 180 | 270 | null;
  now?: string;
  id?: string;
};

export function createAnnotation(input: CreateAnnotationInput): ClinicalImageAnnotation {
  const err = validateAnnotationCoordinates(input.geometryType, input.coordinates);
  if (err) throw new Error(err);
  return {
    id: input.id ?? crypto.randomUUID(),
    caseId: input.caseId,
    imageId: input.imageId,
    annotationType: input.annotationType,
    geometryType: input.geometryType,
    coordinates: input.coordinates.map(clampNormalisedPoint),
    note: input.note,
    createdBy: input.createdBy,
    createdAt: input.now ?? new Date().toISOString(),
    schemaVersion: PRE_SURGERY_ANNOTATION_VERSION,
    source: input.source ?? "clinician",
    approved: input.approved ?? input.source === "clinician",
    supersedesAnnotationId: input.supersedesAnnotationId ?? null,
    deletedAt: null,
    imageWidthPx: input.imageWidthPx ?? null,
    imageHeightPx: input.imageHeightPx ?? null,
    imageOrientationDegrees: input.imageOrientationDegrees ?? null,
  };
}

/** Soft-delete with optional supersession lineage. */
export function softDeleteAnnotation(
  annotation: ClinicalImageAnnotation,
  now = new Date().toISOString()
): ClinicalImageAnnotation {
  return { ...annotation, deletedAt: now };
}

/** Restore a soft-deleted annotation (historical row stays reviewable either way). */
export function restoreAnnotation(
  annotation: ClinicalImageAnnotation
): ClinicalImageAnnotation {
  return { ...annotation, deletedAt: null };
}

export type AnnotationHistoryStack = {
  past: ClinicalImageAnnotation[][];
  present: ClinicalImageAnnotation[];
  future: ClinicalImageAnnotation[][];
};

export function pushAnnotationHistory(
  stack: AnnotationHistoryStack,
  next: ClinicalImageAnnotation[]
): AnnotationHistoryStack {
  return {
    past: [...stack.past, stack.present],
    present: next,
    future: [],
  };
}

export function undoAnnotations(stack: AnnotationHistoryStack): AnnotationHistoryStack {
  if (stack.past.length === 0) return stack;
  const previous = stack.past[stack.past.length - 1]!;
  return {
    past: stack.past.slice(0, -1),
    present: previous,
    future: [stack.present, ...stack.future],
  };
}

export function redoAnnotations(stack: AnnotationHistoryStack): AnnotationHistoryStack {
  if (stack.future.length === 0) return stack;
  const next = stack.future[0]!;
  return {
    past: [...stack.past, stack.present],
    present: next,
    future: stack.future.slice(1),
  };
}

export function activeAnnotations(annotations: ClinicalImageAnnotation[]): ClinicalImageAnnotation[] {
  return annotations.filter((a) => !a.deletedAt);
}

export function filterAnnotationOverlay(
  annotations: ClinicalImageAnnotation[],
  opts: { showAi: boolean; showClinicianApproved: boolean }
): ClinicalImageAnnotation[] {
  return activeAnnotations(annotations).filter((a) => {
    if (a.source === "ai_suggestion") return opts.showAi;
    if (a.approved) return opts.showClinicianApproved;
    return opts.showClinicianApproved;
  });
}
