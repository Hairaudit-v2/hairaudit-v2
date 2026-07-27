/**
 * FI-OUTCOME-INTELLIGENCE-1C — Supabase persistence adapter (service-role).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LongitudinalCapturePlanRecord } from "./longitudinalCaptureTypes";
import type {
  CapturePlanIdempotencyKey,
  LongitudinalCapturePlanRepository,
} from "./longitudinalCaptureRepository";

export const HAIRAUDIT_LONGITUDINAL_CAPTURE_PLANS_TABLE =
  "hairaudit_longitudinal_capture_plans";

type CapturePlanRow = {
  id: string;
  projection_snapshot_id: string;
  case_id: string;
  patient_id: string;
  procedure_date: string;
  capture_policy_version: string;
  capture_protocol_version: string;
  created_at: string;
};

function rowToRecord(row: CapturePlanRow): LongitudinalCapturePlanRecord {
  return {
    id: row.id,
    projectionSnapshotId: row.projection_snapshot_id,
    caseId: row.case_id,
    patientId: row.patient_id,
    procedureDate: String(row.procedure_date).slice(0, 10),
    capturePolicyVersion:
      row.capture_policy_version as LongitudinalCapturePlanRecord["capturePolicyVersion"],
    captureProtocolVersion:
      row.capture_protocol_version as LongitudinalCapturePlanRecord["captureProtocolVersion"],
    createdAt: row.created_at,
  };
}

export function createSupabaseLongitudinalCapturePlanRepository(
  supabase: SupabaseClient
): LongitudinalCapturePlanRepository {
  return {
    async findById(id) {
      const { data, error } = await supabase
        .from(HAIRAUDIT_LONGITUDINAL_CAPTURE_PLANS_TABLE)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToRecord(data as CapturePlanRow) : null;
    },

    async findByIdempotencyKey(key: CapturePlanIdempotencyKey) {
      const { data, error } = await supabase
        .from(HAIRAUDIT_LONGITUDINAL_CAPTURE_PLANS_TABLE)
        .select("*")
        .eq("projection_snapshot_id", key.projectionSnapshotId)
        .eq("capture_policy_version", key.capturePolicyVersion)
        .eq("capture_protocol_version", key.captureProtocolVersion)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToRecord(data as CapturePlanRow) : null;
    },

    async findByProjectionSnapshotId(projectionSnapshotId) {
      const { data, error } = await supabase
        .from(HAIRAUDIT_LONGITUDINAL_CAPTURE_PLANS_TABLE)
        .select("*")
        .eq("projection_snapshot_id", projectionSnapshotId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as CapturePlanRow[]).map(rowToRecord);
    },

    async listAll() {
      const { data, error } = await supabase
        .from(HAIRAUDIT_LONGITUDINAL_CAPTURE_PLANS_TABLE)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as CapturePlanRow[]).map(rowToRecord);
    },

    async insert(record) {
      const { data, error } = await supabase
        .from(HAIRAUDIT_LONGITUDINAL_CAPTURE_PLANS_TABLE)
        .insert({
          id: record.id,
          projection_snapshot_id: record.projectionSnapshotId,
          case_id: record.caseId,
          patient_id: record.patientId,
          procedure_date: record.procedureDate,
          capture_policy_version: record.capturePolicyVersion,
          capture_protocol_version: record.captureProtocolVersion,
          created_at: record.createdAt,
        })
        .select("*")
        .single();
      if (error) throw error;
      return rowToRecord(data as CapturePlanRow);
    },
  };
}
