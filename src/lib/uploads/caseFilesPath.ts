/**
 * Validates storage paths for the HairAudit "case-files" bucket under `cases/{caseId}/…`.
 * Used by /api/uploads/signed-url after authz so service-role signing cannot escape case namespaces.
 */

const CASE_FILES_CASE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CaseFilesPathParseResult =
  | { ok: true; caseId: string; normalizedPath: string }
  | { ok: false; reason: "empty" | "invalid_encoding" | "traversal" | "not_case_namespace" | "invalid_case_id" };

function decodePathOnce(raw: string): { ok: true; value: string } | { ok: false } {
  try {
    return { ok: true, value: decodeURIComponent(raw) };
  } catch {
    return { ok: false };
  }
}

/** First path segment after `cases/` must be a UUID (case id). */
export function parseCaseIdFromCaseFilesPath(rawPath: string): CaseFilesPathParseResult {
  const trimmed = (rawPath ?? "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  const decoded = decodePathOnce(trimmed);
  if (!decoded.ok) return { ok: false, reason: "invalid_encoding" };

  const path = decoded.value.replace(/\\/g, "");
  if (path.includes("..")) return { ok: false, reason: "traversal" };

  const segments = path.split("/").filter((s) => s.length > 0);
  if (segments.length < 2 || segments[0] !== "cases") {
    return { ok: false, reason: "not_case_namespace" };
  }

  for (const seg of segments) {
    if (seg === "..") return { ok: false, reason: "traversal" };
  }

  const maybeCaseId = segments[1];
  if (!CASE_FILES_CASE_ID.test(maybeCaseId)) {
    return { ok: false, reason: "invalid_case_id" };
  }

  return { ok: true, caseId: maybeCaseId.toLowerCase(), normalizedPath: segments.join("/") };
}

/** True when the path is under `cases/{expectedCaseId}/` (case id compared case-insensitively). */
export function storagePathBelongsToCase(expectedCaseId: string, rawPath: string): boolean {
  const parsed = parseCaseIdFromCaseFilesPath(rawPath);
  if (!parsed.ok) return false;
  return parsed.caseId === expectedCaseId.trim().toLowerCase();
}
