import { normalizeAuditMode, type AuditMode } from "@/lib/pdf/reportBuilder";

export function buildPdfUrl(args: {
  caseId: string;
  auditMode?: string;
  token: string;
  baseUrl: string;
  /** Optional; included for PDF benchmark logs only (token remains the auth gate). */
  reportId?: string | null;
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
  return `${base}/api/print/report?${params.toString()}`;
}

