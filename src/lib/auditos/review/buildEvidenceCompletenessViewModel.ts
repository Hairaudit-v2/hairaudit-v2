/**
 * Stage 4D — read-only evidence completeness view-model from persisted AuditOS evidence manifest JSON.
 */

export type EvidenceCompletenessStatus = "complete" | "partial" | "limited" | "unknown";

export type EvidenceGroupRow = {
  groupKey: string;
  label: string;
  itemCount: number;
};

export type EvidenceCompletenessViewModel = {
  groups: EvidenceGroupRow[];
  includedTotal: number;
  missingEvidence: string[];
  completenessStatus: EvidenceCompletenessStatus;
  qualityHintLines: string[];
  confidenceHintLines: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function bucketKey(item: Record<string, unknown>): string {
  const cat = typeof item.category === "string" && item.category.trim() ? item.category : "uncategorized";
  const role = typeof item.sourceRole === "string" ? item.sourceRole : "unknown";
  const phase = typeof item.phase === "string" && item.phase.trim() ? item.phase : "none";
  return `${role}::${phase}::${cat}`;
}

function bucketLabel(key: string): string {
  return key.replace(/::/g, " · ");
}

export function buildEvidenceCompletenessViewModel(evidenceManifestJson: unknown): EvidenceCompletenessViewModel {
  if (!isRecord(evidenceManifestJson)) {
    return {
      groups: [],
      includedTotal: 0,
      missingEvidence: [],
      completenessStatus: "unknown",
      qualityHintLines: [],
      confidenceHintLines: [],
    };
  }

  const images = Array.isArray(evidenceManifestJson.images) ? (evidenceManifestJson.images as unknown[]) : [];
  const documents = Array.isArray(evidenceManifestJson.documents) ? (evidenceManifestJson.documents as unknown[]) : [];
  const other = Array.isArray(evidenceManifestJson.otherUploads) ? (evidenceManifestJson.otherUploads as unknown[]) : [];
  const allItems = [...images, ...documents, ...other].filter(isRecord);

  const bucketCounts = new Map<string, number>();
  for (const item of allItems) {
    const k = bucketKey(item);
    bucketCounts.set(k, (bucketCounts.get(k) ?? 0) + 1);
  }

  const groups: EvidenceGroupRow[] = [...bucketCounts.entries()]
    .map(([groupKey, itemCount]) => ({
      groupKey,
      label: bucketLabel(groupKey),
      itemCount,
    }))
    .sort((a, b) => b.itemCount - a.itemCount || a.label.localeCompare(b.label));

  const missingEvidence = Array.isArray(evidenceManifestJson.missingEvidence)
    ? (evidenceManifestJson.missingEvidence as unknown[]).map((x) => String(x)).filter(Boolean)
    : [];

  const completeness = isRecord(evidenceManifestJson.completeness) ? evidenceManifestJson.completeness : null;
  const notes = completeness && Array.isArray(completeness.notes) ? completeness.notes.map((x) => String(x)) : [];

  let completenessStatus: EvidenceCompletenessStatus = "unknown";
  if (missingEvidence.length === 0 && allItems.length > 0) completenessStatus = "complete";
  else if (missingEvidence.length > 0 && allItems.length > 0) completenessStatus = "partial";
  else if (missingEvidence.length > 0 && allItems.length === 0) completenessStatus = "limited";
  else if (allItems.length > 0) completenessStatus = "partial";

  const qualityHints = isRecord(evidenceManifestJson.qualityHints) ? evidenceManifestJson.qualityHints : null;
  const qualityHintLines: string[] = [];
  if (qualityHints) {
    for (const [k, v] of Object.entries(qualityHints)) {
      if (v === null || v === undefined) continue;
      qualityHintLines.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
    }
    qualityHintLines.sort();
  }

  const confHints = isRecord(evidenceManifestJson.confidenceHints) ? evidenceManifestJson.confidenceHints : null;
  const confidenceHintLines: string[] = [];
  if (confHints) {
    for (const [k, v] of Object.entries(confHints)) {
      if (v === null || v === undefined) continue;
      confidenceHintLines.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
    }
    confidenceHintLines.sort();
  }

  return {
    groups,
    includedTotal: allItems.length,
    missingEvidence,
    completenessStatus,
    qualityHintLines: qualityHintLines.slice(0, 20),
    confidenceHintLines: confidenceHintLines.slice(0, 20),
  };
}
