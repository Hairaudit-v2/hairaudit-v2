/**
 * FI-OUTCOME-INTELLIGENCE-1B — Deterministic data-collection recommendations.
 *
 * Operational / prospective capture only — not clinical advice.
 */

import type {
  CohortCaptureGap,
  CohortDataQualityFlag,
  CohortDataRecommendation,
  ProspectiveCapturePriority,
  StageCoverage,
} from "./cohortAuditTypes";
import type { LongitudinalOutcomeStage } from "@/lib/projection/types";
import { DEFAULT_MIN_COHORT_SIZE } from "./cohortConfig";

function safeEvidence(
  count: number,
  proportion: number | null,
  min: number
): { cohortCount?: number; proportion?: number } {
  if (count >= min) {
    return {
      cohortCount: count,
      proportion: proportion ?? undefined,
    };
  }
  return {};
}

export function buildCaptureGaps(args: {
  uniqueProcedures: number;
  longitudinalCoverage: Record<LongitudinalOutcomeStage, StageCoverage>;
  baselineShare: number | null;
  missingBaseline: number;
  insufficientEvidenceShareMonth12: number | null;
  month12InsufficientEvidence: number;
  unknownGraftCount: number;
  unknownGraftShare: number | null;
  crownCount: number;
  donorEvidenceFalseCount: number;
  flags: CohortDataQualityFlag[];
  minCohortSize?: number;
}): CohortCaptureGap[] {
  const min = args.minCohortSize ?? DEFAULT_MIN_COHORT_SIZE;
  const gaps: CohortCaptureGap[] = [];
  if (args.uniqueProcedures === 0) return gaps;
  const m12 = args.longitudinalCoverage.month_12;

  if (args.flags.includes("LOW_MONTH12_COVERAGE") || (m12.proportionOfCohort ?? 0) < 0.25) {
    gaps.push({
      key: "low_month12_coverage",
      severity: "high",
      description: "Month-12 follow-up coverage is low relative to the cohort.",
      affectedStage: "month_12",
      evidence: safeEvidence(
        m12.proceduresWithStage,
        m12.proportionOfCohort,
        min
      ),
      recommendedAction: "Increase Month-12 follow-up capture.",
    });
  }

  if (args.flags.includes("LOW_BASELINE_COVERAGE") || (args.baselineShare ?? 1) < 0.4) {
    gaps.push({
      key: "low_baseline_coverage",
      severity: "high",
      description: "Verified preoperative baseline is missing for a large share of procedures.",
      evidence: safeEvidence(
        args.missingBaseline,
        args.baselineShare == null ? null : 1 - args.baselineShare,
        min
      ),
      recommendedAction:
        "Require verified preoperative baseline for future projection cases where feasible.",
    });
  }

  if (
    args.flags.includes("HIGH_INSUFFICIENT_EVIDENCE_RATE") ||
    (args.insufficientEvidenceShareMonth12 ?? 0) >= 0.3
  ) {
    gaps.push({
      key: "high_insufficient_evidence",
      severity: "high",
      description:
        "A large share of Month-12 comparisons are limited by insufficient_evidence (capture protocol), not timing.",
      affectedStage: "month_12",
      evidence: safeEvidence(
        args.month12InsufficientEvidence,
        args.insufficientEvidenceShareMonth12,
        min
      ),
      recommendedAction: "Improve standardized follow-up capture protocol.",
    });
  }

  if (args.flags.includes("PROCEDURE_METADATA_MISSINGNESS")) {
    gaps.push({
      key: "procedure_metadata_missingness",
      severity: "moderate",
      description: "Procedure-context bands have high unknown rates.",
      evidence: safeEvidence(args.unknownGraftCount, args.unknownGraftShare, min),
      recommendedAction:
        "Reduce procedure metadata missingness (graft count, procedure type, punch size) at surgery-day capture.",
    });
  }

  if (args.flags.includes("ZONE_REPRESENTATION_IMBALANCE")) {
    gaps.push({
      key: "zone_representation_imbalance",
      severity: "moderate",
      description:
        "Cohort is frontal-heavy; crown/multi-zone representation may bias future intelligence.",
      evidence: safeEvidence(
        args.crownCount,
        args.uniqueProcedures > 0 ? args.crownCount / args.uniqueProcedures : null,
        min
      ),
      recommendedAction:
        "Increase capture of crown/multi-zone procedures before broad calibration.",
    });
  }

  if (args.donorEvidenceFalseCount > 0 && args.uniqueProcedures >= min) {
    const share = args.donorEvidenceFalseCount / args.uniqueProcedures;
    if (share >= 0.4) {
      gaps.push({
        key: "low_donor_evidence",
        severity: "moderate",
        description: "Donor evidence is frequently unavailable in cohort rows.",
        evidence: safeEvidence(args.donorEvidenceFalseCount, share, min),
        recommendedAction:
          "Increase donor rear/close-up capture where donor assessment is relevant.",
      });
    }
  }

  return gaps;
}

export function buildRecommendations(
  gaps: CohortCaptureGap[]
): CohortDataRecommendation[] {
  return gaps.map((g) => ({
    priority: g.severity,
    target: g.affectedStage ?? g.key,
    action:
      g.key === "high_insufficient_evidence"
        ? "improve_protocol"
        : g.key === "procedure_metadata_missingness"
          ? "reduce_missingness"
          : g.key === "zone_representation_imbalance"
            ? "broaden_representation"
            : "increase_capture",
    rationale: g.recommendedAction,
  }));
}

export function buildProspectiveCapturePriorities(
  recommendations: CohortDataRecommendation[]
): ProspectiveCapturePriority[] {
  return recommendations.map((r) => ({
    priority: r.priority,
    target:
      r.target === "month_12"
        ? "month_12"
        : r.target === "low_baseline_coverage" || r.rationale.includes("baseline")
          ? "verified_baseline"
          : r.target,
    action: r.action,
  }));
}
