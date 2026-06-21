import { test as base, expect } from "playwright/test";
import type { DemoQaCatalog } from "../helpers/demoQaCatalog";
import { DEMO_QA_SEED_USER_PASSWORD } from "../helpers/demoQaCatalog";
import { loginAsPatient } from "../helpers/auth";

function readCatalog(): DemoQaCatalog | null {
  const raw = process.env.E2E_DEMO_CATALOG_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoQaCatalog;
  } catch {
    return null;
  }
}

const skipReason = process.env.E2E_SKIP_REASON ?? "E2E prerequisites not met.";

export const test = base.extend<{ catalog: DemoQaCatalog; demoPassword: string }>({
  catalog: async ({}, use) => {
    await use(readCatalog() ?? { preSurgery: [], postSurgery: [], all: [] });
  },
  demoPassword: async ({}, use) => {
    await use(DEMO_QA_SEED_USER_PASSWORD);
  },
});

export { expect, loginAsPatient };

export function skipIfE2eBlocked(): void {
  if (process.env.E2E_SKIP_ALL === "true") {
    test.skip(true, skipReason);
  }
}
