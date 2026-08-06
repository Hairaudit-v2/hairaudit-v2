/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — De-identified learning signals from auditor projection corrections.
 *
 * Emits structured feedback for future model improvement without PHI / patient identifiers.
 * Mirrors the spirit of academy trainingCaseCorrections (structured, audited, no silent overwrite).
 */

import { createHash } from "node:crypto";
import type { PreSurgeryProjectionCorrection, ProjectionCorrectionCode } from "./projectionCorrections";
import type { PreSurgeryProjectionMode } from "./types";
import { PRE_SURGERY_PROJECTION_CORRECTION_VERSION } from "./projectionCorrections";

export const PRE_SURGERY_PROJECTION_LEARNING_SIGNAL_VERSION =
  "ha-pre-surgery-projection-learning-signal-v1" as const;

export type ProjectionLearningSignal = {
  id: string;
  schemaVersion: typeof PRE_SURGERY_PROJECTION_LEARNING_SIGNAL_VERSION;
  /** Opaque case key — sha256(caseId) truncated; not reversible from this payload alone in logs. */
  caseKeyHash: string;
  /** Opaque projection key hash. */
  projectionKeyHash: string;
  projectionVersion: number;
  projectionMode: PreSurgeryProjectionMode | null;
  correctionCodes: ProjectionCorrectionCode[];
  zoneRefs: string[];
  hasGeometry: boolean;
  geometryType: string | null;
  suggestedMode: PreSurgeryProjectionMode | null;
  /** Length-bounded note fingerprint only — not the clinical note body. */
  noteCharCount: number;
  noteTokenFingerprint: string | null;
  source: "auditor_projection_correction";
  createdAt: string;
};

const PHI_LIKE = [
  /\b[\w.+-]+@[\w.-]+\.\w+\b/i,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /\bpatient\s+[A-Z][a-z]+\b/,
];

function hashOpaque(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 32);
}

function noteFingerprint(note: string): string | null {
  const cleaned = note.trim().toLowerCase().replace(/\s+/g, " ");
  if (!cleaned) return null;
  // Drop likely PHI-looking fragments before hashing.
  let scrubbed = cleaned;
  for (const p of PHI_LIKE) {
    scrubbed = scrubbed.replace(p, " ");
  }
  const tokens = scrubbed
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
    .slice(0, 24)
    .sort();
  if (tokens.length === 0) return null;
  return hashOpaque(tokens.join("|"));
}

export function buildProjectionLearningSignal(input: {
  correction: PreSurgeryProjectionCorrection;
  projectionMode?: PreSurgeryProjectionMode | null;
  now?: string;
  id?: string;
}): ProjectionLearningSignal {
  const { correction } = input;
  // Never include clinicalNote body, actor ids, storage paths, or raw case UUIDs.
  return {
    id: input.id ?? crypto.randomUUID(),
    schemaVersion: PRE_SURGERY_PROJECTION_LEARNING_SIGNAL_VERSION,
    caseKeyHash: hashOpaque(`case:${correction.caseId}`),
    projectionKeyHash: hashOpaque(`proj:${correction.projectionSnapshotId}`),
    projectionVersion: correction.projectionVersion,
    projectionMode: input.projectionMode ?? null,
    correctionCodes: [...correction.correctionCodes],
    zoneRefs: [...correction.zoneRefs],
    hasGeometry: Boolean(correction.geometryType && correction.coordinates.length > 0),
    geometryType: correction.geometryType,
    suggestedMode: correction.suggestedMode,
    noteCharCount: correction.clinicalNote.length,
    noteTokenFingerprint: noteFingerprint(correction.clinicalNote),
    source: "auditor_projection_correction",
    createdAt: input.now ?? new Date().toISOString(),
  };
}

export function assertLearningSignalHasNoPhi(signal: ProjectionLearningSignal, rawCaseId?: string): void {
  const blob = JSON.stringify(signal);
  if (rawCaseId && blob.includes(rawCaseId)) {
    throw new Error("Learning signal must not contain raw case id");
  }
  if (/"clinicalNote"|storage_path|approvedBy|@/.test(blob) && /@/.test(blob)) {
    throw new Error("Learning signal must not contain email-like PHI");
  }
  void PRE_SURGERY_PROJECTION_CORRECTION_VERSION;
}
