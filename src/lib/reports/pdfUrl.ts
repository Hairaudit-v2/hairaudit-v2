type PdfAuditMode = "patient" | "doctor" | "clinic" | "auditor";

function buildPdfUrl(caseId: string, token: string, auditMode: PdfAuditMode): string {
  const params = new URLSearchParams({
    caseId,
    auditMode,
    token,
    cb: String(Date.now()),
  });
  return `/api/print/report?${params.toString()}`;
}

export function buildPatientPdfUrl(caseId: string, token: string): string {
  return buildPdfUrl(caseId, token, "patient");
}

export function buildDoctorPdfUrl(caseId: string, token: string): string {
  return buildPdfUrl(caseId, token, "doctor");
}

export function buildClinicPdfUrl(caseId: string, token: string): string {
  return buildPdfUrl(caseId, token, "clinic");
}

export function buildAuditorPdfUrl(caseId: string, token: string): string {
  return buildPdfUrl(caseId, token, "auditor");
}

