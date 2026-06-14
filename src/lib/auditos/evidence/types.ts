import type { AuditOsEvidenceManifestVersion } from "@/lib/auditos/scoring/types";

export type AuditOsEvidenceItemRole = "patient" | "doctor" | "clinic" | "auditor" | "system" | "unknown";

export type AuditOsEvidenceItem = {
  uploadId?: string | null;
  storagePath?: string | null;
  mimeType?: string | null;
  category?: string | null;
  phase?: string | null;
  sourceRole: AuditOsEvidenceItemRole;
  type?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditOsEvidenceCompletenessSummary = {
  /** 0–100 style coverage when derivable; null if unknown. */
  coverageScore?: number | null;
  requiredSlotsFilled?: number | null;
  requiredSlotsTotal?: number | null;
  qualityScore?: number | null;
  notes?: string[];
};

/**
 * Read-side manifest for AuditOS / FI — built from legacy manifest + upload rows without mutating storage.
 */
export type AuditOsEvidenceManifest = {
  evidenceManifestVersion: AuditOsEvidenceManifestVersion;
  caseId: string;
  legacyManifestId?: string | null;
  status?: string | null;
  images: AuditOsEvidenceItem[];
  documents: AuditOsEvidenceItem[];
  otherUploads: AuditOsEvidenceItem[];
  completeness: AuditOsEvidenceCompletenessSummary;
  missingEvidence: string[];
  qualityHints?: Record<string, unknown>;
  confidenceHints?: Record<string, unknown>;
  metadata: Record<string, unknown>;
};
