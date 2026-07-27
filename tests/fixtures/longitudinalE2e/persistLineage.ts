/**
 * FI-OUTCOME-INTELLIGENCE-1F — Persist observation / comparison snapshots via service-role.
 * Thin adapter — payloads come from canonical domain services only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectionObservationSnapshot } from "@/lib/projection/projectionObservationTypes";
import type { ProjectionComparisonSnapshot } from "@/lib/projection/projectionComparisonTypes";

export async function persistObservationSnapshot(
  admin: SupabaseClient,
  snap: ProjectionObservationSnapshot
): Promise<void> {
  const { error } = await admin.from("hairaudit_projection_observations").upsert(
    {
      id: snap.id,
      projection_snapshot_id: snap.projectionSnapshotId,
      case_id: snap.caseId,
      patient_id: snap.patientId,
      stage: snap.stage,
      observed_at: snap.observedAt,
      observation_status: snap.observationStatus,
      observation_schema_version: snap.observationSchemaVersion,
      observation_lineage_version: snap.observationLineageVersion,
      observation_checksum: snap.observationChecksum,
      observation_payload: snap.observationPayload,
      created_at: snap.createdAt,
      created_by: snap.createdBy,
      supersedes_observation_id: snap.supersedesObservationId,
      superseded_by_observation_id: snap.supersededByObservationId,
      supersession_reason_code: snap.supersessionReasonCode,
      source_report_id: snap.sourceReportId,
      source_audit_id: snap.sourceAuditId,
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`observation persist failed: ${error.message}`);
}

export async function persistComparisonSnapshot(
  admin: SupabaseClient,
  snap: ProjectionComparisonSnapshot
): Promise<void> {
  const { error } = await admin.from("hairaudit_projection_comparisons").upsert(
    {
      id: snap.id,
      projection_snapshot_id: snap.projectionSnapshotId,
      observation_snapshot_id: snap.observationSnapshotId,
      case_id: snap.caseId,
      patient_id: snap.patientId,
      stage: snap.stage,
      comparison_status: snap.comparisonStatus,
      comparison_schema_version: snap.comparisonSchemaVersion,
      projection_schema_version: snap.projectionSchemaVersion,
      observation_schema_version: snap.observationSchemaVersion,
      comparison_checksum: snap.comparisonChecksum,
      comparison_payload: snap.comparisonPayload,
      created_at: snap.createdAt,
      created_by: snap.createdBy,
      supersedes_comparison_id: snap.supersedesComparisonId,
      superseded_by_comparison_id: snap.supersededByComparisonId,
      supersession_reason_code: snap.supersessionReasonCode,
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`comparison persist failed: ${error.message}`);
}
