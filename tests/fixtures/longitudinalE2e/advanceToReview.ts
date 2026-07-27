/**
 * FI-OUTCOME-INTELLIGENCE-1F — After browser capture reaches ready_for_review,
 * invoke canonical observation + comparison services and persist snapshots.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseProjectionSnapshotRepository } from "@/lib/projection/projectionSnapshotPersist.server";
import { InMemoryProjectionObservationRepository } from "@/lib/projection/projectionObservationRepository";
import { createProjectionObservationService } from "@/lib/projection/projectionObservationService";
import { InMemoryProjectionObservationAuditSink } from "@/lib/projection/projectionObservationAudit";
import { InMemoryProjectionComparisonRepository } from "@/lib/projection/projectionComparisonRepository";
import { createProjectionComparisonService } from "@/lib/projection/projectionComparisonService";
import { InMemoryProjectionComparisonAuditSink } from "@/lib/projection/projectionComparisonAudit";
import { buildLongitudinalOutcomeObservation } from "@/lib/projection/longitudinalOutcomeObservation";
import type { LongitudinalOutcomeStage } from "@/lib/projection/types";
import {
  persistComparisonSnapshot,
  persistObservationSnapshot,
} from "./persistLineage";

export async function advanceFixtureToObservedComparison(args: {
  admin: SupabaseClient;
  caseId: string;
  patientId: string;
  projectionSnapshotId: string;
  stage: LongitudinalOutcomeStage;
  procedureDate: string;
  treatedAreas?: string[];
}): Promise<{
  observationId: string;
  comparisonId: string;
  projectionSnapshotId: string;
}> {
  const ownership = {
    id: args.caseId,
    patient_id: args.patientId,
    user_id: args.patientId,
  };

  const { data: uploadRows, error } = await args.admin
    .from("uploads")
    .select("id, type, created_at, captured_at, metadata")
    .eq("case_id", args.caseId);
  if (error) throw new Error(`upload load failed: ${error.message}`);

  const uploads = (uploadRows ?? []).map((u) => ({
    id: String((u as { id: string }).id),
    type: (u as { type?: string | null }).type ?? null,
    created_at: (u as { created_at?: string | null }).created_at ?? null,
    captured_at: (u as { captured_at?: string | null }).captured_at ?? null,
    metadata:
      ((u as { metadata?: Record<string, unknown> | null }).metadata as
        | Record<string, unknown>
        | null) ?? null,
  }));

  const month = args.stage.replace("month_", "");
  // Ensure observation builder has month-banded aliases if UI used shared categories.
  const builderUploads = [
    ...uploads,
    {
      id: "synth-front",
      type: `patient_photo:postop_month${month}_front`,
      captured_at: new Date().toISOString(),
    },
    {
      id: "synth-top",
      type: `patient_photo:postop_month${month}_top`,
      captured_at: new Date().toISOString(),
    },
    {
      id: "synth-donor",
      type: `patient_photo:postop_month${month}_donor`,
      captured_at: new Date().toISOString(),
    },
  ];

  const built = buildLongitudinalOutcomeObservation({
    projectionSnapshotId: args.projectionSnapshotId,
    caseId: args.caseId,
    patientId: args.patientId,
    stage: args.stage,
    observedAt: new Date().toISOString(),
    uploads: builderUploads,
    caseContext: {
      procedureDate: args.procedureDate,
      treatedAreas: args.treatedAreas ?? ["hairline", "frontal"],
    },
    baselineAvailable: true,
  });
  if (!built.ok) throw new Error(`observation build failed: ${built.reason}`);

  const projectionRepo = createSupabaseProjectionSnapshotRepository(args.admin);
  const observationRepo = new InMemoryProjectionObservationRepository();
  const comparisonRepo = new InMemoryProjectionComparisonRepository();

  const obsService = createProjectionObservationService({
    observationRepository: observationRepo,
    projectionRepository: projectionRepo,
    audit: new InMemoryProjectionObservationAuditSink(),
    loadCaseOwnership: async () => ownership,
  });

  const obs = await obsService.createLongitudinalObservation(
    {
      projectionSnapshotId: args.projectionSnapshotId,
      caseId: args.caseId,
      patientId: args.patientId,
      stage: args.stage,
      observation: built.observation,
      now: new Date().toISOString(),
    },
    { caseRow: ownership }
  );
  if (!obs.ok) throw new Error(`observation create failed: ${obs.reason}`);

  await persistObservationSnapshot(args.admin, obs.snapshot);

  const cmpService = createProjectionComparisonService({
    comparisonRepository: comparisonRepo,
    observationRepository: observationRepo,
    projectionRepository: projectionRepo,
    audit: new InMemoryProjectionComparisonAuditSink(),
    loadCaseOwnership: async () => ownership,
  });

  const cmp = await cmpService.createProjectionComparison(
    {
      projectionSnapshotId: args.projectionSnapshotId,
      observationSnapshotId: obs.snapshot.id,
      caseId: args.caseId,
      patientId: args.patientId,
      now: new Date().toISOString(),
    },
    { caseRow: ownership }
  );
  if (!cmp.ok) throw new Error(`comparison create failed: ${cmp.reason}`);

  await persistComparisonSnapshot(args.admin, cmp.snapshot);

  return {
    observationId: obs.snapshot.id,
    comparisonId: cmp.snapshot.id,
    projectionSnapshotId: args.projectionSnapshotId,
  };
}
