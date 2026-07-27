/**
 * FI-OUTCOME-INTELLIGENCE-1A — Feature flags, HMAC secret, governance gates.
 *
 * Production materialization requires:
 * - FI_OUTCOME_COHORT_ENABLED=true
 * - FI_OUTCOME_COHORT_HMAC_SECRET set
 * - FI_OUTCOME_COHORT_GOVERNANCE_APPROVED=true
 */

export const DEFAULT_MIN_COHORT_SIZE = 10;

export type OutcomeCohortConfig = {
  enabled: boolean;
  hmacSecret: string | null;
  governanceApproved: boolean;
  minCohortSize: number;
  /** NODE_ENV / explicit test injection — never used to bypass production gates silently. */
  isProduction: boolean;
};

function envFlagTrue(v: string | undefined | null): boolean {
  return String(v ?? "")
    .trim()
    .toLowerCase() === "true";
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

/**
 * Resolve cohort config from env (or injected overrides for tests).
 */
export function resolveOutcomeCohortConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  overrides?: Partial<OutcomeCohortConfig>
): OutcomeCohortConfig {
  const secret = String(env.FI_OUTCOME_COHORT_HMAC_SECRET ?? "").trim();
  const base: OutcomeCohortConfig = {
    enabled: envFlagTrue(env.FI_OUTCOME_COHORT_ENABLED),
    hmacSecret: secret.length > 0 ? secret : null,
    governanceApproved: envFlagTrue(env.FI_OUTCOME_COHORT_GOVERNANCE_APPROVED),
    minCohortSize: parsePositiveInt(
      env.FI_OUTCOME_COHORT_MIN_SIZE,
      DEFAULT_MIN_COHORT_SIZE
    ),
    isProduction:
      String(env.NODE_ENV ?? "")
        .trim()
        .toLowerCase() === "production" ||
      String(env.VERCEL_ENV ?? "")
        .trim()
        .toLowerCase() === "production",
  };
  return { ...base, ...overrides };
}

export type CohortMaterializationGate =
  | { ok: true; config: OutcomeCohortConfig }
  | {
      ok: false;
      code: "FEATURE_DISABLED" | "MISSING_HMAC_SECRET" | "GOVERNANCE_BLOCKED";
      reason: string;
    };

/**
 * Fail-closed gate for production-safe materialization.
 * Tests may inject config with enabled + secret + governanceApproved.
 */
export function assertCohortMaterializationAllowed(
  config: OutcomeCohortConfig
): CohortMaterializationGate {
  if (!config.enabled) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      reason: "FI_OUTCOME_COHORT_ENABLED is not true.",
    };
  }
  if (!config.hmacSecret) {
    return {
      ok: false,
      code: "MISSING_HMAC_SECRET",
      reason: "FI_OUTCOME_COHORT_HMAC_SECRET is required for cohort materialization.",
    };
  }
  // Always require explicit governance approval when enabled — including production.
  if (!config.governanceApproved) {
    return {
      ok: false,
      code: "GOVERNANCE_BLOCKED",
      reason:
        "FI_OUTCOME_COHORT_GOVERNANCE_APPROVED is not true. De-identified outcome analytics remain gated.",
    };
  }
  return { ok: true, config };
}
