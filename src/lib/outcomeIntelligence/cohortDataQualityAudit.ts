/**
 * FI-OUTCOME-INTELLIGENCE-1B — OutcomeCohortDataQualityAuditService.
 *
 * Aggregate-only audit over de-identified 1A cohort rows.
 * Does not enable production materialization or return PHI / HMAC keys / raw rows.
 */

import type { LongitudinalOutcomeStage } from "@/lib/projection/types";
import {
  buildCaptureGaps,
  buildProspectiveCapturePriorities,
  buildRecommendations,
} from "./cohortAuditRecommendations";
import type {
  DomainCoverageEntry,
  MaterializationStatus,
  OutcomeCohortDataQualityAudit,
  SafeDistribution,
} from "./cohortAuditTypes";
import { DEFAULT_MIN_COHORT_SIZE, resolveOutcomeCohortConfig } from "./cohortConfig";
import {
  AUDIT_DOMAINS,
  AUDIT_STAGES,
  assessabilityForStage,
  buildFollowUpRetention,
  buildSafeDistribution,
  buildStageCoverage,
  confidenceFromRows,
  domainStatusCounts,
  evidenceByProcedure,
  proportionOrNull,
  suppressCount,
  uniqueProcedureKeys,
  uniqueSubjectKeys,
} from "./cohortCoverage";
import { deriveDataQualityFlags } from "./cohortDataQualityFlags";
import { evaluateCohortGovernance } from "./cohortGovernance";
import type { OutcomeCohortRepository } from "./cohortRepository";
import {
  countEligibleForFutureCalibration,
  resolveCalibrationReadiness,
} from "./cohortReadiness";
import { COHORT_SCHEMA_VERSION, type OutcomeLongitudinalCohortRow } from "./cohortTypes";

const ALLOWED_DOMAINS = new Set<string>(AUDIT_DOMAINS);
const ALLOWED_STAGES = new Set<string>(AUDIT_STAGES);

export type OutcomeCohortDataQualityAuditDeps = {
  cohortRepository: OutcomeCohortRepository;
  minCohortSize?: number;
  /** Injected clock for tests. */
  now?: string;
  /**
   * When true, treat materialization as enabled for status reporting
   * (does not flip production env flags).
   */
  materializationEnabled?: boolean;
};

function mapCategory(
  current: OutcomeLongitudinalCohortRow[],
  getKey: (row: OutcomeLongitudinalCohortRow) => string
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const row of current) {
    const key = getKey(row);
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(row.cohortProcedureKey);
  }
  return map;
}

function versionDistribution(
  current: OutcomeLongitudinalCohortRow[],
  field:
    | "projectionSchemaVersion"
    | "observationSchemaVersion"
    | "comparisonSchemaVersion"
    | "cohortSchemaVersion",
  min: number
): SafeDistribution {
  return buildSafeDistribution({
    categoryToProcedures: mapCategory(current, (r) => String(r[field] || "missing")),
    minCohortSize: min,
  });
}

function auditLineageHealth(all: OutcomeLongitudinalCohortRow[]): {
  currentRows: number;
  supersededRows: number;
  rowsMissingChecksum: number;
  invalidDomainCount: number;
  invalidStageCount: number;
  missingSchemaVersionCount: number;
  duplicateIdempotencyIdentities: number;
  integrityIssue: boolean;
} {
  const current = all.filter((r) => r.isCurrentSourceLineage);
  const superseded = all.filter((r) => !r.isCurrentSourceLineage);
  let rowsMissingChecksum = 0;
  let invalidDomainCount = 0;
  let invalidStageCount = 0;
  let missingSchemaVersionCount = 0;

  const idempo = new Map<string, number>();
  for (const row of all) {
    if (!row.rowChecksum || !row.projectionSnapshotChecksum) rowsMissingChecksum += 1;
    if (!ALLOWED_DOMAINS.has(row.projectionDomain)) invalidDomainCount += 1;
    if (!ALLOWED_STAGES.has(row.followupStage)) invalidStageCount += 1;
    if (
      !row.projectionSchemaVersion ||
      !row.observationSchemaVersion ||
      !row.comparisonSchemaVersion ||
      !row.cohortSchemaVersion
    ) {
      missingSchemaVersionCount += 1;
    }
    const key = [
      row.cohortProcedureKey,
      row.projectionSnapshotChecksum,
      row.observationSnapshotChecksum,
      row.comparisonSnapshotChecksum,
      row.projectionDomain,
      row.cohortSchemaVersion,
    ].join("|");
    idempo.set(key, (idempo.get(key) ?? 0) + 1);
  }
  let duplicateIdempotencyIdentities = 0;
  for (const n of idempo.values()) {
    if (n > 1) duplicateIdempotencyIdentities += 1;
  }

  const integrityIssue =
    rowsMissingChecksum > 0 ||
    invalidDomainCount > 0 ||
    invalidStageCount > 0 ||
    missingSchemaVersionCount > 0 ||
    duplicateIdempotencyIdentities > 0;

  return {
    currentRows: current.length,
    supersededRows: superseded.length,
    rowsMissingChecksum,
    invalidDomainCount,
    invalidStageCount,
    missingSchemaVersionCount,
    duplicateIdempotencyIdentities,
    integrityIssue,
  };
}

export class OutcomeCohortDataQualityAuditService {
  private readonly min: number;

  constructor(private readonly deps: OutcomeCohortDataQualityAuditDeps) {
    this.min = deps.minCohortSize ?? DEFAULT_MIN_COHORT_SIZE;
  }

  async runCohortDataQualityAudit(): Promise<OutcomeCohortDataQualityAudit> {
    const config = resolveOutcomeCohortConfig();
    const governance = evaluateCohortGovernance({
      governanceApprovedEnv: config.governanceApproved,
    });
    // Preserve NEEDS_POLICY_CONFIRMATION when env not approved — never flip approval here.
    const governanceStatus = governance.status;

    const all = await this.deps.cohortRepository.listAll();
    const current = all.filter((r) => r.isCurrentSourceLineage);
    const uniqueProcedures = uniqueProcedureKeys(current).size;
    const uniqueSubjects = uniqueSubjectKeys(current).size;

    const enabled =
      this.deps.materializationEnabled ?? config.enabled;
    let materializationStatus: MaterializationStatus;
    if (!enabled && current.length === 0) materializationStatus = "not_enabled";
    else if (current.length === 0) materializationStatus = "enabled_no_rows";
    else materializationStatus = "populated";

    const longitudinalCoverage = {
      month_3: buildStageCoverage({
        stageRows: current.filter((r) => r.followupStage === "month_3"),
        totalUniqueProcedures: uniqueProcedures,
      }),
      month_6: buildStageCoverage({
        stageRows: current.filter((r) => r.followupStage === "month_6"),
        totalUniqueProcedures: uniqueProcedures,
      }),
      month_9: buildStageCoverage({
        stageRows: current.filter((r) => r.followupStage === "month_9"),
        totalUniqueProcedures: uniqueProcedures,
      }),
      month_12: buildStageCoverage({
        stageRows: current.filter((r) => r.followupStage === "month_12"),
        totalUniqueProcedures: uniqueProcedures,
      }),
    };

    const followUpRetention = buildFollowUpRetention(current);

    // Baseline from assessmentMode + baselineAvailable (normalized 1A fields only)
    const procs = new Map<string, OutcomeLongitudinalCohortRow>();
    for (const row of current) {
      if (!procs.has(row.cohortProcedureKey)) procs.set(row.cohortProcedureKey, row);
    }
    let withBaseline = 0;
    let withoutBaseline = 0;
    let surgeryDayOnly = 0;
    let unknownAssessmentMode = 0;
    for (const row of procs.values()) {
      if (row.baselineAvailable || row.assessmentMode === "baseline_plus_surgery_day") {
        withBaseline += 1;
      } else {
        withoutBaseline += 1;
      }
      if (row.assessmentMode === "surgery_day_only") surgeryDayOnly += 1;
      if (row.assessmentMode === "unknown") unknownAssessmentMode += 1;
    }

    const evidenceMap = evidenceByProcedure(current);
    const evidenceQuality = {
      low: 0,
      moderate: 0,
      high: 0,
    };
    for (const b of evidenceMap.values()) evidenceQuality[b] += 1;

    const evidenceQualityByStage = Object.fromEntries(
      AUDIT_STAGES.map((stage) => {
        const stageRows = current.filter((r) => r.followupStage === stage);
        const map = evidenceByProcedure(stageRows);
        const dist = { low: 0, moderate: 0, high: 0 };
        for (const b of map.values()) dist[b] += 1;
        return [stage, dist];
      })
    ) as OutcomeCohortDataQualityAudit["evidenceQualityByStage"];

    const highEvidenceShareByStage = Object.fromEntries(
      AUDIT_STAGES.map((stage) => {
        const dist = evidenceQualityByStage[stage];
        const total = dist.low + dist.moderate + dist.high;
        return [stage, proportionOrNull(dist.high, total)];
      })
    ) as Record<LongitudinalOutcomeStage, number | null>;

    const projectionConfidence = confidenceFromRows(current, "projectionConfidenceBand");
    const observationConfidence = confidenceFromRows(current, "observationConfidenceBand");
    const comparisonConfidence = confidenceFromRows(current, "comparisonConfidenceBand");

    const assessability = {
      byStage: Object.fromEntries(
        AUDIT_STAGES.map((stage) => [
          stage,
          assessabilityForStage(current.filter((r) => r.followupStage === stage)),
        ])
      ) as OutcomeCohortDataQualityAudit["assessability"]["byStage"],
    };

    const domainCoverage = Object.fromEntries(
      AUDIT_DOMAINS.map((domain) => {
        const domainRows = current.filter((r) => r.projectionDomain === domain);
        const stages = Object.fromEntries(
          AUDIT_STAGES.map((stage) => [
            stage,
            uniqueProcedureKeys(
              domainRows.filter((r) => r.followupStage === stage)
            ).size,
          ])
        ) as Record<LongitudinalOutcomeStage, number>;

        const statusByStage = Object.fromEntries(
          AUDIT_STAGES.map((stage) => {
            const rows = domainRows.filter((r) => r.followupStage === stage);
            const counts = domainStatusCounts(rows);
            if (counts.uniqueProcedures > 0 && counts.uniqueProcedures < this.min) {
              return [
                stage,
                { ok: false as const, code: "insufficient_cohort_size" as const },
              ];
            }
            return [stage, counts];
          })
        ) as DomainCoverageEntry["statusByStage"];

        const entry: DomainCoverageEntry = {
          uniqueProcedures: uniqueProcedureKeys(domainRows).size,
          stages,
          statusByStage,
        };
        return [domain, entry];
      })
    ) as OutcomeCohortDataQualityAudit["domainCoverage"];

    const zoneRaw = {
      hairline: uniqueProcedureKeys(current.filter((r) => r.treatedHairline)).size,
      temples: uniqueProcedureKeys(current.filter((r) => r.treatedTemples)).size,
      frontal: uniqueProcedureKeys(current.filter((r) => r.treatedFrontal)).size,
      forelock: uniqueProcedureKeys(current.filter((r) => r.treatedForelock)).size,
      midScalp: uniqueProcedureKeys(current.filter((r) => r.treatedMidScalp)).size,
      crown: uniqueProcedureKeys(current.filter((r) => r.treatedCrown)).size,
    };

    const treatmentZoneCoverage = {
      hairline: suppressCount(zoneRaw.hairline, this.min),
      temples: suppressCount(zoneRaw.temples, this.min),
      frontal: suppressCount(zoneRaw.frontal, this.min),
      forelock: suppressCount(zoneRaw.forelock, this.min),
      midScalp: suppressCount(zoneRaw.midScalp, this.min),
      crown: suppressCount(zoneRaw.crown, this.min),
    };

    const procedureContextCoverage = {
      procedureType: buildSafeDistribution({
        categoryToProcedures: mapCategory(current, (r) => r.procedureTypeNormalized),
        minCohortSize: this.min,
      }),
      graftCountBand: buildSafeDistribution({
        categoryToProcedures: mapCategory(current, (r) => r.graftCountBand),
        minCohortSize: this.min,
      }),
      hairsPerGraftBand: buildSafeDistribution({
        categoryToProcedures: mapCategory(current, (r) => r.hairsPerGraftBand),
        minCohortSize: this.min,
      }),
      punchSizeBand: buildSafeDistribution({
        categoryToProcedures: mapCategory(current, (r) => r.punchSizeBand),
        minCohortSize: this.min,
      }),
    };

    const unknownProcedureType = uniqueProcedureKeys(
      current.filter((r) => r.procedureTypeNormalized === "unknown")
    ).size;
    const unknownGraftCountBand = uniqueProcedureKeys(
      current.filter((r) => r.graftCountBand === "unknown")
    ).size;
    const unknownHairsPerGraftBand = uniqueProcedureKeys(
      current.filter((r) => r.hairsPerGraftBand === "unknown")
    ).size;
    const unknownPunchSizeBand = uniqueProcedureKeys(
      current.filter((r) => r.punchSizeBand === "unknown")
    ).size;
    const missingBaseline = withoutBaseline;
    const lowEvidence = evidenceQuality.low;
    const missingMonth12FollowUp = Math.max(
      0,
      uniqueProcedures - longitudinalCoverage.month_12.proceduresWithStage
    );

    const missingData = {
      unknownProcedureType,
      unknownGraftCountBand,
      unknownHairsPerGraftBand,
      unknownPunchSizeBand,
      missingBaseline,
      lowEvidence,
      missingMonth12FollowUp,
      proportions: {
        unknownProcedureType: proportionOrNull(unknownProcedureType, uniqueProcedures),
        unknownGraftCountBand: proportionOrNull(unknownGraftCountBand, uniqueProcedures),
        unknownHairsPerGraftBand: proportionOrNull(
          unknownHairsPerGraftBand,
          uniqueProcedures
        ),
        unknownPunchSizeBand: proportionOrNull(unknownPunchSizeBand, uniqueProcedures),
        missingBaseline: proportionOrNull(missingBaseline, uniqueProcedures),
        lowEvidence: proportionOrNull(lowEvidence, uniqueProcedures),
        missingMonth12FollowUp: proportionOrNull(missingMonth12FollowUp, uniqueProcedures),
      },
    };

    const projVersions = versionDistribution(current, "projectionSchemaVersion", this.min);
    const obsVersions = versionDistribution(current, "observationSchemaVersion", this.min);
    const cmpVersions = versionDistribution(current, "comparisonSchemaVersion", this.min);
    const cohortVersions = versionDistribution(current, "cohortSchemaVersion", this.min);

    const countDistinctVersions = (d: SafeDistribution): number => {
      if (!d.ok) return 0;
      return d.buckets.filter((b) => b.key !== "__other_suppressed__").length +
        (d.buckets.some((b) => b.key === "__other_suppressed__") ? 2 : 0);
    };
    // Heterogeneity: more than one distinct schema version present among procedures
    const versionKeySets = [
      mapCategory(current, (r) => r.projectionSchemaVersion),
      mapCategory(current, (r) => r.observationSchemaVersion),
      mapCategory(current, (r) => r.comparisonSchemaVersion),
      mapCategory(current, (r) => r.cohortSchemaVersion),
    ];
    const heterogeneityFlagged = versionKeySets.some((m) => m.size > 1);

    const schemaVersionHealth = {
      projectionSchemaVersions: projVersions,
      observationSchemaVersions: obsVersions,
      comparisonSchemaVersions: cmpVersions,
      cohortSchemaVersions: cohortVersions,
      heterogeneityFlagged,
    };
    void countDistinctVersions;

    const lineageHealth = auditLineageHealth(all);

    const eligible = countEligibleForFutureCalibration(current);
    const month12Procedures = longitudinalCoverage.month_12.proceduresWithStage;
    const domainsAtMonth12 = AUDIT_DOMAINS.filter(
      (d) => domainCoverage[d].stages.month_12 > 0
    ).length;

    const m12Assess = assessability.byStage.month_12;
    const m12Total =
      m12Assess.assessable +
      m12Assess.notYetAssessable +
      m12Assess.insufficientEvidence;
    const insufficientEvidenceShareMonth12 = proportionOrNull(
      m12Assess.insufficientEvidence,
      m12Total
    );

    const lowComparisonConfidenceShare = proportionOrNull(
      comparisonConfidence.low,
      comparisonConfidence.low +
        comparisonConfidence.moderate +
        comparisonConfidence.high
    );

    const baselineShare = proportionOrNull(withBaseline, uniqueProcedures);

    const calibrationReadiness = resolveCalibrationReadiness({
      uniqueProcedures,
      month12Procedures,
      eligible,
      domainsAtMonth12,
      highEvidenceShareMonth12: highEvidenceShareByStage.month_12,
      unknownGraftShare: missingData.proportions.unknownGraftCountBand,
      baselineShare,
      materializationPopulated: materializationStatus === "populated",
      minCohortSize: this.min,
    });

    const dataQualityFlags = deriveDataQualityFlags({
      uniqueProcedures,
      longitudinalCoverage,
      baselineShare,
      insufficientEvidenceShareMonth12,
      lowComparisonConfidenceShare,
      zoneCounts: zoneRaw,
      missingData,
      schemaVersionHealth,
      lineageHealth,
      month12Procedures,
      eligible,
      minCohortSize: this.min,
    });

    const donorEvidenceFalseCount = uniqueProcedureKeys(
      current.filter((r) => !r.donorEvidenceAvailable)
    ).size;

    const captureGaps = buildCaptureGaps({
      uniqueProcedures,
      longitudinalCoverage,
      baselineShare,
      missingBaseline,
      insufficientEvidenceShareMonth12,
      month12InsufficientEvidence: m12Assess.insufficientEvidence,
      unknownGraftCount: unknownGraftCountBand,
      unknownGraftShare: missingData.proportions.unknownGraftCountBand,
      crownCount: zoneRaw.crown,
      donorEvidenceFalseCount,
      flags: dataQualityFlags,
      minCohortSize: this.min,
    });

    const recommendations = buildRecommendations(captureGaps);
    const prospectiveCapturePriorities =
      buildProspectiveCapturePriorities(recommendations);

    return {
      generatedAt: this.deps.now ?? new Date().toISOString(),
      cohortSchemaVersion: COHORT_SCHEMA_VERSION,
      tenantScope: "deployment_local",
      governanceStatus,
      productionActivation:
        governanceStatus === "APPROVED_EXISTING_BASIS"
          ? "OPERATOR_APPROVED"
          : "BLOCKED_PENDING_POLICY_CONFIRMATION",
      materializationStatus,
      cohort: {
        uniqueProcedures,
        uniqueSubjects,
        currentDomainRows: current.length,
        supersededDomainRows: all.length - current.length,
      },
      longitudinalCoverage,
      followUpRetention,
      baselineCoverage: {
        withBaseline,
        withoutBaseline,
        surgeryDayOnly,
        unknownAssessmentMode,
        proportionWithBaseline: baselineShare,
      },
      evidenceQuality,
      evidenceQualityByStage,
      highEvidenceShareByStage,
      projectionConfidence,
      observationConfidence,
      comparisonConfidence,
      assessability,
      domainCoverage,
      treatmentZoneCoverage,
      procedureContextCoverage,
      missingData,
      schemaVersionHealth,
      lineageHealth,
      calibrationReadiness,
      dataQualityFlags,
      captureGaps,
      recommendations,
      prospectiveCapturePriorities,
    };
  }

  async getLongitudinalCoverageAudit() {
    const audit = await this.runCohortDataQualityAudit();
    return {
      longitudinalCoverage: audit.longitudinalCoverage,
      followUpRetention: audit.followUpRetention,
    };
  }

  async getDomainCoverageAudit() {
    const audit = await this.runCohortDataQualityAudit();
    return audit.domainCoverage;
  }

  async getEvidenceQualityAudit() {
    const audit = await this.runCohortDataQualityAudit();
    return {
      evidenceQuality: audit.evidenceQuality,
      evidenceQualityByStage: audit.evidenceQualityByStage,
      projectionConfidence: audit.projectionConfidence,
      observationConfidence: audit.observationConfidence,
      comparisonConfidence: audit.comparisonConfidence,
    };
  }

  async getCalibrationReadinessAudit() {
    const audit = await this.runCohortDataQualityAudit();
    return audit.calibrationReadiness;
  }
}

export function createOutcomeCohortDataQualityAuditService(
  deps: OutcomeCohortDataQualityAuditDeps
): OutcomeCohortDataQualityAuditService {
  return new OutcomeCohortDataQualityAuditService(deps);
}

/**
 * Strip any accidental identity-like fields before CLI/artifact export.
 * Audit output must never include HMAC keys or raw IDs.
 */
export function sanitizeAuditForExport(
  audit: OutcomeCohortDataQualityAudit
): OutcomeCohortDataQualityAudit {
  const json = JSON.stringify(audit);
  if (
    /cohortProcedureKey|cohortSubjectKey|patient_id|case_id|patientId|caseId/.test(
      json
    )
  ) {
    throw new Error("Audit export failed de-identification safety scan.");
  }
  return audit;
}

export function formatAuditHumanReadable(
  audit: OutcomeCohortDataQualityAudit
): string {
  const pct = (n: number | null) =>
    n == null ? "n/a" : `${(n * 100).toFixed(1)}%`;
  const lines = [
    "FI Outcome Cohort Data Quality",
    "",
    "Governance",
    audit.governanceStatus,
    `Production activation: ${audit.productionActivation}`,
    "",
    "Materialization",
    audit.materializationStatus.toUpperCase().replace(/_/g, " "),
    "",
    "Unique procedures",
    String(audit.cohort.uniqueProcedures),
    "",
    "Longitudinal coverage",
    `Month 3  ${audit.longitudinalCoverage.month_3.proceduresWithStage} (${pct(audit.longitudinalCoverage.month_3.proportionOfCohort)})`,
    `Month 6  ${audit.longitudinalCoverage.month_6.proceduresWithStage} (${pct(audit.longitudinalCoverage.month_6.proportionOfCohort)})`,
    `Month 9  ${audit.longitudinalCoverage.month_9.proceduresWithStage} (${pct(audit.longitudinalCoverage.month_9.proportionOfCohort)})`,
    `Month 12 ${audit.longitudinalCoverage.month_12.proceduresWithStage} (${pct(audit.longitudinalCoverage.month_12.proportionOfCohort)})`,
    "",
    "Baseline coverage",
    `withBaseline=${audit.baselineCoverage.withBaseline} (${pct(audit.baselineCoverage.proportionWithBaseline)})`,
    "",
    "Evidence quality",
    `low=${audit.evidenceQuality.low} moderate=${audit.evidenceQuality.moderate} high=${audit.evidenceQuality.high}`,
    "",
    "Calibration readiness",
    audit.calibrationReadiness.status,
    "",
    "Top data gaps",
  ];
  const gaps = audit.captureGaps.slice(0, 5);
  if (gaps.length === 0) lines.push("(none)");
  else gaps.forEach((g, i) => lines.push(`${i + 1}. [${g.severity}] ${g.description}`));
  lines.push("");
  lines.push(`Tenant scope: ${audit.tenantScope}`);
  lines.push(`Flags: ${audit.dataQualityFlags.join(", ") || "(none)"}`);
  return lines.join("\n");
}
