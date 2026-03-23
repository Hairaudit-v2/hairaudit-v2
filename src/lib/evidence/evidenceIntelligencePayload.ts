/**
 * Additive "Evidence Intelligence" snapshot for reports / PDF (optional; never required for render).
 */

import { evaluateEvidence, type CasePhotoInput, type EvidenceEvaluationResult } from "./evidenceEvaluator";
import { EVIDENCE_KEY_DISPLAY_LABELS } from "./evidenceMissingCopy";
import { EVIDENCE_REQUIREMENTS, type EvidenceRequirementKey, type SurgicalMetricId } from "./evidenceRequirements";

/**
 * Short, actionable labels for the Evidence Intelligence PDF block and stored `missing[]` arrays.
 * (Differs from `EVIDENCE_KEY_DISPLAY_LABELS`, which stays for other report copy.)
 */
export const EVIDENCE_INTELLIGENCE_DISPLAY_LABELS: Record<EvidenceRequirementKey, string> = {
  recipient_day0_macro: "Day 0 recipient macro",
  recipient_day0_angle: "angled / lateral recipient views",
  recipient_mid_range: "mid-range recipient views",
  hairline_frontal_macro: "frontal hairline macro",
  hairline_oblique: "oblique hairline views",
  extraction_phase_closeup: "extraction-phase close-up",
  graft_macro: "graft macro inspection",
  donor_preop: "pre-op donor views",
  donor_shaved_macro: "shaved donor macro",
  donor_postop_shaved: "post-op shaved donor",
  donor_healed: "healed / follow-up donor",
  graft_tray_overview: "graft tray overview",
  graft_tray_closeup: "graft tray close-up",
};

const LEGACY_LONG_LABEL_TO_COMPACT: Record<string, string> = Object.fromEntries(
  (Object.keys(EVIDENCE_KEY_DISPLAY_LABELS) as EvidenceRequirementKey[]).map((k) => [
    EVIDENCE_KEY_DISPLAY_LABELS[k],
    EVIDENCE_INTELLIGENCE_DISPLAY_LABELS[k],
  ])
);

function isEvidenceRequirementKey(s: string): s is EvidenceRequirementKey {
  return Object.prototype.hasOwnProperty.call(EVIDENCE_INTELLIGENCE_DISPLAY_LABELS, s);
}

/** Normalize stored missing items (requirement keys or legacy long labels) for PDF display. */
export function normalizeEvidenceIntelligenceMissingDisplay(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return t;
  if (/^[a-z0-9_]+$/.test(t) && isEvidenceRequirementKey(t)) {
    return EVIDENCE_INTELLIGENCE_DISPLAY_LABELS[t];
  }
  return LEGACY_LONG_LABEL_TO_COMPACT[t] ?? t;
}

export type EvidenceIntelligenceMetricStatus = "complete" | "partial" | "insufficient";

export type EvidenceIntelligenceMetricEntry = {
  status: EvidenceIntelligenceMetricStatus;
  provided: number;
  required: number;
  missing: string[];
};

/** Stored under `summary.evidenceIntelligence` (JSON). Snake_case keys match forensic_audit style. */
export type EvidenceIntelligencePayload = {
  coverageScore: number;
  providedCount: number;
  expectedCount: number;
  metrics: Record<string, EvidenceIntelligenceMetricEntry>;
  missingEvidenceByMetric: Record<string, string[]>;
};

const SURGICAL_ORDER: readonly SurgicalMetricId[] = [
  "implant_density",
  "hairline_naturalness",
  "transection_risk",
  "donor_quality",
  "donor_scar_visibility",
  "graft_handling",
];

function metricEntryFromEval(
  id: SurgicalMetricId,
  evalResult: EvidenceEvaluationResult
): EvidenceIntelligenceMetricEntry {
  const m = evalResult.metricCoverage[id];
  const def = EVIDENCE_REQUIREMENTS[id];
  const totalSlots = def.required.length;
  const missingKeys = m.missing as EvidenceRequirementKey[];
  const missingLabels = missingKeys.map(
    (k) => EVIDENCE_INTELLIGENCE_DISPLAY_LABELS[k] ?? k.replaceAll("_", " ")
  );
  return {
    status: m.status,
    provided: m.provided,
    required: totalSlots,
    missing: missingLabels,
  };
}

/**
 * Builds optional evidence intelligence for report JSON / PDF. Returns `null` if evaluation fails or input empty.
 */
export function buildEvidenceIntelligencePayload(
  casePhotos: readonly CasePhotoInput[]
): EvidenceIntelligencePayload | null {
  try {
    if (!casePhotos?.length) return null;
    const evalResult = evaluateEvidence(casePhotos);
    const metrics: Record<string, EvidenceIntelligenceMetricEntry> = {};
    const missingEvidenceByMetric: Record<string, string[]> = {};
    let providedSum = 0;
    let expectedSum = 0;

    for (const id of SURGICAL_ORDER) {
      const entry = metricEntryFromEval(id, evalResult);
      metrics[id] = entry;
      missingEvidenceByMetric[id] = entry.missing;
      providedSum += entry.provided;
      expectedSum += entry.required;
    }

    // Implantation technique uses same photo-evidence model as implant density (additive alias).
    metrics.implantation_technique = { ...metrics.implant_density };
    missingEvidenceByMetric.implantation_technique = [...metrics.implant_density.missing];

    return {
      coverageScore: evalResult.overallCoverageScore,
      providedCount: providedSum,
      expectedCount: expectedSum,
      metrics,
      missingEvidenceByMetric,
    };
  } catch {
    return null;
  }
}

/** Loose parse for persisted summary (invalid shapes return null). */
export function parseEvidenceIntelligencePayload(raw: unknown): EvidenceIntelligencePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const cov = Number(o.coverageScore);
  if (!Number.isFinite(cov)) return null;
  const metrics = o.metrics;
  if (!metrics || typeof metrics !== "object") return null;
  return {
    coverageScore: Math.round(Math.max(0, Math.min(100, cov))),
    providedCount: Number.isFinite(Number(o.providedCount)) ? Math.max(0, Math.round(Number(o.providedCount))) : 0,
    expectedCount: Number.isFinite(Number(o.expectedCount)) ? Math.max(0, Math.round(Number(o.expectedCount))) : 0,
    metrics: metrics as Record<string, EvidenceIntelligenceMetricEntry>,
    missingEvidenceByMetric:
      o.missingEvidenceByMetric && typeof o.missingEvidenceByMetric === "object"
        ? (o.missingEvidenceByMetric as Record<string, string[]>)
        : {},
  };
}
