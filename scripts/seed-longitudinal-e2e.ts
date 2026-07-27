/**
 * FI-OUTCOME-INTELLIGENCE-1F — Seed / reset longitudinal E2E fixtures.
 *
 * Usage:
 *   FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true pnpm longitudinal-e2e:seed
 *   FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true pnpm longitudinal-e2e:seed -- --keys=FRONTAL,RESUME,ISOLATION-A,ISOLATION-B
 *   FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true pnpm longitudinal-e2e:reset
 *
 * Writes catalog JSON to tmp/longitudinal-e2e-catalog.json for Playwright.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { tryCreateSupabaseAdminClient } from "../src/lib/supabase/admin";
import {
  assertLongitudinalE2eFixturesAllowed,
  seedAllLongitudinalE2eFixtures,
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

function parseArgs(argv: string[]) {
  const keysArg = argv.find((a) => a.startsWith("--keys="));
  return {
    reset: argv.includes("--reset") || argv.includes("reset"),
    dryRun: argv.includes("--dry-run"),
    json: argv.includes("--json"),
    keys: keysArg
      ? keysArg
          .slice("--keys=".length)
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
  };
}

async function main() {
  loadEnvLocal();
  applyDemoSeedInsecureTlsIfRequested();
  const args = parseArgs(process.argv.slice(2));

  if (args.dryRun) {
    console.log(
      JSON.stringify({
        ok: true,
        mode: "dry-run",
        note: "No database writes. Pass without --dry-run to seed.",
      })
    );
    return;
  }

  assertLongitudinalE2eFixturesAllowed();

  const admin = tryCreateSupabaseAdminClient();
  if (!admin) {
    console.error(
      JSON.stringify({
        ok: false,
        error:
          "Missing Supabase admin env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).",
      })
    );
    process.exitCode = 1;
    return;
  }

  if (args.reset) {
    const result = await cleanupLongitudinalE2eFixtures(admin);
    console.log(
      JSON.stringify({ ok: true, mode: "reset", ...result }, null, 2)
    );
    return;
  }

  const catalog = await seedAllLongitudinalE2eFixtures(admin, args.keys);
  const outDir = path.resolve(__dirname, "../tmp");
  fs.mkdirSync(outDir, { recursive: true });
  const catalogPath = path.join(outDir, "longitudinal-e2e-catalog.json");
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

  const payload = {
    ok: true,
    mode: "seed",
    count: catalog.entries.length,
    catalogPath,
    keys: catalog.entries.map((e) => e.fixtureKey),
  };

  if (args.json) {
    console.log(JSON.stringify({ ...payload, catalog }, null, 2));
  } else {
    console.log("FI-OUTCOME-INTELLIGENCE-1F longitudinal E2E seed complete");
    console.log(`fixtures: ${payload.count}`);
    console.log(`catalog: ${catalogPath}`);
    for (const e of catalog.entries) {
      console.log(`  ${e.fixtureKey} → ${e.email} case=${e.caseId}`);
    }
  }
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
