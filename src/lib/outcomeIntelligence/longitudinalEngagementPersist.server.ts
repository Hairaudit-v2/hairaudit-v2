/**
 * FI-OUTCOME-INTELLIGENCE-1D — Supabase persistence adapter (service-role).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LongitudinalEngagementEventRecord } from "./longitudinalEngagementTypes";
import type {
  EngagementEventListFilter,
  LongitudinalEngagementEventRepository,
} from "./longitudinalEngagementRepository";

export const HAIRAUDIT_LONGITUDINAL_ENGAGEMENT_EVENTS_TABLE =
  "hairaudit_longitudinal_engagement_events";

type EngagementRow = {
  id: string;
  projection_snapshot_id: string;
  case_id: string;
  patient_id: string;
  stage: string;
  event_type: string;
  reason_code: string;
  policy_version: string;
  dedupe_key: string;
  status: string;
  decision_at: string;
  eligible_after: string | null;
  expires_at: string | null;
  delivered_at: string | null;
  suppressed_at: string | null;
  suppression_code: string | null;
  channel: string | null;
  delivery_provider_ref: string | null;
  message_key: string;
  message_variables: Record<string, string | number | boolean | null>;
  state_fingerprint: string;
  milestone_status_at_decision: string;
  action_type: string;
  action_href: string | null;
  created_at: string;
  updated_at: string;
};

function rowToRecord(row: EngagementRow): LongitudinalEngagementEventRecord {
  return {
    id: row.id,
    projectionSnapshotId: row.projection_snapshot_id,
    caseId: row.case_id,
    patientId: row.patient_id,
    stage: row.stage as LongitudinalEngagementEventRecord["stage"],
    eventType: row.event_type as LongitudinalEngagementEventRecord["eventType"],
    reasonCode: row.reason_code,
    policyVersion:
      row.policy_version as LongitudinalEngagementEventRecord["policyVersion"],
    dedupeKey: row.dedupe_key,
    status: row.status as LongitudinalEngagementEventRecord["status"],
    decisionAt: row.decision_at,
    eligibleAfter: row.eligible_after,
    expiresAt: row.expires_at,
    deliveredAt: row.delivered_at,
    suppressedAt: row.suppressed_at,
    suppressionCode:
      row.suppression_code as LongitudinalEngagementEventRecord["suppressionCode"],
    channel: row.channel,
    deliveryProviderRef: row.delivery_provider_ref,
    messageKey: row.message_key as LongitudinalEngagementEventRecord["messageKey"],
    messageVariables: row.message_variables ?? {},
    stateFingerprint: row.state_fingerprint,
    milestoneStatusAtDecision:
      row.milestone_status_at_decision as LongitudinalEngagementEventRecord["milestoneStatusAtDecision"],
    actionType: row.action_type as LongitudinalEngagementEventRecord["actionType"],
    actionHref: row.action_href,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordToInsert(record: LongitudinalEngagementEventRecord) {
  return {
    id: record.id,
    projection_snapshot_id: record.projectionSnapshotId,
    case_id: record.caseId,
    patient_id: record.patientId,
    stage: record.stage,
    event_type: record.eventType,
    reason_code: record.reasonCode,
    policy_version: record.policyVersion,
    dedupe_key: record.dedupeKey,
    status: record.status,
    decision_at: record.decisionAt,
    eligible_after: record.eligibleAfter,
    expires_at: record.expiresAt,
    delivered_at: record.deliveredAt,
    suppressed_at: record.suppressedAt,
    suppression_code: record.suppressionCode,
    channel: record.channel,
    delivery_provider_ref: record.deliveryProviderRef,
    message_key: record.messageKey,
    message_variables: record.messageVariables,
    state_fingerprint: record.stateFingerprint,
    milestone_status_at_decision: record.milestoneStatusAtDecision,
    action_type: record.actionType,
    action_href: record.actionHref,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function createSupabaseLongitudinalEngagementEventRepository(
  supabase: SupabaseClient
): LongitudinalEngagementEventRepository {
  return {
    async findById(id) {
      const { data, error } = await supabase
        .from(HAIRAUDIT_LONGITUDINAL_ENGAGEMENT_EVENTS_TABLE)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToRecord(data as EngagementRow) : null;
    },

    async findByDedupeKey(dedupeKey) {
      const { data, error } = await supabase
        .from(HAIRAUDIT_LONGITUDINAL_ENGAGEMENT_EVENTS_TABLE)
        .select("*")
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToRecord(data as EngagementRow) : null;
    },

    async list(filter?: EngagementEventListFilter) {
      let q = supabase
        .from(HAIRAUDIT_LONGITUDINAL_ENGAGEMENT_EVENTS_TABLE)
        .select("*")
        .order("decision_at", { ascending: true });
      if (filter?.patientId) q = q.eq("patient_id", filter.patientId);
      if (filter?.projectionSnapshotId) {
        q = q.eq("projection_snapshot_id", filter.projectionSnapshotId);
      }
      if (filter?.stage) q = q.eq("stage", filter.stage);
      if (filter?.eventType) q = q.eq("event_type", filter.eventType);
      if (filter?.statuses?.length) q = q.in("status", filter.statuses);
      if (filter?.sinceDecisionAt) {
        q = q.gte("decision_at", filter.sinceDecisionAt);
      }
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as EngagementRow[]).map(rowToRecord);
    },

    async insert(record) {
      const { data, error } = await supabase
        .from(HAIRAUDIT_LONGITUDINAL_ENGAGEMENT_EVENTS_TABLE)
        .insert(recordToInsert(record))
        .select("*")
        .single();
      if (error) throw error;
      return rowToRecord(data as EngagementRow);
    },

    async update(id, patch) {
      const update: Record<string, unknown> = {
        updated_at: patch.updatedAt ?? new Date().toISOString(),
      };
      if (patch.status !== undefined) update.status = patch.status;
      if (patch.deliveredAt !== undefined) update.delivered_at = patch.deliveredAt;
      if (patch.suppressedAt !== undefined) {
        update.suppressed_at = patch.suppressedAt;
      }
      if (patch.suppressionCode !== undefined) {
        update.suppression_code = patch.suppressionCode;
      }
      if (patch.channel !== undefined) update.channel = patch.channel;
      if (patch.deliveryProviderRef !== undefined) {
        update.delivery_provider_ref = patch.deliveryProviderRef;
      }
      const { data, error } = await supabase
        .from(HAIRAUDIT_LONGITUDINAL_ENGAGEMENT_EVENTS_TABLE)
        .update(update)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return rowToRecord(data as EngagementRow);
    },
  };
}
