/** Batch marker for idempotent demo QA seed cases (local/dev only). */
export const DEMO_QA_SEED_BATCH_PREFIX = "demo-qa";

export const DEMO_QA_SEED_USER_PASSWORD = "Demo-QA-Seed-2026!";

export const DEMO_QA_TEST_EMAIL_DOMAIN = "hairaudit.test";

export function demoQaExternalCaseId(pathway: "pre_surgery" | "post_surgery", index: number): string {
  const segment = pathway === "pre_surgery" ? "presurgery" : "postsurgery";
  return `${DEMO_QA_SEED_BATCH_PREFIX}:${segment}:${String(index).padStart(2, "0")}`;
}

export function demoQaUserEmail(pathway: "pre_surgery" | "post_surgery", index: number): string {
  const prefix = pathway === "pre_surgery" ? "presurgery-demo" : "postsurgery-demo";
  return `${prefix}-${String(index).padStart(2, "0")}@${DEMO_QA_TEST_EMAIL_DOMAIN}`;
}

export function demoQaDisplayName(pathway: "pre_surgery" | "post_surgery", index: number, title: string): string {
  const label = pathway === "pre_surgery" ? "Pre-Surgery Demo" : "Post-Surgery Demo";
  return `${label} ${String(index).padStart(2, "0")} — ${title}`;
}

/**
 * Guard: blocks production unless DEMO_SEED_ENABLED=true.
 * Always blocks when neither development nor explicit enable flag is set.
 */
export function assertDemoSeedAllowed(nodeEnv: string | undefined = process.env.NODE_ENV): void {
  const enabled = process.env.DEMO_SEED_ENABLED === "true";
  const isProduction = nodeEnv === "production";

  if (isProduction && !enabled) {
    throw new Error(
      "Demo QA seed is blocked in production. Set DEMO_SEED_ENABLED=true to override (not recommended)."
    );
  }

  if (isProduction && enabled) {
    console.warn("[demo-qa-seed] DEMO_SEED_ENABLED=true — running in production (use with caution).");
  }
}
