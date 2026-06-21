import * as fs from "fs";
import * as path from "path";
import { loadDemoQaCatalog } from "./demoQaCatalog";
import { e2eTargetBlockedReason, hasSupabaseAdminEnv } from "./env";

function loadEnvLocal() {
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
    const val = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1).replace(/\\"/g, '"') : raw;
    if (!process.env[key]) process.env[key] = val;
  }
}

export default async function globalSetup(): Promise<void> {
  loadEnvLocal();
  const blocked = e2eTargetBlockedReason();
  if (blocked) {
    process.env.E2E_SKIP_ALL = "true";
    process.env.E2E_SKIP_REASON = blocked;
    return;
  }

  if (!hasSupabaseAdminEnv()) {
    process.env.E2E_SKIP_ALL = "true";
    process.env.E2E_SKIP_REASON = "Missing Supabase admin env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).";
    return;
  }

  const catalog = await loadDemoQaCatalog();
  if (!catalog || catalog.all.length < 20) {
    process.env.E2E_SKIP_ALL = "true";
    process.env.E2E_SKIP_REASON =
      "Demo QA seed data not found. Run `npm run seed:demo-qa` against this Supabase project first.";
    return;
  }

  process.env.E2E_DEMO_CATALOG_JSON = JSON.stringify(catalog);
}
