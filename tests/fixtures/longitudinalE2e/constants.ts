/**
 * FI-OUTCOME-INTELLIGENCE-1F — Fixture namespace + production guards.
 * Synthetic / demo only. No production PHI.
 */

export const LONGITUDINAL_E2E_FIXTURE_PREFIX = "FI-OI-1F-" as const;

export const LONGITUDINAL_E2E_EMAIL_DOMAIN = "hairaudit.test" as const;

export const LONGITUDINAL_E2E_PASSWORD = "Longitudinal-E2E-2026!" as const;

export const LONGITUDINAL_E2E_EXTERNAL_CASE_PREFIX = "FI-OI-1F:" as const;

/** Stable fixture keys (used in emails, external_case_id, cleanup). */
export const LONGITUDINAL_E2E_FIXTURE_KEYS = [
  "FRONTAL",
  "CROWN",
  "INCOMPLETE",
  "RESUME",
  "REPLACE",
  "RECOMMENDED-SKIP",
  "MISSED-M6",
  "BASELINE-PLUS",
  "SURGERY-ONLY",
  "REMINDER",
  "STALE-REMINDER",
  "FULL-LOOP",
  "ISOLATION-A",
  "ISOLATION-B",
  "HISTORICAL",
] as const;

export type LongitudinalE2eFixtureKey =
  (typeof LONGITUDINAL_E2E_FIXTURE_KEYS)[number];

export function longitudinalE2eExternalCaseId(
  key: LongitudinalE2eFixtureKey | string
): string {
  return `${LONGITUDINAL_E2E_EXTERNAL_CASE_PREFIX}${String(key).toUpperCase()}`;
}

export function longitudinalE2eFixtureKeyFull(
  key: LongitudinalE2eFixtureKey | string
): string {
  return `${LONGITUDINAL_E2E_FIXTURE_PREFIX}${String(key).toUpperCase()}`;
}

export function longitudinalE2eEmail(
  key: LongitudinalE2eFixtureKey | string
): string {
  const slug = String(key)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `e2e-fi-oi-1f-${slug}@${LONGITUDINAL_E2E_EMAIL_DOMAIN}`;
}

export function longitudinalE2eDisplayName(
  key: LongitudinalE2eFixtureKey | string
): string {
  return `E2E Projection ${String(key).replace(/-/g, " ")}`;
}

/**
 * Fail closed against production unless explicitly enabled.
 * Requires FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true for any seed/cleanup that
 * touches a remote database. Always blocks NODE_ENV=production unless both
 * that flag and LONGITUDINAL_E2E_ALLOW_PRODUCTION=true are set.
 */
export function assertLongitudinalE2eFixturesAllowed(
  nodeEnv: string | undefined = process.env.NODE_ENV
): void {
  const enabled = process.env.FI_LONGITUDINAL_E2E_FIXTURES_ENABLED === "true";
  if (!enabled) {
    throw new Error(
      "Longitudinal E2E fixtures blocked. Set FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true."
    );
  }

  const isProduction = nodeEnv === "production";
  const allowProduction =
    process.env.LONGITUDINAL_E2E_ALLOW_PRODUCTION === "true";

  if (isProduction && !allowProduction) {
    throw new Error(
      "Longitudinal E2E fixtures blocked in production. Set LONGITUDINAL_E2E_ALLOW_PRODUCTION=true only for explicit safe demo projects."
    );
  }

  if (isProduction && allowProduction) {
    console.warn(
      "[longitudinal-e2e] LONGITUDINAL_E2E_ALLOW_PRODUCTION=true — seeding production-like env (use with caution)."
    );
  }
}

export function isLongitudinalE2eExternalCaseId(externalCaseId: string): boolean {
  return String(externalCaseId ?? "").startsWith(LONGITUDINAL_E2E_EXTERNAL_CASE_PREFIX);
}
