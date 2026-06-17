/**
 * Internal server-to-server API authentication.
 * Does NOT accept SUPABASE_SERVICE_ROLE_KEY — use dedicated INTERNAL_API_KEY etc.
 */

import { getInternalApiKey } from "@/lib/security/secrets";

export function resolveProvidedInternalApiKey(req: Request): string {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const header = req.headers.get("x-internal-api-key")?.trim();
  const legacy = req.headers.get("x-internal-token")?.trim();
  return bearer || header || legacy || "";
}

/** Allowed configured keys (explicit env vars only — never service role). */
export function configuredInternalApiKeys(): string[] {
  return [
    process.env.INTERNAL_API_KEY,
    process.env.REPORT_RENDER_TOKEN,
    process.env.INTERNAL_BUILD_PDF_TOKEN,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
}

export function isInternalApiRequestAuthorized(req: Request): boolean {
  const provided = resolveProvidedInternalApiKey(req);
  if (!provided) return false;
  return configuredInternalApiKeys().includes(provided);
}

/** Non-production fallback when no keys configured (local PDF dev only). */
export function isInternalApiRequestAuthorizedDevFallback(req: Request): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const provided = resolveProvidedInternalApiKey(req);
  if (!provided) return false;
  const devKey = getInternalApiKey();
  return Boolean(devKey && provided === devKey);
}

export function authorizeInternalApiRequest(req: Request): boolean {
  return isInternalApiRequestAuthorized(req) || isInternalApiRequestAuthorizedDevFallback(req);
}
