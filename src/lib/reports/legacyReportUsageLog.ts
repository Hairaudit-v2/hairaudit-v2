import type { AuditMode } from "@/lib/pdf/reportBuilder";

/** Temporary retirement instrumentation — do not log report content or patient identifiers. */
export const LEGACY_REPORT_USAGE_LOG_TAG = "[legacy-report-usage]" as const;

export type LegacyReportAuthPath = "session" | "token" | "none";

export type LegacyReportUsageOutcome =
  | "success"
  | "missing_case_id"
  | "invalid_token"
  | "unauthorized"
  | "case_not_found"
  | "forbidden"
  | "error";

export type LegacyReportUsageLogEntry = {
  requestId: string;
  timestamp: string;
  hasCaseId: boolean;
  auditMode: AuditMode | null;
  requestedAuditMode: AuditMode | null;
  authPath: LegacyReportAuthPath;
  outcome: LegacyReportUsageOutcome;
  status: number;
  durationMs: number;
  /** Counts only — no finding text or report body. */
  reviewAreaCount?: number;
  hasReportVersion?: boolean;
};

export function logLegacyReportUsage(entry: LegacyReportUsageLogEntry): void {
  console.info(LEGACY_REPORT_USAGE_LOG_TAG, entry);
}

export function createLegacyReportUsageTracker(requestId: string) {
  const startedAt = Date.now();
  let hasCaseId = false;
  let authPath: LegacyReportAuthPath = "none";
  let requestedAuditMode: AuditMode | null = null;
  let auditMode: AuditMode | null = null;
  let reviewAreaCount: number | undefined;
  let hasReportVersion: boolean | undefined;

  return {
    setHasCaseId(present: boolean) {
      hasCaseId = present;
    },
    setAuthPath(path: LegacyReportAuthPath) {
      authPath = path;
    },
    setRequestedAuditMode(mode: AuditMode | null) {
      requestedAuditMode = mode;
    },
    setAuditMode(mode: AuditMode | null) {
      auditMode = mode;
    },
    setSuccessMeta(meta: { reviewAreaCount: number; hasReportVersion: boolean }) {
      reviewAreaCount = meta.reviewAreaCount;
      hasReportVersion = meta.hasReportVersion;
    },
    finish(outcome: LegacyReportUsageOutcome, status: number) {
      logLegacyReportUsage({
        requestId,
        timestamp: new Date().toISOString(),
        hasCaseId,
        auditMode,
        requestedAuditMode,
        authPath,
        outcome,
        status,
        durationMs: Date.now() - startedAt,
        ...(reviewAreaCount !== undefined ? { reviewAreaCount } : {}),
        ...(hasReportVersion !== undefined ? { hasReportVersion } : {}),
      });
    },
  };
}
