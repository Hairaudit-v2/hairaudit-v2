import { normalizeAuditMode, type AuditMode } from "@/lib/pdf/reportBuilder";

export function buildPdfUrl(args: {
  caseId: string;
  auditMode?: string;
  token: string;
  baseUrl: string;
  /** Optional; included for PDF benchmark logs only (token remains the auth gate). */
  reportId?: string | null;
  /** Optional assessment type override for print template selection. */
  assessmentType?: string | null;
  /** HA-PROJECTION — frozen snapshot identities for historical re-render. */
  projectionSnapshotId?: string | null;
  observationSnapshotId?: string | null;
  comparisonSnapshotId?: string | null;
}): string {
  const auditMode: AuditMode = normalizeAuditMode(args.auditMode);
  const base = (args.baseUrl || "").replace(/\/+$/, "");
  const params = new URLSearchParams({
    caseId: args.caseId,
    auditMode,
    token: args.token,
    cb: String(Date.now()),
  });
  const rid = String(args.reportId ?? "").trim();
  if (rid) params.set("reportId", rid);
  const assessmentType = String(args.assessmentType ?? "").trim();
  if (assessmentType) params.set("assessmentType", assessmentType);
  const projectionSnapshotId = String(args.projectionSnapshotId ?? "").trim();
  if (projectionSnapshotId) params.set("projectionSnapshotId", projectionSnapshotId);
  const observationSnapshotId = String(args.observationSnapshotId ?? "").trim();
  if (observationSnapshotId) params.set("observationSnapshotId", observationSnapshotId);
  const comparisonSnapshotId = String(args.comparisonSnapshotId ?? "").trim();
  if (comparisonSnapshotId) params.set("comparisonSnapshotId", comparisonSnapshotId);
  return `${base}/api/print/report?${params.toString()}`;
}

