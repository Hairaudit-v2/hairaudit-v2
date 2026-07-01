import { CRON_OR_WEBHOOK_SECRET_MIN_LENGTH } from "@/lib/security/timingSafeSecret";

function truthyEnv(v: string | undefined): boolean {
  const s = v?.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function readHaNexusEnabled(): boolean {
  return truthyEnv(process.env.HA_NEXUS_ENABLED);
}

export function readHaNexusRequireApproval(): boolean {
  const raw = process.env.HA_NEXUS_REQUIRE_APPROVAL?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return true;
}

export function readHaNexusSecret(): string | null {
  const secret = process.env.HA_NEXUS_SECRET?.trim();
  if (!secret || secret.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) {
    return null;
  }
  return secret;
}

export function readHaNexusAllowedSources(): Set<string> {
  const raw = process.env.HA_NEXUS_ALLOWED_SOURCES?.trim();
  if (!raw) return new Set(["fi_os", "iiohr"]);
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export type HaNexusEnvSnapshot = {
  enabled: boolean;
  secretConfigured: boolean;
  requireApproval: boolean;
  allowedSources: string[];
};

export function readHaNexusEnvSnapshot(env: NodeJS.ProcessEnv = process.env): HaNexusEnvSnapshot {
  const secret = env.HA_NEXUS_SECRET?.trim() ?? "";
  return {
    enabled: truthyEnv(env.HA_NEXUS_ENABLED),
    secretConfigured: secret.length >= CRON_OR_WEBHOOK_SECRET_MIN_LENGTH,
    requireApproval: readHaNexusRequireApproval(),
    allowedSources: [...readHaNexusAllowedSources()],
  };
}
