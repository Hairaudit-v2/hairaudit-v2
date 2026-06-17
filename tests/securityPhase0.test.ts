import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  getContributionTokenSecret,
  getReportRenderTokenSecret,
  requireReportRenderTokenSecret,
  getInternalApiKey,
  isProductionRuntime,
} from "../src/lib/security/secrets";
import { blockIfProduction } from "../src/lib/security/routeGuards";
import { resolveProfileUpsertRole } from "../src/lib/security/profileRolePolicy";
import { hashContributionToken } from "../src/lib/transparency/contributionTokens";

const ENV_KEYS = [
  "NODE_ENV",
  "CONTRIBUTION_TOKEN_SECRET",
  "REPORT_RENDER_TOKEN",
  "INTERNAL_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

type EnvSnapshot = Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

function snapshotEnv(): EnvSnapshot {
  const out: EnvSnapshot = {};
  for (const key of ENV_KEYS) {
    out[key] = process.env[key];
  }
  return out;
}

function restoreEnv(snap: EnvSnapshot) {
  for (const key of ENV_KEYS) {
    const value = snap[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("security secrets", () => {
  let envSnap: EnvSnapshot;

  beforeEach(() => {
    envSnap = snapshotEnv();
  });

  afterEach(() => {
    restoreEnv(envSnap);
  });

  it("does not use SUPABASE_SERVICE_ROLE_KEY for contribution token hashing", () => {
    process.env.NODE_ENV = "test";
    process.env.CONTRIBUTION_TOKEN_SECRET = "explicit-contribution-secret";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-should-not-be-used";
    const hash = hashContributionToken("abc");
    process.env.CONTRIBUTION_TOKEN_SECRET = "other-secret";
    const hashOther = hashContributionToken("abc");
    assert.notStrictEqual(hash, hashOther);
  });

  it("throws in production when CONTRIBUTION_TOKEN_SECRET is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.CONTRIBUTION_TOKEN_SECRET;
    assert.throws(() => getContributionTokenSecret(), /CONTRIBUTION_TOKEN_SECRET/);
  });

  it("getReportRenderTokenSecret excludes service role key", () => {
    process.env.NODE_ENV = "test";
    delete process.env.REPORT_RENDER_TOKEN;
    delete process.env.INTERNAL_API_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-only";
    assert.strictEqual(getReportRenderTokenSecret(), null);
  });

  it("requireReportRenderTokenSecret prefers REPORT_RENDER_TOKEN", () => {
    process.env.NODE_ENV = "test";
    process.env.REPORT_RENDER_TOKEN = "render-secret";
    process.env.INTERNAL_API_KEY = "internal-key";
    assert.strictEqual(requireReportRenderTokenSecret(), "render-secret");
  });

  it("getInternalApiKey excludes service role key", () => {
    process.env.NODE_ENV = "test";
    delete process.env.INTERNAL_API_KEY;
    delete process.env.REPORT_RENDER_TOKEN;
    delete process.env.INTERNAL_BUILD_PDF_TOKEN;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-only";
    assert.strictEqual(getInternalApiKey(), null);
  });
});

describe("routeGuards blockIfProduction", () => {
  let envSnap: EnvSnapshot;

  beforeEach(() => {
    envSnap = snapshotEnv();
  });

  afterEach(() => {
    restoreEnv(envSnap);
  });

  it("returns 404 response in production", () => {
    process.env.NODE_ENV = "production";
    assert.ok(isProductionRuntime());
    const res = blockIfProduction();
    assert.ok(res);
    assert.strictEqual(res.status, 404);
  });

  it("returns null outside production", () => {
    process.env.NODE_ENV = "development";
    assert.strictEqual(blockIfProduction(), null);
  });
});

describe("profile role escalation policy", () => {
  it("allows doctor on first profile when metadata matches signup", () => {
    const decision = resolveProfileUpsertRole({
      existingProfileRole: null,
      requestedRole: "doctor",
      userEmail: "doc@example.com",
      userMetadataRole: "doctor",
    });
    assert.deepStrictEqual(decision, { ok: true, role: "doctor" });
  });

  it("rejects doctor escalation for existing patient profile", () => {
    const decision = resolveProfileUpsertRole({
      existingProfileRole: "patient",
      requestedRole: "doctor",
      userEmail: "pat@example.com",
      userMetadataRole: "doctor",
    });
    assert.deepStrictEqual(decision, { ok: false, reason: "role_escalation_forbidden" });
  });

  it("rejects doctor on first profile without matching metadata", () => {
    const decision = resolveProfileUpsertRole({
      existingProfileRole: null,
      requestedRole: "doctor",
      userEmail: "pat@example.com",
      userMetadataRole: "patient",
    });
    assert.deepStrictEqual(decision, { ok: false, reason: "invalid_signup_role" });
  });

  it("preserves existing clinic role", () => {
    const decision = resolveProfileUpsertRole({
      existingProfileRole: "clinic",
      requestedRole: "patient",
      userEmail: "clinic@example.com",
      userMetadataRole: "clinic",
    });
    assert.deepStrictEqual(decision, { ok: true, role: "clinic" });
  });
});

describe("debug route modules are guarded", () => {
  it("debug cases route imports requireDevRouteAccess", async () => {
    const mod = await import("../src/app/api/debug/cases/route.ts");
    assert.strictEqual(typeof mod.GET, "function");
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/app/api/debug/cases/route.ts", import.meta.url), "utf8")
    );
    assert.match(src, /requireDevRouteAccess/);
  });

  it("seed-answers route imports requireDevRouteAccess", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/app/api/audit/seed-answers/route.ts", import.meta.url), "utf8")
    );
    assert.match(src, /requireDevRouteAccess/);
  });
});
