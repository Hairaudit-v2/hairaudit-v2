/**
 * FI-OUTCOME-INTELLIGENCE-1F — Cleanup fixture namespace only.
 *
 * Usage:
 *   FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true pnpm longitudinal-e2e:cleanup
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { tryCreateSupabaseAdminClient } from "../src/lib/supabase/admin";
import {
  assertLongitudinalE2eFixturesAllowed,
  cleanupLongitudinalE2eFixtures,
} from "../tests/fixtures/longitudinalE2e";
import { applyDemoSeedInsecureTlsIfRequested } from "./lib/demoQaSupabase";

function loadEnvLocal() {
  const root = path.resolve(__dirname, "..");
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
      raw.startsWith('"') && raw.endsWith('"')
        ? raw.slice(1, -1).replace(/\\"/g, '"')
        : raw;
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  applyDemoSeedInsecureTlsIfRequested();
  assertLongitudinalE2eFixturesAllowed();
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "Missing Supabase admin env.",
      })
    );
    process.exitCode = 1;
    return;
  }

  const result = await cleanupLongitudinalE2eFixtures(admin, {
    deleteUsers: true,
  });

  const catalogPath = path.resolve(__dirname, "../tmp/longitudinal-e2e-catalog.json");
  if (fs.existsSync(catalogPath)) fs.unlinkSync(catalogPath);

  console.log(
    JSON.stringify({ ok: true, mode: "cleanup", ...result }, null, 2)
  );
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  );
  process.exitCode = 1;
});
