/**
 * Detect optional-feature DB failures: table missing, relation not found,
 * missing column during rollout. Use to fail gracefully instead of crashing.
 */
export function isMissingFeatureError(error: unknown): boolean {
  const e = error as { status?: number; code?: string; message?: string } | null;
  if (!e) return false;
  if (e.status === 404) return true;
  const code = String(e.code ?? "");
  const message = String(e.message ?? "").toLowerCase();
  return (
    code === "PGRST205" ||
    code === "42P01" || // undefined_table
    code === "42703" || // undefined_column
    message.includes("not found") ||
    message.includes("could not find the table") ||
    message.includes("does not exist") ||
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("column") && message.includes("does not exist"))
  );
}
