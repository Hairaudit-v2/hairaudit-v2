import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  authorizeInternalApiRequest,
  configuredInternalApiKeys,
  isInternalApiRequestAuthorized,
  resolveProvidedInternalApiKey,
} from "../src/lib/security/internalApiAuth";
import {
  COMMUNITY_MAX_IMAGE_DATA_BYTES,
  estimateDataUrlBytes,
  guardCommunityRatingValues,
  guardCommunityWritePayload,
} from "../src/lib/security/communityApiGuard";

const ENV_KEYS = [
  "NODE_ENV",
  "INTERNAL_API_KEY",
  "REPORT_RENDER_TOKEN",
  "INTERNAL_BUILD_PDF_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

type EnvSnapshot = Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

function snapshotEnv(): EnvSnapshot {
  const out: EnvSnapshot = {};
  for (const key of ENV_KEYS) out[key] = process.env[key];
  return out;
}

function restoreEnv(snap: EnvSnapshot) {
  for (const key of ENV_KEYS) {
    const value = snap[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function mockRequest(headers: Record<string, string> = {}, url = "https://example.com/api/test"): Request {
  return new Request(url, { headers });
}

describe("internalApiAuth", () => {
  let envSnap: EnvSnapshot;

  beforeEach(() => {
    envSnap = snapshotEnv();
    process.env.NODE_ENV = "test";
    process.env.INTERNAL_API_KEY = "test-internal-key";
    delete process.env.REPORT_RENDER_TOKEN;
    delete process.env.INTERNAL_BUILD_PDF_TOKEN;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-should-not-auth";
  });

  afterEach(() => {
    restoreEnv(envSnap);
  });

  it("configuredInternalApiKeys excludes service role", () => {
    const keys = configuredInternalApiKeys();
    assert.ok(keys.includes("test-internal-key"));
    assert.ok(!keys.includes("service-role-should-not-auth"));
  });

  it("authorizes valid x-internal-api-key header", () => {
    const req = mockRequest({ "x-internal-api-key": "test-internal-key" });
    assert.strictEqual(isInternalApiRequestAuthorized(req), true);
  });

  it("rejects service role key as internal api key", () => {
    const req = mockRequest({ "x-internal-api-key": "service-role-should-not-auth" });
    assert.strictEqual(isInternalApiRequestAuthorized(req), false);
    assert.strictEqual(authorizeInternalApiRequest(req), false);
  });

  it("rejects missing header", () => {
    assert.strictEqual(isInternalApiRequestAuthorized(mockRequest()), false);
  });

  it("accepts Bearer token form", () => {
    const req = mockRequest({ authorization: "Bearer test-internal-key" });
    assert.strictEqual(resolveProvidedInternalApiKey(req), "test-internal-key");
    assert.strictEqual(isInternalApiRequestAuthorized(req), true);
  });
});

describe("communityApiGuard", () => {
  it("blocks oversized image data URLs", () => {
    const huge = "data:image/png;base64," + "A".repeat(COMMUNITY_MAX_IMAGE_DATA_BYTES + 1);
    const res = guardCommunityWritePayload(mockRequest(), [huge]);
    assert.ok(res);
    assert.strictEqual(res.status, 413);
  });

  it("allows small payloads", () => {
    const small = "data:image/png;base64," + "A".repeat(100);
    assert.strictEqual(guardCommunityWritePayload(mockRequest({ "content-length": "500" }), [small]), null);
  });

  it("estimateDataUrlBytes sums string lengths", () => {
    assert.strictEqual(estimateDataUrlBytes(["abc", "de"]), 5);
  });

  it("guardCommunityRatingValues rejects invalid ratings", () => {
    const res = guardCommunityRatingValues({ naturalness: null, density: 3, hairlineDesign: 3 });
    assert.ok(res);
    assert.strictEqual(res.status, 400);
  });

  it("guardCommunityRatingValues passes valid ratings", () => {
    assert.strictEqual(
      guardCommunityRatingValues({ naturalness: 3, density: 4, hairlineDesign: 5 }),
      null
    );
  });
});

describe("render-pdf route uses internalApiAuth", () => {
  it("route module imports authorizeInternalApiRequest", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/app/api/internal/render-pdf/route.ts", import.meta.url), "utf8")
    );
    assert.match(src, /authorizeInternalApiRequest/);
    assert.doesNotMatch(src, /SUPABASE_SERVICE_ROLE_KEY/);
  });
});
