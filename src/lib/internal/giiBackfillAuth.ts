/**
 * Guards for internal GII backfill (script + /api/internal/*).
 * Requires ALLOW_GII_BACKFILL=true, INTERNAL_BACKFILL_KEY, and matching x-internal-key header.
 */

export function envFlagTrue(v: string | undefined): boolean {
  return String(v ?? "").trim().toLowerCase() === "true";
}

export function isInternalGiiBackfillRequest(req: Request): boolean {
  if (!envFlagTrue(process.env.ALLOW_GII_BACKFILL)) return false;
  const expected = String(process.env.INTERNAL_BACKFILL_KEY ?? "").trim();
  if (!expected) return false;
  const provided = req.headers.get("x-internal-key")?.trim();
  return Boolean(provided && provided === expected);
}
