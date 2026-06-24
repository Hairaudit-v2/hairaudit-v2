/**
 * Normalises runAudit event payloads from direct triggers (case/submitted) and
 * auditor/rerun → step.invoke paths.
 */

import { AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED } from "@/lib/patient/patientPhotoImageLimitedOverride";

export type RunAuditEventPayload = {
  caseId: string;
  userId: string;
  auditorRerunReason: string | null;
  triggeredRole: string | null;
  rerunSource: string | null;
  allowImageLimitedOverride: boolean;
};

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

/** Unwrap invoke/onFailure nesting: event.data.event.data → inner payload. */
export function unwrapRunAuditInvokePayload(raw: unknown): Record<string, unknown> {
  const record = asRecord(raw);
  if (typeof record.caseId === "string") return record;

  const nestedEvent = asRecord(record.event);
  const nestedData = asRecord(nestedEvent.data);
  if (typeof nestedData.caseId === "string") return nestedData;

  return record;
}

export function resolveRunAuditEventData(raw: unknown): RunAuditEventPayload {
  const data = unwrapRunAuditInvokePayload(raw);
  const auditorRerunReasonRaw =
    data.auditorRerunReason ?? data.reason ?? data.rerunReason ?? null;
  const auditorRerunReason =
    typeof auditorRerunReasonRaw === "string" && auditorRerunReasonRaw.trim()
      ? auditorRerunReasonRaw.trim()
      : null;

  const allowImageLimitedOverrideExplicit = data.allowImageLimitedOverride === true;
  const allowImageLimitedOverride =
    allowImageLimitedOverrideExplicit ||
    auditorRerunReason === AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED;

  return {
    caseId: String(data.caseId ?? ""),
    userId: String(data.userId ?? ""),
    auditorRerunReason,
    triggeredRole:
      typeof data.triggeredRole === "string" && data.triggeredRole.trim()
        ? data.triggeredRole.trim()
        : null,
    rerunSource:
      typeof data.rerunSource === "string" && data.rerunSource.trim()
        ? data.rerunSource.trim()
        : null,
    allowImageLimitedOverride,
  };
}

export function buildRunAuditInvokePayload(args: {
  caseId: string;
  userId: string;
  reason: string | null;
  triggeredRole?: string | null;
  rerunSource?: string | null;
  allowImageLimitedOverride?: boolean;
}): RunAuditEventPayload {
  const auditorRerunReason =
    typeof args.reason === "string" && args.reason.trim() ? args.reason.trim() : null;
  return {
    caseId: args.caseId,
    userId: args.userId,
    auditorRerunReason,
    triggeredRole: args.triggeredRole ?? null,
    rerunSource: args.rerunSource ?? null,
    allowImageLimitedOverride: args.allowImageLimitedOverride === true,
  };
}
