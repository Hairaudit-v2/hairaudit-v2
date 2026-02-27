import { normalizeAuditMode, type AuditMode } from "@/lib/pdf/reportBuilder";

export function buildPdfUrl(args: {
  caseId: string;
  auditMode?: string;
  token: string;
  baseUrl: string;
}): string {
  const auditMode: AuditMode = normalizeAuditMode(args.auditMode);
  const base = (args.baseUrl || "").replace(/\/+$/, "");
  const params = new URLSearchParams({
    caseId: args.caseId,
    auditMode,
    token: args.token,
    cb: String(Date.now()),
  });
  return `${base}/api/print/report?${params.toString()}`;
}

