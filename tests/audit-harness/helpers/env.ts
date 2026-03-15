/**
 * Load .env.local into process.env for harness runs (no dotenv dependency).
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../../..");

export function loadEnvLocal(): void {
  const envPath = path.join(ROOT, ".env.local");
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
      raw.startsWith('"') && raw.endsWith('"')
        ? raw.slice(1, -1).replace(/\\"/g, '"')
        : raw;
    if (!process.env[key]) process.env[key] = val;
  }
}

const ENV_LOCAL_PATH = ".env.local at project root";

/** Required env vars for the audit harness. */
export const HARNESS_REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "HARNESS_TEST_USER_ID",
] as const;

/**
 * Validate all required env vars. Call before runHarness for clear, fail-fast errors.
 * Throws with a message listing exactly which variable(s) are missing and where to add them.
 */
export function validateHarnessEnv(): void {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  const userId = process.env.HARNESS_TEST_USER_ID?.trim();
  if (!userId || userId.length === 0) missing.push("HARNESS_TEST_USER_ID (a Supabase Auth user UUID)");
  if (missing.length === 0) return;
  throw new Error(
    `Missing required environment variable(s): ${missing.join(", ")}.\n` +
      `Add them to ${ENV_LOCAL_PATH}.\n` +
      `Example:\n  NEXT_PUBLIC_SUPABASE_URL=https://...\n  SUPABASE_SERVICE_ROLE_KEY=...\n  HARNESS_TEST_USER_ID=your-user-uuid`
  );
}

/** Test user ID for creating cases/uploads. Prefer HARNESS_TEST_USER_ID. */
export function getTestUserId(): string {
  const id = process.env.HARNESS_TEST_USER_ID?.trim();
  if (id && id.length > 0) return id;
  throw new Error(
    "Audit harness requires HARNESS_TEST_USER_ID (a valid Supabase Auth user UUID).\n" +
      `  Add to ${ENV_LOCAL_PATH}:\n` +
      "    HARNESS_TEST_USER_ID=your-user-uuid-here\n" +
      "  Create a test user in Supabase Auth if needed, then use its id."
  );
}
