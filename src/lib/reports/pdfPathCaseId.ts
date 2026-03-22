/** Derive case UUID from a stored report PDF path (Supabase object key). */
export function extractCaseIdFromPdfPath(p: string): string {
  const raw = String(p ?? "").trim();
  if (!raw) return "";
  const normalized = raw.replace(/^https?:\/\/[^/]+/i, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts[0] === "cases" && parts[1]) return parts[1];
  if (parts[0] === "reports" && parts[1]) return parts[1];
  if (/^[0-9a-fA-F-]{36}$/.test(parts[0] ?? "")) return parts[0] ?? "";
  return parts[0] ?? "";
}

export function reportPdfPathMatchesCase(pdfPath: string, caseId: string): boolean {
  if (!caseId) return false;
  if (extractCaseIdFromPdfPath(pdfPath) === caseId) return true;
  return pdfPath.includes(caseId);
}
