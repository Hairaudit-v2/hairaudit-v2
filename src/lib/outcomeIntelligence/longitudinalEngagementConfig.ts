/**
 * FI-OUTCOME-INTELLIGENCE-1D — Feature flags and fail-closed activation gates.
 *
 * Independent of FI_OUTCOME_COHORT_* governance.
 * Default: engine off; delivery channels off; dry-run default in CLI.
 */

export type LongitudinalEngagementConfig = {
  enabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  /** Persist decisions even when external delivery is off (still requires enabled). */
  persistEvents: boolean;
  isProduction: boolean;
};

function envFlagTrue(v: string | undefined | null): boolean {
  return (
    String(v ?? "")
      .trim()
      .toLowerCase() === "true"
  );
}

export function resolveLongitudinalEngagementConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  overrides?: Partial<LongitudinalEngagementConfig>
): LongitudinalEngagementConfig {
  const base: LongitudinalEngagementConfig = {
    enabled: envFlagTrue(env.FI_LONGITUDINAL_ENGAGEMENT_ENABLED),
    emailEnabled: envFlagTrue(env.FI_LONGITUDINAL_EMAIL_ENABLED),
    smsEnabled: envFlagTrue(env.FI_LONGITUDINAL_SMS_ENABLED),
    pushEnabled: envFlagTrue(env.FI_LONGITUDINAL_PUSH_ENABLED),
    persistEvents: envFlagTrue(env.FI_LONGITUDINAL_PERSIST_EVENTS),
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

export type EngagementApplyGate =
  | { ok: true; config: LongitudinalEngagementConfig }
  | {
      ok: false;
      code: "FEATURE_DISABLED" | "NO_DELIVERY_OR_PERSIST";
      reason: string;
    };

/**
 * Production apply fails closed unless engagement is enabled.
 * External sends require a channel flag; persistence alone is allowed when
 * FI_LONGITUDINAL_PERSIST_EVENTS=true (still no external blast).
 */
export function assertEngagementApplyAllowed(
  config: LongitudinalEngagementConfig,
  opts?: { requireExternalDelivery?: boolean }
): EngagementApplyGate {
  if (!config.enabled) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      reason: "FI_LONGITUDINAL_ENGAGEMENT_ENABLED is not true.",
    };
  }
  const anyChannel =
    config.emailEnabled || config.smsEnabled || config.pushEnabled;
  if (opts?.requireExternalDelivery && !anyChannel) {
    return {
      ok: false,
      code: "NO_DELIVERY_OR_PERSIST",
      reason:
        "No longitudinal delivery channel enabled (FI_LONGITUDINAL_EMAIL/SMS/PUSH_ENABLED).",
    };
  }
  if (!anyChannel && !config.persistEvents) {
    return {
      ok: false,
      code: "NO_DELIVERY_OR_PERSIST",
      reason:
        "Enable FI_LONGITUDINAL_PERSIST_EVENTS or a delivery channel flag before apply.",
    };
  }
  return { ok: true, config };
}

export function anyExternalChannelEnabled(
  config: LongitudinalEngagementConfig
): boolean {
  return config.emailEnabled || config.smsEnabled || config.pushEnabled;
}
