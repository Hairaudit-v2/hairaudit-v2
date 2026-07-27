/**
 * Shared helpers for FI-OUTCOME-INTELLIGENCE-1A tests.
 */

import assert from "node:assert/strict";
import { fixtureA_baselinePlusSurgeryDay } from "./fixtures/surgeryDayProjection/fixtures";
import { InMemoryProjectionComparisonAuditSink } from "@/lib/projection/projectionComparisonAudit";
import { InMemoryProjectionComparisonRepository } from "@/lib/projection/projectionComparisonRepository";
import { createProjectionComparisonService } from "@/lib/projection/projectionComparisonService";
import { InMemoryProjectionObservationAuditSink } from "@/lib/projection/projectionObservationAudit";
import { InMemoryProjectionObservationRepository } from "@/lib/projection/projectionObservationRepository";
import { createProjectionObservationService } from "@/lib/projection/projectionObservationService";
import { InMemoryProjectionSnapshotRepository } from "@/lib/projection/projectionSnapshotRepository";
import { createProjectionSnapshotService } from "@/lib/projection/projectionSnapshotService";
import { buildLongitudinalOutcomeObservation } from "@/lib/projection/longitudinalOutcomeObservation";
import type { LongitudinalOutcomeObservation, LongitudinalOutcomeStage } from "@/lib/projection/types";
import type { OutcomeCohortConfig } from "@/lib/outcomeIntelligence/cohortConfig";
import { InMemoryOutcomeCohortAuditSink } from "@/lib/outcomeIntelligence/cohortAudit";
import { InMemoryOutcomeCohortRepository } from "@/lib/outcomeIntelligence/cohortRepository";
import { createOutcomeCohortMaterializationService } from "@/lib/outcomeIntelligence/cohortMaterialization";

export const TEST_HMAC_SECRET = "fi-outcome-cohort-test-secret-v1";

export function enabledCohortConfig(
  overrides?: Partial<OutcomeCohortConfig>
): OutcomeCohortConfig {
  return {
    enabled: true,
    hmacSecret: TEST_HMAC_SECRET,
    governanceApproved: true,
    minCohortSize: 10,
    isProduction: false,
    ...overrides,
  };
}

export function caseRowFor(
  caseId: string,
  patientId: string
): { id: string; patient_id: string; user_id: string } {
  return { id: caseId, patient_id: patientId, user_id: patientId };
}

export function makeObservationPayload(args: {
  projectionSnapshotId: string;
  caseId: string;
  patientId: string;
  stage?: LongitudinalOutcomeStage;
  procedureDate?: string;
}): LongitudinalOutcomeObservation {
  const stage = args.stage ?? "month_12";
  const month = stage.replace("month_", "");
  const procedureDate = args.procedureDate ?? "2025-01-15T00:00:00.000Z";
  const capture =
    stage === "month_3"
      ? "2025-04-15T00:00:00.000Z"
      : stage === "month_6"
        ? "2025-07-20T00:00:00.000Z"
        : stage === "month_9"
          ? "2025-10-15T00:00:00.000Z"
          : "2026-01-15T00:00:00.000Z";
  const built = buildLongitudinalOutcomeObservation({
    projectionSnapshotId: args.projectionSnapshotId,
    caseId: args.caseId,
    patientId: args.patientId,
    stage,
    observedAt: capture,
    uploads: [
      {
        id: "f",
        type: `patient_photo:postop_month${month}_front`,
        captured_at: capture,
      },
      {
        id: "t",
        type: `patient_photo:postop_month${month}_top`,
        captured_at: capture,
      },
      {
        id: "d",
        type: `patient_photo:postop_month${month}_donor`,
        captured_at: capture,
      },
    ],
    caseContext: {
      procedureDate,
      treatedAreas: ["frontal", "hairline"],
    },
    baselineAvailable: true,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  return built.observation;
}

export async function seedFullLineage(args: {
  caseId: string;
  patientId: string;
  stage?: LongitudinalOutcomeStage;
  projectionId?: string;
  observationId?: string;
  comparisonId?: string;
  graftCount?: number;
}) {
  const stage = args.stage ?? "month_12";
  const projectionRepo = new InMemoryProjectionSnapshotRepository();
  const observationRepo = new InMemoryProjectionObservationRepository();
  const comparisonRepo = new InMemoryProjectionComparisonRepository();
  const ownership = caseRowFor(args.caseId, args.patientId);

  const snapService = createProjectionSnapshotService({
    repository: projectionRepo,
    loadCaseOwnership: async () => ownership,
  });
  const { reconstruction, projectedOutcome } = fixtureA_baselinePlusSurgeryDay();
  if (args.graftCount != null) {
    reconstruction.procedureContext.actualGraftCount = args.graftCount;
    reconstruction.procedureContext.reportedGraftCount = args.graftCount;
  }

  const projection = await snapService.createProjectionSnapshot(
    {
      caseId: args.caseId,
      patientId: args.patientId,
      reconstruction,
      projectedOutcome,
      id: args.projectionId,
      now: "2025-01-20T00:00:00.000Z",
    },
    { caseRow: ownership }
  );
  assert.equal(projection.ok, true);
  if (!projection.ok) throw new Error("projection seed failed");

  const obsService = createProjectionObservationService({
    observationRepository: observationRepo,
    projectionRepository: projectionRepo,
    audit: new InMemoryProjectionObservationAuditSink(),
    loadCaseOwnership: async () => ownership,
  });
  const obsPayload = makeObservationPayload({
    projectionSnapshotId: projection.snapshot.id,
    caseId: args.caseId,
    patientId: args.patientId,
    stage,
  });
  const observation = await obsService.createLongitudinalObservation(
    {
      projectionSnapshotId: projection.snapshot.id,
      caseId: args.caseId,
      patientId: args.patientId,
      stage,
      observation: obsPayload,
      id: args.observationId,
      now: "2026-01-15T00:00:00.000Z",
    },
    { caseRow: ownership }
  );
  assert.equal(observation.ok, true);
  if (!observation.ok) throw new Error(observation.reason);

  const cmpService = createProjectionComparisonService({
    comparisonRepository: comparisonRepo,
    observationRepository: observationRepo,
    projectionRepository: projectionRepo,
    audit: new InMemoryProjectionComparisonAuditSink(),
    loadCaseOwnership: async () => ownership,
  });
  const comparison = await cmpService.createProjectionComparison(
    {
      projectionSnapshotId: projection.snapshot.id,
      observationSnapshotId: observation.snapshot.id,
      caseId: args.caseId,
      patientId: args.patientId,
      id: args.comparisonId,
      now: "2026-01-16T00:00:00.000Z",
    },
    { caseRow: ownership }
  );
  assert.equal(comparison.ok, true);
  if (!comparison.ok) throw new Error(comparison.reason);

  return {
    projectionRepo,
    observationRepo,
    comparisonRepo,
    projection: projection.snapshot,
    observation: observation.snapshot,
    comparison: comparison.snapshot,
  };
}

export function makeMaterializationStack(args?: {
  config?: OutcomeCohortConfig;
  lineage?: Awaited<ReturnType<typeof seedFullLineage>>;
}) {
  const cohortRepo = new InMemoryOutcomeCohortRepository();
  const audit = new InMemoryOutcomeCohortAuditSink();
  if (args?.lineage) {
    const service = createOutcomeCohortMaterializationService({
      cohortRepository: cohortRepo,
      comparisonRepository: args.lineage.comparisonRepo,
      observationRepository: args.lineage.observationRepo,
      projectionRepository: args.lineage.projectionRepo,
      audit,
      config: args.config ?? enabledCohortConfig(),
    });
    return { cohortRepo, audit, service, lineage: args.lineage };
  }
  throw new Error("lineage required");
}
