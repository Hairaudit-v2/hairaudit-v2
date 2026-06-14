/**
 * Browser helper for `GET /api/uploads/signed-url`.
 * Optional `caseId` must match the UUID embedded in `storagePath` when provided (server-enforced).
 */
export function uploadSignedUrlFetchPath(storagePath: string, caseId?: string): string {
  const q = new URLSearchParams({ path: storagePath });
  const trimmed = caseId?.trim();
  if (trimmed) q.set("caseId", trimmed);
  return `/api/uploads/signed-url?${q.toString()}`;
}
