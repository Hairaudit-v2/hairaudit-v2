/**
 * FI-OUTCOME-INTELLIGENCE-1F — Load seeded catalog for Playwright.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { LongitudinalE2eCatalog, LongitudinalE2eCatalogEntry } from "../../../fixtures/longitudinalE2e/types";

const CATALOG_PATH = path.resolve(
  process.cwd(),
  "tmp/longitudinal-e2e-catalog.json"
);

export function loadLongitudinalE2eCatalog(): LongitudinalE2eCatalog | null {
  const fromEnv = process.env.E2E_LONGITUDINAL_CATALOG_JSON;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv) as LongitudinalE2eCatalog;
    } catch {
      return null;
    }
  }
  if (!fs.existsSync(CATALOG_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8")) as LongitudinalE2eCatalog;
  } catch {
    return null;
  }
}

export function requireCatalogEntry(
  catalog: LongitudinalE2eCatalog | null,
  key: string
): LongitudinalE2eCatalogEntry | null {
  if (!catalog) return null;
  const k = key.toUpperCase().replace(/^FI-OI-1F-/, "");
  return catalog.byKey[k] ?? catalog.entries.find((e) => e.fixtureKey === k) ?? null;
}

export function skipIfLongitudinalCatalogMissing(
  test: { skip: (condition?: boolean, description?: string) => void },
  catalog: LongitudinalE2eCatalog | null
): void {
  if (!catalog || catalog.entries.length === 0) {
    test.skip(
      true,
      "Longitudinal E2E catalog missing. Run: FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true pnpm longitudinal-e2e:seed"
    );
  }
}
