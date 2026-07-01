/**
 * FIN-IMAGING-3 — HairAudit staging cutover modes for FI unified classifier.
 *
 * HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER controls cutover mode:
 *   legacy (default) — existing classifier only
 *   shadow           — legacy authoritative + unified shadow compare
 *   fi_os              — unified FI classifier authoritative
 *
 * Legacy inner providers (dry_run, manual_stub, fi_os_legacy, openai) are resolved via
 * HAIRAUDIT_FI_IMAGE_CLASSIFIER_LEGACY_PROVIDER, or from the provider env when it is not
 * a cutover mode value (backward compatible with Phase 3D/E).
 */

export type FiImageClassifierCutoverMode = "legacy" | "shadow" | "fi_os";

export type FiImageClassifierLegacyProvider =
  | "dry_run"
  | "manual_stub"
  | "fi_os_legacy"
  | "openai";

const CUTOVER_MODES = new Set<FiImageClassifierCutoverMode>(["legacy", "shadow", "fi_os"]);

const LEGACY_PROVIDERS = new Set<FiImageClassifierLegacyProvider>([
  "dry_run",
  "manual_stub",
  "fi_os_legacy",
  "openai",
]);

/** @deprecated Use FiImageClassifierLegacyProvider — retained for Phase 3E option overrides. */
export type FiImageClassifierProvider = FiImageClassifierLegacyProvider | "fi_os";

const VALID_OPTION_PROVIDERS = new Set<string>([
  ...LEGACY_PROVIDERS,
  "fi_os",
]);

export function resolveFiImageClassifierCutoverMode(
  env: NodeJS.ProcessEnv = process.env
): FiImageClassifierCutoverMode {
  const raw = env.HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER?.trim().toLowerCase();
  if (raw === "shadow") return "shadow";
  if (raw === "fi_os") return "fi_os";
  if (raw === "legacy") return "legacy";
  return "legacy";
}

export function resolveFiImageClassifierLegacyProvider(
  env: NodeJS.ProcessEnv = process.env
): FiImageClassifierLegacyProvider {
  const legacyEnv = env.HAIRAUDIT_FI_IMAGE_CLASSIFIER_LEGACY_PROVIDER?.trim().toLowerCase();
  if (legacyEnv && LEGACY_PROVIDERS.has(legacyEnv as FiImageClassifierLegacyProvider)) {
    return legacyEnv as FiImageClassifierLegacyProvider;
  }

  const raw = env.HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER?.trim().toLowerCase();
  if (raw && LEGACY_PROVIDERS.has(raw as FiImageClassifierLegacyProvider)) {
    return raw as FiImageClassifierLegacyProvider;
  }

  return "dry_run";
}

/** Maps explicit worker/test provider override to legacy inner provider. */
export function resolveLegacyProviderFromOption(
  provider: FiImageClassifierProvider | undefined,
  env: NodeJS.ProcessEnv = process.env
): FiImageClassifierLegacyProvider {
  if (provider === "fi_os") return "fi_os_legacy";
  if (provider && LEGACY_PROVIDERS.has(provider as FiImageClassifierLegacyProvider)) {
    return provider as FiImageClassifierLegacyProvider;
  }
  return resolveFiImageClassifierLegacyProvider(env);
}

export function isValidOptionClassifierProvider(value: string): value is FiImageClassifierProvider {
  return VALID_OPTION_PROVIDERS.has(value);
}

export function isRealAiLegacyProvider(provider: FiImageClassifierLegacyProvider): boolean {
  return provider === "fi_os_legacy" || provider === "openai";
}

export function cutoverModeUsesUnifiedClassifier(mode: FiImageClassifierCutoverMode): boolean {
  return mode === "shadow" || mode === "fi_os";
}

export function cutoverModeIsShadow(mode: FiImageClassifierCutoverMode): boolean {
  return mode === "shadow";
}
