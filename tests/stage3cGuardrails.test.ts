import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN_ROUTE_FILE_NAMES = [
  "route1.ts",
  "route2.ts",
  "route.bak.ts",
  "route.old.ts",
  "route.copy.ts",
  "route.backup.ts",
];

function walkDir(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walkDir(full, out);
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
}

describe("Stage 3C: API route folder hygiene", () => {
  it("does not contain alternate route modules (route1, route.bak, …) under App Router API/cases trees", () => {
    const roots = [
      path.join(REPO_ROOT, "src", "app", "api"),
      path.join(REPO_ROOT, "src", "app", "cases"),
    ];
    const files: string[] = [];
    for (const r of roots) {
      if (fs.existsSync(r)) walkDir(r, files);
    }
    const hits = files.filter((f) => {
      const base = path.basename(f);
      return FORBIDDEN_ROUTE_FILE_NAMES.includes(base);
    });
    assert.deepStrictEqual(
      hits,
      [],
      `Remove or rename stray route files (Next only wires route.ts): ${hits.join(", ")}`
    );
  });

  it("critical upload routes each declare a single route module (route.ts only)", () => {
    const dirs = [
      "src/app/api/uploads/signed-url",
      "src/app/api/uploads/list",
      "src/app/api/uploads/patient-photos",
      "src/app/api/uploads/doctor-photos",
      "src/app/api/uploads/clinic-photos",
      "src/app/api/uploads/audit-photos",
    ];
    for (const rel of dirs) {
      const d = path.join(REPO_ROOT, rel);
      if (!fs.existsSync(d)) continue;
      const ts = fs.readdirSync(d).filter((n) => n.endsWith(".ts") || n.endsWith(".tsx"));
      const routeModules = ts.filter((n) => n.startsWith("route"));
      assert.deepStrictEqual(
        routeModules,
        ["route.ts"],
        `${rel}: expected only route.ts, found ${JSON.stringify(routeModules)}`
      );
    }
  });
});

describe("Stage 3C: case create route contract", () => {
  it("POST /api/cases/create and POST /cases/create delegate to handlePostCreateAuditCaseRoute only", () => {
    const apiPath = path.join(REPO_ROOT, "src", "app", "api", "cases", "create", "route.ts");
    const legacyPath = path.join(REPO_ROOT, "src", "app", "cases", "create", "route.ts");
    const apiSrc = fs.readFileSync(apiPath, "utf8");
    const legacySrc = fs.readFileSync(legacyPath, "utf8");

    for (const [label, src] of [
      ["api", apiSrc],
      ["legacy", legacySrc],
    ] as const) {
      assert.match(
        src,
        /handlePostCreateAuditCaseRoute/,
        `${label} route should import shared handler`
      );
      assert.doesNotMatch(
        src,
        /createAuditCase\b/,
        `${label} route should not call createAuditCase directly (use shared handler)`
      );
      assert.doesNotMatch(
        src,
        /createSupabaseAuthServerClient/,
        `${label} route should not inline auth (use shared handler)`
      );
    }
  });

  it("shared handler owns createAuditCase invocation", () => {
    const h = path.join(REPO_ROOT, "src", "lib", "cases", "createAuditCasePostHandler.server.ts");
    const src = fs.readFileSync(h, "utf8");
    assert.match(src, /handlePostCreateAuditCaseRoute/);
    assert.match(src, /createAuditCase\(/);
    assert.match(src, /createSupabaseAuthServerClient/);
  });
});
