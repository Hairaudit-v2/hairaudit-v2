/**
 * HA-PROJECTION-1A — Normalize existing zone vocabularies into one RecipientZone set.
 * Does not invent Zone 1–4.
 */

import type { RecipientZone } from "./types";

export type NormalizedZone = {
  normalized: RecipientZone;
  raw: string;
  source: "areas_treated" | "zones_planned" | "clinical_history" | "ai_wording" | "other";
};

const RAW_TO_ZONE: ReadonlyArray<{ match: RegExp; zone: RecipientZone }> = [
  { match: /frontal[_\s-]?hairline|^hairline$/i, zone: "hairline" },
  { match: /hairline/i, zone: "hairline" },
  { match: /temple/i, zone: "temples" },
  { match: /frontal[_\s-]?tuft|frontal/i, zone: "frontal" },
  { match: /forelock/i, zone: "forelock" },
  { match: /mid[_\s-]?scalp|midscalp/i, zone: "mid_scalp" },
  { match: /crown|vertex/i, zone: "crown" },
];

export function normalizeRecipientZone(raw: string): RecipientZone {
  const s = String(raw ?? "").trim();
  if (!s) return "other";
  for (const row of RAW_TO_ZONE) {
    if (row.match.test(s)) return row.zone;
  }
  return "other";
}

export function normalizeZoneList(
  values: unknown,
  source: NormalizedZone["source"]
): NormalizedZone[] {
  const arr = Array.isArray(values) ? values : values != null ? [values] : [];
  const out: NormalizedZone[] = [];
  for (const v of arr) {
    const raw = String(v ?? "").trim();
    if (!raw) continue;
    out.push({ normalized: normalizeRecipientZone(raw), raw, source });
  }
  return out;
}

export function uniqueNormalizedZones(zones: NormalizedZone[]): RecipientZone[] {
  const order: RecipientZone[] = [
    "hairline",
    "temples",
    "frontal",
    "forelock",
    "mid_scalp",
    "crown",
    "other",
  ];
  const set = new Set(zones.map((z) => z.normalized));
  return order.filter((z) => set.has(z));
}

/**
 * Derive a coarse treatment-extent label from normalized zones (observed / reported).
 */
export function describeTreatmentExtent(zones: RecipientZone[]): string {
  const has = (z: RecipientZone) => zones.includes(z);
  const scalpZones = zones.filter((z) => z !== "other");
  if (scalpZones.length === 0) return "unspecified";
  if (scalpZones.length >= 3) return "multi-zone";
  if (has("crown") && (has("hairline") || has("frontal") || has("mid_scalp"))) return "multi-zone";
  if (has("crown") && scalpZones.length === 1) return "crown";
  if ((has("hairline") || has("frontal")) && has("mid_scalp")) return "frontal + mid-scalp";
  if (has("hairline") && !has("frontal") && !has("mid_scalp") && !has("crown")) return "hairline only";
  if (has("frontal") || has("hairline") || has("forelock") || has("temples")) return "frontal";
  return "multi-zone";
}
