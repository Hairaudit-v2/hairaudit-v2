/**
 * HA-PROJECTION-1D — Supabase persistence adapter (service role only).
 *
 * Domain logic lives in ProjectionSnapshotService; this module maps rows
 * and provides a repository backed by hairaudit_projection_snapshots.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectionSnapshotRepository } from "./projectionSnapshotRepository";
import type {
  ProjectionSnapshot,
  ProjectionSnapshotMutableMetadata,
  ProjectionSupersessionReasonCode,
} from "./projectionSnapshotTypes";
import type { SurgeryDayProjectionAssessmentType } from "./types";
import type {
  ProjectionSnapshotAuditEvent,
  ProjectionSnapshotAuditSink,
} from "./projectionSnapshotAudit";

export const HAIRAUDIT_PROJECTION_SNAPSHOTS_TABLE = "hairaudit_projection_snapshots" as const;
export const HAIRAUDIT_PROJECTION_SNAPSHOT_EVENTS_TABLE =
  "hairaudit_projection_snapshot_events" as const;

type DbRow = {
  id: string;
  case_id: string;
  patient_id: string;
  source_report_id: string | null;
  source_assessment_id: string | null;
  projection_type: SurgeryDayProjectionAssessmentType;
  projection_status: "active" | "superseded";
  reconstruction_version: string;
  projection_engine_version: string;
  snapshot_schema_version: string;
  report_template_version: number;
  reconstruction_input_checksum: string;
  projection_input_checksum: string;
  projection_output_checksum: string;
  reconstruction_snapshot: ProjectionSnapshot["reconstructionSnapshot"];
  projection_snapshot: ProjectionSnapshot["projectionSnapshot"];
  confidence_summary: ProjectionSnapshot["confidenceSummary"];
  evidence_summary: ProjectionSnapshot["evidenceSummary"];
  created_at: string;
  created_by: string | null;
  supersedes_projection_id: string | null;
  superseded_by_projection_id: string | null;
  lineage_root_id: string;
  supersession_reason_code: ProjectionSupersessionReasonCode | null;
};

function rowToSnapshot(row: DbRow): ProjectionSnapshot {
  return {
    id: row.id,
    caseId: row.case_id,
    patientId: row.patient_id,
    procedureId: row.case_id,
    projectionType: row.projection_type,
    projectionStatus: row.projection_status,
    reconstructionVersion: row.reconstruction_version,
    projectionEngineVersion: row.projection_engine_version,
    snapshotSchemaVersion: row.snapshot_schema_version,
    reportTemplateVersion: row.report_template_version,
    reconstructionInputChecksum: row.reconstruction_input_checksum,
    projectionInputChecksum: row.projection_input_checksum,
    projectionOutputChecksum: row.projection_output_checksum,
    reconstructionSnapshot: row.reconstruction_snapshot,
    projectionSnapshot: row.projection_snapshot,
    confidenceSummary: row.confidence_summary,
    evidenceSummary: row.evidence_summary,
    createdAt: row.created_at,
    createdBy: row.created_by,
    supersedesProjectionId: row.supersedes_projection_id,
    supersededByProjectionId: row.superseded_by_projection_id,
    lineageRootId: row.lineage_root_id,
    supersessionReasonCode: row.supersession_reason_code,
    sourceReportId: row.source_report_id,
    sourceAssessmentId: row.source_assessment_id,
  };
}

function snapshotToRow(s: ProjectionSnapshot): Omit<DbRow, never> {
  return {
    id: s.id,
    case_id: s.caseId,
    patient_id: s.patientId,
    source_report_id: s.sourceReportId,
    source_assessment_id: s.sourceAssessmentId,
    projection_type: s.projectionType,
    projection_status: s.projectionStatus,
    reconstruction_version: s.reconstructionVersion,
    projection_engine_version: s.projectionEngineVersion,
    snapshot_schema_version: s.snapshotSchemaVersion,
    report_template_version: s.reportTemplateVersion,
    reconstruction_input_checksum: s.reconstructionInputChecksum,
    projection_input_checksum: s.projectionInputChecksum,
    projection_output_checksum: s.projectionOutputChecksum,
    reconstruction_snapshot: s.reconstructionSnapshot,
    projection_snapshot: s.projectionSnapshot,
    confidence_summary: s.confidenceSummary,
    evidence_summary: s.evidenceSummary,
    created_at: s.createdAt,
    created_by: s.createdBy,
    supersedes_projection_id: s.supersedesProjectionId,
    superseded_by_projection_id: s.supersededByProjectionId,
    lineage_root_id: s.lineageRootId,
    supersession_reason_code: s.supersessionReasonCode,
  };
}

export function createSupabaseProjectionSnapshotRepository(
  admin: SupabaseClient
): ProjectionSnapshotRepository {
  return {
    async findById(id) {
      const { data, error } = await admin
        .from(HAIRAUDIT_PROJECTION_SNAPSHOTS_TABLE)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return rowToSnapshot(data as DbRow);
    },

    async findByIdempotencyKey(key) {
      const { data, error } = await admin
        .from(HAIRAUDIT_PROJECTION_SNAPSHOTS_TABLE)
        .select("*")
        .eq("case_id", key.caseId)
        .eq("projection_type", key.projectionType)
        .eq("reconstruction_version", key.reconstructionVersion)
        .eq("projection_engine_version", key.projectionEngineVersion)
        .eq("snapshot_schema_version", key.snapshotSchemaVersion)
        .eq("reconstruction_input_checksum", key.reconstructionInputChecksum)
        .eq("projection_output_checksum", key.projectionOutputChecksum)
        .maybeSingle();
      if (error || !data) return null;
      return rowToSnapshot(data as DbRow);
    },

    async findCurrentActive(args) {
      let q = admin
        .from(HAIRAUDIT_PROJECTION_SNAPSHOTS_TABLE)
        .select("*")
        .eq("case_id", args.caseId)
        .eq("projection_status", "active")
        .order("created_at", { ascending: false })
        .limit(1);
      if (args.projectionType) {
        q = q.eq("projection_type", args.projectionType);
      }
      const { data, error } = await q.maybeSingle();
      if (error || !data) return null;
      return rowToSnapshot(data as DbRow);
    },

    async listByLineageRoot(lineageRootId) {
      const { data, error } = await admin
        .from(HAIRAUDIT_PROJECTION_SNAPSHOTS_TABLE)
        .select("*")
        .eq("lineage_root_id", lineageRootId)
        .order("created_at", { ascending: true });
      if (error || !data) return [];
      return (data as DbRow[]).map(rowToSnapshot);
    },

    async listByCase(caseId) {
      const { data, error } = await admin
        .from(HAIRAUDIT_PROJECTION_SNAPSHOTS_TABLE)
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      if (error || !data) return [];
      return (data as DbRow[]).map(rowToSnapshot);
    },

    async insert(snapshot) {
      const { data, error } = await admin
        .from(HAIRAUDIT_PROJECTION_SNAPSHOTS_TABLE)
        .insert(snapshotToRow(snapshot))
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "Failed to insert projection snapshot");
      }
      return rowToSnapshot(data as DbRow);
    },

    async applyMutableMetadata(id, patch: ProjectionSnapshotMutableMetadata) {
      const update: Record<string, unknown> = {};
      if (patch.projectionStatus !== undefined) {
        update.projection_status = patch.projectionStatus;
      }
      if (patch.supersededByProjectionId !== undefined) {
        update.superseded_by_projection_id = patch.supersededByProjectionId;
      }
      if (Object.keys(update).length === 0) {
        return this.findById(id);
      }
      const { data, error } = await admin
        .from(HAIRAUDIT_PROJECTION_SNAPSHOTS_TABLE)
        .update(update)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error || !data) return null;
      return rowToSnapshot(data as DbRow);
    },
  };
}

export function createSupabaseProjectionSnapshotAuditSink(
  admin: SupabaseClient
): ProjectionSnapshotAuditSink {
  return {
    async record(event: ProjectionSnapshotAuditEvent) {
      try {
        await admin.from(HAIRAUDIT_PROJECTION_SNAPSHOT_EVENTS_TABLE).insert({
          projection_id: event.projectionId,
          case_id: event.caseId,
          patient_id: event.patientId,
          event_type: event.eventType,
          actor_id: event.actorId,
          metadata: event.metadata,
          created_at: event.createdAt,
        });
      } catch {
        // Audit must not break persistence.
      }
    },
  };
}
