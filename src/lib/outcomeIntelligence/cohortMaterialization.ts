/**
 * FI-OUTCOME-INTELLIGENCE-1A — OutcomeCohortMaterializationService.
 *
 * Derives analytics-safe cohort rows from frozen 1D/1E/1F lineage only.
 * Does not mutate source snapshots. Not a public patient endpoint.
 */

import { randomUUID } from "node:crypto";
import type { ProjectionComparisonSnapshot } from "@/lib/projection/projectionComparisonTypes";
import type { ProjectionObservationSnapshot } from "@/lib/projection/projectionObservationTypes";
import type { ProjectionSnapshot } from "@/lib/projection/projectionSnapshotTypes";
import type { ProjectionComparisonRepository } from "@/lib/projection/projectionComparisonRepository";
import type { ProjectionObservationRepository } from "@/lib/projection/projectionObservationRepository";
import type { ProjectionSnapshotRepository } from "@/lib/projection/projectionSnapshotRepository";
import type { ProjectedOutcomeDomain, ProjectionComparisonStatus } from "@/lib/projection/types";
import {
  createCohortAuditEvent,
  type OutcomeCohortAuditSink,
} from "./cohortAudit";
import {
  assertCohortMaterializationAllowed,
  resolveOutcomeCohortConfig,
  type OutcomeCohortConfig,
} from "./cohortConfig";
import {
  computeCohortRowChecksum,
  validateCohortRowDeidentified,
} from "./cohortDeidentification";
import {
  deriveCohortPartitionKey,
  deriveCohortProcedureKey,
  deriveCohortSubjectKey,
} from "./cohortIdentity";
import {
  bandConfidence,
  deriveEvidenceCompletenessBand,
  extractProcedureMetadataBands,
  isAllowedFollowupStage,
  resolveAssessmentMode,
} from "./cohortNormalization";
import type { OutcomeCohortRepository } from "./cohortRepository";
import {
  COHORT_SCHEMA_VERSION,
  type MaterializeCohortResult,
  type OutcomeLongitudinalCohortRow,
} from "./cohortTypes";

const ALLOWED_STATUSES: ReadonlySet<ProjectionComparisonStatus> = new Set([
  "consistent",
  "partially_consistent",
  "divergent",
  "not_yet_assessable",
  "insufficient_evidence",
]);

const ALLOWED_DOMAINS: ReadonlySet<ProjectedOutcomeDomain> = new Set([
  "frontal_framing",
  "density_distribution",
  "transition_characteristics",
  "native_hair_dependency",
  "untreated_or_lower_treatment_areas",
]);

export type OutcomeCohortMaterializationDeps = {
  cohortRepository: OutcomeCohortRepository;
  comparisonRepository: ProjectionComparisonRepository;
  observationRepository: ProjectionObservationRepository;
  projectionRepository: ProjectionSnapshotRepository;
  audit?: OutcomeCohortAuditSink;
  config?: OutcomeCohortConfig;
};

export type MaterializeFromComparisonInput = {
  comparisonId: string;
  actorId?: string | null;
  now?: string;
};

function resolveProjectionContentChecksum(projection: ProjectionSnapshot): string {
  return projection.projectionOutputChecksum;
}

export class OutcomeCohortMaterializationService {
  constructor(private readonly deps: OutcomeCohortMaterializationDeps) {}

  private config(): OutcomeCohortConfig {
    return this.deps.config ?? resolveOutcomeCohortConfig();
  }

  /**
   * Materialize domain-grain cohort rows from a frozen 1F comparison.
   * Idempotent. Marks prior lineage rows non-current when comparison supersedes.
   */
  async materializeFromComparison(
    input: MaterializeFromComparisonInput
  ): Promise<MaterializeCohortResult> {
    const config = this.config();
    const gate = assertCohortMaterializationAllowed(config);
    if (!gate.ok) {
      const eventType =
        gate.code === "FEATURE_DISABLED"
          ? "cohort_feature_disabled"
          : gate.code === "MISSING_HMAC_SECRET"
            ? "cohort_missing_secret_blocked"
            : "cohort_governance_gate_blocked";
      await this.audit({
        eventType,
        metadata: { code: gate.code, reason: gate.reason },
        actorId: input.actorId ?? null,
      });
      return { ok: false, code: gate.code, reason: gate.reason };
    }

    const comparison = await this.deps.comparisonRepository.findById(
      input.comparisonId
    );
    if (!comparison) {
      return {
        ok: false,
        code: "SOURCE_NOT_FOUND",
        reason: "Comparison snapshot not found.",
      };
    }

    const projection = await this.deps.projectionRepository.findById(
      comparison.projectionSnapshotId
    );
    const observation = await this.deps.observationRepository.findById(
      comparison.observationSnapshotId
    );
    if (!projection || !observation) {
      return {
        ok: false,
        code: "SOURCE_NOT_FOUND",
        reason: "Projection or observation snapshot not found.",
      };
    }

    const lineage = validateLineage({ projection, observation, comparison });
    if (!lineage.ok) {
      await this.audit({
        eventType: "cohort_lineage_rejected",
        metadata: { reason: lineage.reason },
        actorId: input.actorId ?? null,
      });
      return { ok: false, code: "LINEAGE_MISMATCH", reason: lineage.reason };
    }

    if (!isAllowedFollowupStage(comparison.stage)) {
      return {
        ok: false,
        code: "INVALID_STAGE",
        reason: `Unsupported stage: ${comparison.stage}`,
      };
    }

    const secret = gate.config.hmacSecret!;
    const cohortSubjectKey = deriveCohortSubjectKey({
      secret,
      patientId: comparison.patientId,
    });
    const cohortProcedureKey = deriveCohortProcedureKey({
      secret,
      caseId: comparison.caseId,
    });
    const cohortPartitionKey = deriveCohortPartitionKey({ secret });

    const projectionChecksum = resolveProjectionContentChecksum(projection);
    const observationChecksum = observation.observationChecksum;
    const comparisonChecksum = comparison.comparisonChecksum;

    const meta = extractProcedureMetadataBands(projection.reconstructionSnapshot);
    const assessmentMode = resolveAssessmentMode(projection.reconstructionSnapshot);
    const evidenceCompletenessBand = deriveEvidenceCompletenessBand({
      projection,
      observation,
    });
    const observationConfidenceBand = bandConfidence(
      observation.observationPayload.evidence.confidence
    );
    const projectionConfidenceBand = bandConfidence(
      projection.confidenceSummary.projectionConfidence
    );

    const now = input.now ?? new Date().toISOString();
    const isCurrent = comparison.comparisonStatus === "active";
    const domains = comparison.comparisonPayload.domains ?? [];

    let created = 0;
    let reused = 0;
    let supersededMarked = 0;
    const rows: OutcomeLongitudinalCohortRow[] = [];

    for (const domainCmp of domains) {
      if (!ALLOWED_DOMAINS.has(domainCmp.domain)) {
        await this.audit({
          eventType: "cohort_deidentification_rejected",
          cohortProcedureKey,
          cohortSubjectKey,
          metadata: { reason: "invalid_domain", domain: domainCmp.domain },
          actorId: input.actorId ?? null,
        });
        return {
          ok: false,
          code: "INVALID_DOMAIN",
          reason: `Disallowed domain: ${domainCmp.domain}`,
        };
      }
      if (!ALLOWED_STATUSES.has(domainCmp.status)) {
        return {
          ok: false,
          code: "INVALID_STATUS",
          reason: `Disallowed comparison status: ${domainCmp.status}`,
        };
      }

      const checksumPayload = {
        cohortSchemaVersion: COHORT_SCHEMA_VERSION,
        projectionSnapshotChecksum: projectionChecksum,
        observationSnapshotChecksum: observationChecksum,
        comparisonSnapshotChecksum: comparisonChecksum,
        projectionSchemaVersion: String(comparison.projectionSchemaVersion),
        observationSchemaVersion: String(comparison.observationSchemaVersion),
        comparisonSchemaVersion: String(comparison.comparisonSchemaVersion),
        followupStage: comparison.stage,
        comparisonStatus: domainCmp.status,
        projectionDomain: domainCmp.domain,
        projectionConfidenceBand,
        observationConfidenceBand,
        comparisonConfidenceBand: bandConfidence(domainCmp.confidence),
        assessmentMode,
        baselineAvailable: projection.evidenceSummary.baselineAvailable,
        procedureTypeNormalized: meta.procedureTypeNormalized,
        graftCountBand: meta.graftCountBand,
        hairsPerGraftBand: meta.hairsPerGraftBand,
        punchSizeBand: meta.punchSizeBand,
        treatedHairline: meta.zones.treatedHairline,
        treatedTemples: meta.zones.treatedTemples,
        treatedFrontal: meta.zones.treatedFrontal,
        treatedForelock: meta.zones.treatedForelock,
        treatedMidScalp: meta.zones.treatedMidScalp,
        treatedCrown: meta.zones.treatedCrown,
        donorEvidenceAvailable: meta.donorEvidenceAvailable,
        evidenceCompletenessBand,
        isCurrentSourceLineage: isCurrent,
      };

      const rowChecksum = computeCohortRowChecksum(checksumPayload);

      const existing = await this.deps.cohortRepository.findByIdempotencyKey({
        cohortProcedureKey,
        projectionSnapshotChecksum: projectionChecksum,
        observationSnapshotChecksum: observationChecksum,
        comparisonSnapshotChecksum: comparisonChecksum,
        projectionDomain: domainCmp.domain,
        cohortSchemaVersion: COHORT_SCHEMA_VERSION,
      });

      if (existing) {
        reused += 1;
        rows.push(existing);
        await this.audit({
          eventType: "cohort_materialization_reused",
          cohortProcedureKey,
          cohortSubjectKey,
          rowChecksum: existing.rowChecksum,
          actorId: input.actorId ?? null,
          metadata: { domain: domainCmp.domain },
        });
        continue;
      }

      const row: OutcomeLongitudinalCohortRow = {
        id: randomUUID(),
        cohortSubjectKey,
        cohortProcedureKey,
        cohortPartitionKey,
        ...checksumPayload,
        rowChecksum,
        sourceGeneratedAt: comparison.createdAt,
        sourceSupersededAt: isCurrent ? null : now,
        createdAt: now,
      };

      const deid = validateCohortRowDeidentified(row);
      if (!deid.ok) {
        await this.audit({
          eventType: "cohort_deidentification_rejected",
          cohortProcedureKey,
          cohortSubjectKey,
          metadata: {
            reason: deid.reason,
            prohibitedKeys: deid.prohibitedKeys,
          },
          actorId: input.actorId ?? null,
        });
        return {
          ok: false,
          code: "DEIDENTIFICATION_REJECTED",
          reason: deid.reason,
        };
      }

      if (isCurrent) {
        const marked = await this.deps.cohortRepository.markSuperseded({
          cohortProcedureKey,
          projectionSnapshotChecksum: projectionChecksum,
          observationSnapshotChecksum: observationChecksum,
          projectionDomain: domainCmp.domain,
          exceptComparisonChecksum: comparisonChecksum,
          supersededAt: now,
        });
        if (marked > 0) {
          supersededMarked += marked;
          await this.audit({
            eventType: "cohort_source_lineage_superseded",
            cohortProcedureKey,
            cohortSubjectKey,
            metadata: {
              domain: domainCmp.domain,
              markedCount: marked,
            },
            actorId: input.actorId ?? null,
          });
        }
      }

      await this.deps.cohortRepository.insert(row);
      created += 1;
      rows.push(row);
      await this.audit({
        eventType: "cohort_materialization_created",
        cohortProcedureKey,
        cohortSubjectKey,
        rowChecksum,
        actorId: input.actorId ?? null,
        metadata: {
          domain: domainCmp.domain,
          stage: comparison.stage,
          comparisonStatus: domainCmp.status,
        },
      });
    }

    return { ok: true, created, reused, supersededMarked, rows };
  }

  private async audit(args: Parameters<typeof createCohortAuditEvent>[0]) {
    if (!this.deps.audit) return;
    await this.deps.audit.record(createCohortAuditEvent(args));
  }
}

function validateLineage(args: {
  projection: ProjectionSnapshot;
  observation: ProjectionObservationSnapshot;
  comparison: ProjectionComparisonSnapshot;
}): { ok: true } | { ok: false; reason: string } {
  const { projection, observation, comparison } = args;
  if (observation.projectionSnapshotId !== projection.id) {
    return {
      ok: false,
      reason: "Observation is not attached to the comparison projection.",
    };
  }
  if (comparison.projectionSnapshotId !== projection.id) {
    return { ok: false, reason: "Comparison projection mismatch." };
  }
  if (comparison.observationSnapshotId !== observation.id) {
    return { ok: false, reason: "Comparison observation mismatch." };
  }
  if (
    projection.caseId !== observation.caseId ||
    projection.caseId !== comparison.caseId ||
    projection.patientId !== observation.patientId ||
    projection.patientId !== comparison.patientId
  ) {
    return { ok: false, reason: "Ownership/lineage identity mismatch across 1D/1E/1F." };
  }
  if (comparison.stage !== observation.stage) {
    return { ok: false, reason: "Comparison stage does not match observation stage." };
  }
  return { ok: true };
}

export function createOutcomeCohortMaterializationService(
  deps: OutcomeCohortMaterializationDeps
): OutcomeCohortMaterializationService {
  return new OutcomeCohortMaterializationService(deps);
}
