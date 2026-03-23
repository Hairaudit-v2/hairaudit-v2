/**
 * Shared queue path for auditor reruns: audit_rerun_log + case tracking + Inngest `auditor/rerun`.
 * Used by POST /api/auditor/rerun and internal GII historical backfill workflow.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";

/** Must match `ACTION_TYPES` in `src/app/api/auditor/rerun/route.ts`. */
export const AUDITOR_RERUN_ACTION_TYPES = [
  "regenerate_ai_audit",
  "regenerate_scoring",
  "regenerate_graft_integrity",
  "regenerate_evidence_analysis",
  "rebuild_pdf",
  "regenerate_report_generation",
  "full_reaudit",
  "full_reaudit_latest_submission",
  "full_reaudit_with_followup_linkage",
] as const;

/** Must match `REASONS` in `src/app/api/auditor/rerun/route.ts`. */
export const AUDITOR_RERUN_REASONS = [
  "new_uploads",
  "new_doctor_data",
  "failed_previous_run",
  "updated_model_or_prompt",
  "auditor_review_request",
  "data_inconsistency",
  "corrected_patient_photos",
] as const;

export type AuditorRerunAction = (typeof AUDITOR_RERUN_ACTION_TYPES)[number];
export type AuditorRerunReason = (typeof AUDITOR_RERUN_REASONS)[number];

export function normalizeAuditorRerunAction(
  action: AuditorRerunAction
): "regenerate_ai_audit" | "regenerate_graft_integrity" | "rebuild_pdf" | "full_reaudit" {
  if (action === "regenerate_scoring") return "regenerate_ai_audit";
  if (action === "regenerate_evidence_analysis") return "regenerate_graft_integrity";
  if (action === "regenerate_report_generation") return "rebuild_pdf";
  if (action === "full_reaudit_latest_submission" || action === "full_reaudit_with_followup_linkage") return "full_reaudit";
  return action;
}

export type QueueAuditorRerunParams = {
  caseId: string;
  actingUserId: string;
  action: AuditorRerunAction;
  reason: AuditorRerunReason;
  notes: string | null;
};

export type QueueAuditorRerunResult =
  | { ok: true; rerunLogId: string }
  | { ok: false; error: string; httpStatus: number };

/**
 * Inserts audit_rerun_log, updates case tracking (best-effort), emits `auditor/rerun`.
 * Caller must validate action/reason against allowed lists when accepting HTTP input.
 */
export async function queueAuditorRerunFromAdmin(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  params: QueueAuditorRerunParams
): Promise<QueueAuditorRerunResult> {
  const { caseId, actingUserId, action, reason, notes } = params;

  let c: Record<string, unknown> | null = null;
  try {
    const withTracking = await admin
      .from("cases")
      .select("id, rerun_count, processing_log")
      .eq("id", caseId)
      .maybeSingle();
    if (!withTracking.error && withTracking.data) {
      c = withTracking.data as Record<string, unknown>;
    }
  } catch {
    /* continue */
  }
  if (!c) {
    const fallback = await admin.from("cases").select("id").eq("id", caseId).maybeSingle();
    c = (fallback.data ?? null) as Record<string, unknown> | null;
  }
  if (!c) {
    return { ok: false, error: "Case not found", httpStatus: 404 };
  }

  const normalizedAction = normalizeAuditorRerunAction(action);

  const { data: latestReport } = await admin
    .from("reports")
    .select("version")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sourceVersion = latestReport?.version ?? null;

  const { data: logRow, error: logErr } = await admin
    .from("audit_rerun_log")
    .insert({
      case_id: caseId,
      action_type: normalizedAction,
      triggered_by: actingUserId,
      triggered_role: "auditor",
      reason,
      notes,
      source_report_version: sourceVersion,
      target_report_version: null,
      status: "pending",
    })
    .select("id")
    .single();

  if (logErr) {
    return { ok: false, error: logErr.message, httpStatus: 500 };
  }

  const rerunLogId = String((logRow as { id?: string })?.id ?? "");
  if (!rerunLogId) {
    return { ok: false, error: "audit_rerun_log insert returned no id", httpStatus: 500 };
  }

  const now = new Date().toISOString();
  const existingLog = Array.isArray((c as Record<string, unknown>).processing_log)
    ? ((c as Record<string, unknown>).processing_log as unknown[])
    : [];
  try {
    await admin
      .from("cases")
      .update({
        rerun_count: Number((c as Record<string, unknown>).rerun_count ?? 0) + 1,
        last_rerun_at: now,
        last_rerun_by: actingUserId,
        processing_log: [
          ...existingLog,
          {
            at: now,
            action: normalizedAction,
            requested_action: action,
            reason,
            rerun_log_id: rerunLogId,
            by: actingUserId,
          },
        ],
      })
      .eq("id", caseId);
  } catch {
    /* tracking columns may not exist */
  }

  await inngest.send({
    name: "auditor/rerun",
    data: {
      caseId,
      action: normalizedAction,
      reason,
      notes,
      triggeredBy: actingUserId,
      triggeredRole: "auditor",
      rerunLogId,
      sourceReportVersion: sourceVersion,
    },
  });

  return { ok: true, rerunLogId };
}

/** Convenience when no caller-owned admin client exists. */
export async function queueAuditorRerun(params: QueueAuditorRerunParams): Promise<QueueAuditorRerunResult> {
  const admin = createSupabaseAdminClient();
  return queueAuditorRerunFromAdmin(admin, params);
}
