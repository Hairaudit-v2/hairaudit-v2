/**
 * Validates storage paths for the HairAudit "case-files" bucket:
 * - `cases/{caseId}/…` (patient / doctor / clinic / surgery uploads)
 * - `audit_photos/{caseId}/…` (canonical audit-photos API storage layout)
 *
 * Used by /api/uploads/signed-url and related gates so service-role signing cannot escape case namespaces.
 */

const CASE_FILES_CASE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Allowed top-level folders whose second segment is the case UUID. */
const CASE_SCOPED_ROOTS = new Set(["cases", "audit_photos"]);

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

/** First path segment must be `cases` or `audit_photos`; second segment must be the case UUID. */
export function parseCaseIdFromCaseFilesPath(rawPath: string): CaseFilesPathParseResult {
  const trimmed = (rawPath ?? "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  const decoded = decodePathOnce(trimmed);
  if (!decoded.ok) return { ok: false, reason: "invalid_encoding" };

  const path = decoded.value.replace(/\\/g, "");
  if (path.includes("..")) return { ok: false, reason: "traversal" };

  const segments = path.split("/").filter((s) => s.length > 0);
  if (segments.length < 2 || !CASE_SCOPED_ROOTS.has(segments[0])) {
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

/**
 * True when the path is under `cases/{expectedCaseId}/…` or `audit_photos/{expectedCaseId}/…`
 * (case id compared case-insensitively).
 */
export function storagePathBelongsToCase(expectedCaseId: string, rawPath: string): boolean {
  const parsed = parseCaseIdFromCaseFilesPath(rawPath);
  if (!parsed.ok) return false;
  return parsed.caseId === expectedCaseId.trim().toLowerCase();
}

/** Rejects empty or malformed case ids before DB lookups (list route, etc.). */
export function isWellFormedCaseId(caseId: string): boolean {
  return CASE_FILES_CASE_ID.test((caseId ?? "").trim());
}

export function filterUploadRowsToCaseStorageNamespace<T extends { storage_path?: unknown }>(
  caseId: string,
  rows: T[]
): T[] {
  const id = caseId.trim().toLowerCase();
  return rows.filter((r) => storagePathBelongsToCase(id, String(r.storage_path ?? "")));
}

/** Sync checks for `GET /api/uploads/signed-url` before session / case DB authorization. */
export type UploadSignedUrlPathGateResult =
  | { ok: true; caseId: string; normalizedPath: string }
  | { ok: false; status: 400; error: string };

export function gateUploadSignedUrlStoragePath(
  path: string | null,
  caseIdQuery: string | null
): UploadSignedUrlPathGateResult {
  if (!path?.trim()) {
    return { ok: false, status: 400, error: "Missing path" };
  }
  const parsed = parseCaseIdFromCaseFilesPath(path);
  if (!parsed.ok) {
    return { ok: false, status: 400, error: "Invalid path" };
  }
  const q = (caseIdQuery ?? "").trim().toLowerCase();
  if (q.length > 0 && q !== parsed.caseId) {
    return { ok: false, status: 400, error: "Invalid path" };
  }
  return { ok: true, caseId: parsed.caseId, normalizedPath: parsed.normalizedPath };
}
