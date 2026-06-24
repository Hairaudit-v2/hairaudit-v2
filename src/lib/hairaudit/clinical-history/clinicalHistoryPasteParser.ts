/** Deterministic regex paste parser — no AI/OCR. */

export type ParsedClinicalHistorySuggestions = {
  priorGraftCount?: number;
  estimatedHairCount?: number;
  averageHairsPerGraft?: number;
  punchSizeMm?: number;
  singleHairGrafts?: number;
  doubleHairGrafts?: number;
  tripleHairGrafts?: number;
  quadrupleHairGrafts?: number;
  transectionRatePercent?: number;
  survivalEstimatePercent?: number;
};

function parseIntToken(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function parseDecimalToken(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 100) / 100;
}

function parsePercentToken(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
  return Math.round(n * 100) / 100;
}

/**
 * Extract obvious graft/technique patterns from pasted operative notes or PDF text.
 */
export function parseClinicalHistoryPasteText(text: string): ParsedClinicalHistorySuggestions {
  const out: ParsedClinicalHistorySuggestions = {};
  if (!text.trim()) return out;

  const normalized = text.replace(/\s+/g, " ");

  const grafts = normalized.match(/(\d[\d,]*)\s*grafts?/i);
  if (grafts) out.priorGraftCount = parseIntToken(grafts[1]);

  const hairs = normalized.match(/(\d[\d,]*)\s*hairs?/i);
  if (hairs) out.estimatedHairCount = parseIntToken(hairs[1]);

  const ratio =
    normalized.match(/(\d+\.?\d*)\s*(?:hairs?\/)?graft\s*ratio/i) ??
    normalized.match(/ratio\s*[:=]?\s*(\d+\.?\d*)/i) ??
    normalized.match(/(\d+\.?\d*)\s*ratio/i);
  if (ratio) out.averageHairsPerGraft = parseDecimalToken(ratio[1]);

  const punch =
    normalized.match(/(\d+\.?\d*)\s*mm\s*punch/i) ??
    normalized.match(/punch\s*[:=]?\s*(\d+\.?\d*)\s*mm?/i) ??
    normalized.match(/(\d+\.?\d*)\s*punch/i);
  if (punch) out.punchSizeMm = parseDecimalToken(punch[1]);

  const singles = normalized.match(/(\d[\d,]*)\s*singles?/i);
  if (singles) out.singleHairGrafts = parseIntToken(singles[1]);

  const doubles = normalized.match(/(\d[\d,]*)\s*doubles?/i);
  if (doubles) out.doubleHairGrafts = parseIntToken(doubles[1]);

  const triples = normalized.match(/(\d[\d,]*)\s*triples?/i);
  if (triples) out.tripleHairGrafts = parseIntToken(triples[1]);

  const quadruples =
    normalized.match(/(\d[\d,]*)\s*quadruples?/i) ??
    normalized.match(/(\d[\d,]*)\s*quads?/i);
  if (quadruples) out.quadrupleHairGrafts = parseIntToken(quadruples[1]);

  const transection =
    normalized.match(/(\d+\.?\d*)\s*%\s*transection/i) ??
    normalized.match(/transection\s*[:=]?\s*(\d+\.?\d*)\s*%?/i);
  if (transection) out.transectionRatePercent = parsePercentToken(transection[1]);

  const survival =
    normalized.match(/(\d+\.?\d*)\s*%\s*survival/i) ??
    normalized.match(/survival\s*[:=]?\s*(\d+\.?\d*)\s*%?/i);
  if (survival) out.survivalEstimatePercent = parsePercentToken(survival[1]);

  return out;
}

export function hasParsedClinicalHistorySuggestions(parsed: ParsedClinicalHistorySuggestions): boolean {
  return Object.values(parsed).some((v) => v != null);
}

export function formatParsedClinicalHistorySummary(parsed: ParsedClinicalHistorySuggestions): string {
  const parts: string[] = [];
  if (parsed.priorGraftCount != null) parts.push(`${parsed.priorGraftCount} grafts`);
  if (parsed.estimatedHairCount != null) parts.push(`${parsed.estimatedHairCount} hairs`);
  if (parsed.averageHairsPerGraft != null) parts.push(`ratio ${parsed.averageHairsPerGraft}`);
  if (parsed.punchSizeMm != null) parts.push(`punch ${parsed.punchSizeMm}mm`);
  if (parsed.singleHairGrafts != null) parts.push(`${parsed.singleHairGrafts} singles`);
  if (parsed.doubleHairGrafts != null) parts.push(`${parsed.doubleHairGrafts} doubles`);
  if (parsed.tripleHairGrafts != null) parts.push(`${parsed.tripleHairGrafts} triples`);
  if (parsed.quadrupleHairGrafts != null) parts.push(`${parsed.quadrupleHairGrafts} quadruples`);
  if (parsed.transectionRatePercent != null) parts.push(`${parsed.transectionRatePercent}% transection`);
  if (parsed.survivalEstimatePercent != null) parts.push(`${parsed.survivalEstimatePercent}% survival`);
  return parts.length ? `Detected: ${parts.join(", ")}` : "";
}
