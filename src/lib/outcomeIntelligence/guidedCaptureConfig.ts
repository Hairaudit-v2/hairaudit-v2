/**
 * FI-OUTCOME-INTELLIGENCE-1E — Guided longitudinal capture UI feature flag.
 *
 * Does not gate backend 1C capture plans. Default off for staged rollout.
 */

export type GuidedLongitudinalCaptureConfig = {
  uiEnabled: boolean;
  isProduction: boolean;
};

function envFlagTrue(v: string | undefined | null): boolean {
  return (
    String(v ?? "")
      .trim()
      .toLowerCase() === "true"
  );
}

export function resolveGuidedLongitudinalCaptureConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  overrides?: Partial<GuidedLongitudinalCaptureConfig>
): GuidedLongitudinalCaptureConfig {
  const base: GuidedLongitudinalCaptureConfig = {
    uiEnabled: envFlagTrue(env.FI_LONGITUDINAL_CAPTURE_UI_ENABLED),
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

export function isGuidedCaptureUiEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return resolveGuidedLongitudinalCaptureConfig(env).uiEnabled;
}
