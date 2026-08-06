/**
 * Prefer a recognizable face/front photo for auditor queue previews.
 * Helps spot fake / seed imagery versus real patient submissions.
 */

export type AuditorPreviewUploadRow = {
  case_id: string;
  type?: string | null;
  storage_path?: string | null;
};

/** Higher rank = better preview candidate. */
const PREVIEW_TYPE_RANK: Array<{ match: RegExp; rank: number }> = [
  { match: /patient_photo:preop_front\b/i, rank: 100 },
  { match: /:preop_front\b/i, rank: 95 },
  { match: /patient_photo:patient_current_front\b/i, rank: 90 },
  { match: /:patient_current_front\b/i, rank: 88 },
  { match: /patient_photo:current_front\b/i, rank: 85 },
  { match: /:current_front\b/i, rank: 84 },
  { match: /patient_photo:followup_front\b/i, rank: 80 },
  { match: /:followup_front\b/i, rank: 78 },
  { match: /patient_photo:.*front/i, rank: 60 },
  { match: /front/i, rank: 50 },
  { match: /^patient_photo:/i, rank: 20 },
];

export function previewRankForUploadType(type: string | null | undefined): number {
  const t = String(type ?? "");
  for (const entry of PREVIEW_TYPE_RANK) {
    if (entry.match.test(t)) return entry.rank;
  }
  return 0;
}

export function pickAuditorCasePreviewUpload<T extends AuditorPreviewUploadRow>(
  uploads: T[]
): T | null {
  let best: T | null = null;
  let bestRank = -1;
  for (const row of uploads) {
    const path = String(row.storage_path ?? "").trim();
    if (!path) continue;
    const rank = previewRankForUploadType(row.type);
    if (rank > bestRank) {
      best = row;
      bestRank = rank;
    }
  }
  return best;
}

export function pickAuditorCasePreviewPathByCaseId(
  uploads: AuditorPreviewUploadRow[]
): Record<string, string> {
  const byCase = new Map<string, AuditorPreviewUploadRow[]>();
  for (const row of uploads) {
    const cid = String(row.case_id ?? "");
    if (!cid) continue;
    const list = byCase.get(cid);
    if (list) list.push(row);
    else byCase.set(cid, [row]);
  }

  const out: Record<string, string> = {};
  for (const [caseId, rows] of byCase) {
    const best = pickAuditorCasePreviewUpload(rows);
    if (best?.storage_path) out[caseId] = String(best.storage_path);
  }
  return out;
}
