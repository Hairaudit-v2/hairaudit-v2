/**
 * HA-INTELLIGENCE-2 — read advisory intelligence bundle from legacy report summary metadata.
 */

import type { HairAuditIntelligenceBundle } from "@/lib/hairaudit-intelligence/types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isBundleShape(v: unknown): v is HairAuditIntelligenceBundle {
  if (!isRecord(v)) return false;
  return (
    typeof v.engineVersion === "string" &&
    typeof v.generatedAt === "string" &&
    isRecord(v.hairLossClassification) &&
    isRecord(v.donorIntelligence) &&
    isRecord(v.repairSurgery) &&
    isRecord(v.proceduralIntelligence)
  );
}

export function extractHairAuditIntelligenceFromSummary(
  summary: unknown
): HairAuditIntelligenceBundle | null {
  if (!isRecord(summary)) return null;
  const metadata = summary.metadata;
  if (!isRecord(metadata)) return null;
  const bundle = metadata.hairAuditIntelligence;
  return isBundleShape(bundle) ? bundle : null;
}
