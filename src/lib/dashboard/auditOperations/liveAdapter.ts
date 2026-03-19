import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingFeatureError } from "@/lib/db/isMissingFeatureError";
import type {
  AuditKpi,
  AuditOperationsAdapter,
  AuditPriorityBreakdown,
  AuditStatusBreakdown,
  AuditVolumePoint,
  DashboardRange,
  RecentOperationalAudits,
} from "./types";

const emptyKpis: AuditKpi = {
  newAuditsToday: 0,
  totalOpenAudits: 0,
  completedToday: 0,
  manualReviewQueue: 0,
  overdueAudits: 0,
  averageTurnaroundHours: 0,
  lowConfidenceCases: 0,
};

const emptyStatusBreakdown: AuditStatusBreakdown = {
  submitted: 0,
  processing: 0,
  inReview: 0,
  complete: 0,
  auditFailed: 0,
};

const emptyPriorityBreakdown: AuditPriorityBreakdown = {
  overdue: 0,
  lowConfidence: 0,
  evidencePoor: 0,
  manualReview: 0,
};

const emptyOperationalAudits: RecentOperationalAudits = {
  recentAudits: [],
  manualInputAudits: [],
  stuckOrFailedAudits: [],
};

function toAuditType(value: unknown): "patient" | "doctor" | "clinic" {
  const text = String(value ?? "patient");
  if (text === "doctor" || text === "clinic") return text;
  return "patient";
}

export const liveAuditOperationsAdapter: AuditOperationsAdapter = {
  mode: "live",

  async getAuditKpis(range: DashboardRange): Promise<AuditKpi> {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("auditor_dashboard_kpis", { p_range: range });
    if (error) {
      if (isMissingFeatureError(error)) return emptyKpis;
      throw error;
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return emptyKpis;
    return {
      newAuditsToday: Number(row.new_audits_today ?? 0),
      totalOpenAudits: Number(row.total_open_audits ?? 0),
      completedToday: Number(row.completed_today ?? 0),
      manualReviewQueue: Number(row.manual_review_queue ?? 0),
      overdueAudits: Number(row.overdue_audits ?? 0),
      averageTurnaroundHours: Number(row.average_turnaround_hours ?? 0),
      lowConfidenceCases: Number(row.low_confidence_cases ?? 0),
    };
  },

  async getAuditVolumeSeries(range: DashboardRange): Promise<AuditVolumePoint[]> {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("auditor_dashboard_volume_series", { p_range: range });
    if (error) {
      if (isMissingFeatureError(error)) return [];
      throw error;
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) return [];
    return rows.map((row) => ({
      label: String(row.bucket_label ?? ""),
      newAudits: Number(row.new_audits ?? 0),
      completedAudits: Number(row.completed_audits ?? 0),
      totalVolume: Number(row.total_volume ?? 0),
    }));
  },

  async getAuditStatusBreakdown(range: DashboardRange): Promise<AuditStatusBreakdown> {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("auditor_dashboard_status_breakdown", { p_range: range });
    if (error) {
      if (isMissingFeatureError(error)) return emptyStatusBreakdown;
      throw error;
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return emptyStatusBreakdown;
    return {
      submitted: Number(row.submitted ?? 0),
      processing: Number(row.processing ?? 0),
      inReview: Number(row.in_review ?? 0),
      complete: Number(row.complete ?? 0),
      auditFailed: Number(row.audit_failed ?? 0),
    };
  },

  async getAuditPriorityBreakdown(range: DashboardRange): Promise<AuditPriorityBreakdown> {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("auditor_dashboard_priority_breakdown", { p_range: range });
    if (error) {
      if (isMissingFeatureError(error)) return emptyPriorityBreakdown;
      throw error;
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return emptyPriorityBreakdown;
    return {
      overdue: Number(row.overdue ?? 0),
      lowConfidence: Number(row.low_confidence ?? 0),
      evidencePoor: Number(row.evidence_poor ?? 0),
      manualReview: Number(row.manual_review ?? 0),
    };
  },

  async getRecentOperationalAudits(range: DashboardRange): Promise<RecentOperationalAudits> {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("auditor_dashboard_recent_operational_audits", { p_range: range });
    if (error) {
      if (isMissingFeatureError(error)) return emptyOperationalAudits;
      throw error;
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) return emptyOperationalAudits;

    const mapped = rows.map((row) => ({
      category: String(row.category ?? "recent"),
      id: String(row.id ?? ""),
      title: String(row.title ?? "Untitled audit"),
      auditType: toAuditType(row.audit_type),
      status: String(row.status ?? "submitted"),
      createdAt: String(row.created_at ?? new Date().toISOString()),
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
      confidence: row.confidence == null ? null : Number(row.confidence),
      evidenceScore: row.evidence_score == null ? null : Number(row.evidence_score),
      reason: row.reason ? String(row.reason) : undefined,
    }));

    return {
      recentAudits: mapped.filter((r) => r.category === "recent"),
      manualInputAudits: mapped.filter((r) => r.category === "manual_input"),
      stuckOrFailedAudits: mapped.filter((r) => r.category === "stuck_failed"),
    };
  },
};
