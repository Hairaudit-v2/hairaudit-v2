/** Exclude faculty-soft-deleted uploads from trainee-facing lists */
export function isActiveTrainingCaseUpload(row: { deleted_at?: string | null }): boolean {
  return row.deleted_at == null;
}
