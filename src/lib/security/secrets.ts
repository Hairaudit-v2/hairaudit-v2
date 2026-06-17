/**
 * Centralized secret resolution for token signing and internal service auth.
 * Never falls back to SUPABASE_SERVICE_ROLE_KEY for token secrets.
 */

const DEV_CONTRIBUTION_TOKEN_SECRET = "dev-only-contribution-token-secret";
const DEV_REPORT_RENDER_TOKEN_SECRET = "dev-only-report-render-token-secret";

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** HMAC secret for contribution portal tokens. */
export function getContributionTokenSecret(): string {
  const explicit = String(process.env.CONTRIBUTION_TOKEN_SECRET ?? "").trim();
  if (explicit) return explicit;
  if (isProductionRuntime()) {
    throw new Error("CONTRIBUTION_TOKEN_SECRET is required in production");
  }
  return DEV_CONTRIBUTION_TOKEN_SECRET;
}

/** Secret used to sign/verify short-lived report HTML/PDF render tokens. */
export function getReportRenderTokenSecret(): string | null {
  return (
    String(process.env.REPORT_RENDER_TOKEN ?? "").trim() ||
    String(process.env.INTERNAL_API_KEY ?? "").trim() ||
    null
  );
}

/** Like {@link getReportRenderTokenSecret} but throws in production when unset. */
export function requireReportRenderTokenSecret(): string {
  const secret = getReportRenderTokenSecret();
  if (secret) return secret;
  if (isProductionRuntime()) {
    throw new Error("REPORT_RENDER_TOKEN or INTERNAL_API_KEY is required in production");
  }
  return DEV_REPORT_RENDER_TOKEN_SECRET;
}

/** Server-to-server API key for internal PDF/render routes (not a token-signing secret). */
export function getInternalApiKey(): string | null {
  return (
    String(process.env.INTERNAL_API_KEY ?? "").trim() ||
    String(process.env.REPORT_RENDER_TOKEN ?? "").trim() ||
    String(process.env.INTERNAL_BUILD_PDF_TOKEN ?? "").trim() ||
    null
  );
}

export function requireInternalApiKey(): string {
  const key = getInternalApiKey();
  if (key) return key;
  if (isProductionRuntime()) {
    throw new Error("INTERNAL_API_KEY, REPORT_RENDER_TOKEN, or INTERNAL_BUILD_PDF_TOKEN is required in production");
  }
  return DEV_REPORT_RENDER_TOKEN_SECRET;
}
