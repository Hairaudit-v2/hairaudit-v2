import * as path from "path";
import { loadDemoQaCatalog } from "./demoQaCatalog";
import { e2eTargetBlockedReason, hasSupabaseAdminEnv, loadProjectEnvLocal } from "./env";

export default async function globalSetup(): Promise<void> {
  loadProjectEnvLocal();
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
  if (catalog && catalog.all.length >= 20) {
    process.env.E2E_DEMO_CATALOG_JSON = JSON.stringify(catalog);
    process.env.E2E_HAS_DEMO_CATALOG = "true";
  } else {
    process.env.E2E_HAS_DEMO_CATALOG = "false";
    process.env.E2E_DEMO_CATALOG_SKIP_REASON =
      "Demo QA seed data not found. Run `pnpm run seed:demo-qa` for report/PDF specs. Live journey specs still run.";
  }
}
