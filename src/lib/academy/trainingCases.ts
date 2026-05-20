/** Exclude soft-deleted or voided/archived cases from trainee-facing lists */
export function isActiveTrainingCase(row: {
  deleted_at?: string | null;
  status?: string | null;
}): boolean {
  if (row.deleted_at != null) return false;
  const status = row.status?.toLowerCase();
  if (status === "voided" || status === "archived") return false;
  return true;
}
