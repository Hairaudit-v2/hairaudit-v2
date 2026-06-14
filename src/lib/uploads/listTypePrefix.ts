/**
 * Resolves the `uploads.type` prefix for GET /api/uploads/list.
 * Prevents an empty `prefix=` query from widening the result set.
 */
export function resolveUploadTypePrefixForList(rawPrefix: string | null | undefined): string {
  const raw = rawPrefix?.trim();
  if (!raw) return "patient_photo:";
  return raw.endsWith(":") ? raw : `${raw}:`;
}
