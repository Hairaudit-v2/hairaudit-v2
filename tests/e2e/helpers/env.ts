import fs from "node:fs";
import path from "node:path";

/** Production-like hosts blocked unless E2E_ALLOW_PRODUCTION=true. */
const PRODUCTION_HOST_PATTERNS = [
  /^https?:\/\/(www\.)?hairaudit\.com/i,
  /^https?:\/\/hairaudit\.vercel\.app/i,
];

/** Load `.env.local` from repo root into `process.env` (does not override existing keys). */
export function loadProjectEnvLocal(): void {
  const root = path.resolve(__dirname, "../../..");
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const val =
      raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1).replace(/\\"/g, '"') : raw;
    if (!process.env[key]) process.env[key] = val;
  }
}

export function resolveE2eBaseUrl(): string {
  return process.env.E2E_BASE_URL ?? "http://localhost:3000";
}

export function isProductionE2eTarget(baseURL = resolveE2eBaseUrl()): boolean {
  try {
    const { hostname, protocol } = new URL(baseURL);
    if (hostname === "localhost" || hostname === "127.0.0.1") return false;
    if (protocol !== "http:" && protocol !== "https:") return true;
    return PRODUCTION_HOST_PATTERNS.some((pattern) => pattern.test(baseURL));
  } catch {
    return true;
  }
}

export function e2eTargetBlockedReason(baseURL = resolveE2eBaseUrl()): string | null {
  if (process.env.E2E_ALLOW_PRODUCTION === "true") return null;
  if (isProductionE2eTarget(baseURL)) {
    return `E2E blocked against production-like target ${baseURL}. Set E2E_ALLOW_PRODUCTION=true to override.`;
  }
  return null;
}

export function hasSupabaseAdminEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url?.trim() && key?.trim());
}
