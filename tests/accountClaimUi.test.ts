/**
 * HA-NEXUS-2B account claim UI wiring tests.
 * Run: pnpm test:account-claim-ui
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAuthHrefWithClaimToken,
  claimErrorMessageKey,
  claimInvalidReasonMessageKey,
  getClaimTokenFromSearchParams,
  resolveClaimSignupViewMode,
  shouldShowClaimSignupForm,
  fetchClaimTokenValidation,
  CLAIM_TOKEN_SESSION_KEY,
  persistClaimToken,
  readPersistedClaimToken,
  clearPersistedClaimToken,
} from "@/lib/nexus/claimTokenClient";
import {
  claimAccountAfterAuth,
  completeAuthWithOptionalClaim,
  DOCTOR_DASHBOARD_PATH,
} from "@/lib/nexus/claimAccountAfterAuth";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

test("getClaimTokenFromSearchParams reads claimToken query param", () => {
  const params = new URLSearchParams("claimToken=abc123&role=doctor");
  assert.equal(getClaimTokenFromSearchParams(params), "abc123");
});

test("signup without claimToken uses normal view mode", () => {
  assert.equal(resolveClaimSignupViewMode(null, { status: "idle" }), "normal");
  assert.equal(shouldShowClaimSignupForm(null, { status: "idle" }), true);
});

test("valid claimToken enables claim signup form", () => {
  const validation = {
    status: "valid" as const,
    validation: {
      valid: true as const,
      role: "doctor",
      maskedEmail: "d***@example.com",
      expiresAt: "2026-07-09T12:00:00.000Z",
    },
  };
  assert.equal(resolveClaimSignupViewMode("token", validation), "claim");
  assert.equal(shouldShowClaimSignupForm("token", validation), true);
});

test("expired token hides signup form", () => {
  const validation = { status: "invalid" as const, reason: "expired" as const };
  assert.equal(shouldShowClaimSignupForm("token", validation), false);
  assert.equal(claimInvalidReasonMessageKey("expired"), "auth.claim.invalidExpired");
});

test("invalid token maps to safe message keys", () => {
  assert.equal(claimInvalidReasonMessageKey("not_found"), "auth.claim.invalidNotFound");
  assert.equal(claimInvalidReasonMessageKey("already_claimed"), "auth.claim.invalidAlreadyClaimed");
  assert.equal(claimInvalidReasonMessageKey("revoked"), "auth.claim.invalidRevoked");
  assert.equal(claimInvalidReasonMessageKey("unknown"), "auth.claim.invalidGeneric");
});

test("fetchClaimTokenValidation returns valid state", async () => {
  const mockFetch = async () =>
    ({
      ok: true,
      json: async () => ({
        valid: true,
        role: "doctor",
        maskedEmail: "d***@example.com",
        expiresAt: "2026-07-09T12:00:00.000Z",
      }),
    }) as Response;

  const result = await fetchClaimTokenValidation("token", mockFetch);
  assert.equal(result.status, "valid");
  if (result.status === "valid") {
    assert.equal(result.validation.maskedEmail, "d***@example.com");
  }
});

test("fetchClaimTokenValidation returns expired invalid state", async () => {
  const mockFetch = async () =>
    ({
      ok: false,
      json: async () => ({ valid: false, reason: "expired" }),
    }) as Response;

  const result = await fetchClaimTokenValidation("token", mockFetch);
  assert.deepEqual(result, { status: "invalid", reason: "expired" });
});

test("claimAccountAfterAuth calls claim API and redirects to doctor dashboard", async () => {
  let called = false;
  const mockFetch = async (url: string, init?: RequestInit) => {
    called = true;
    assert.equal(url, "/api/nexus/account-claim/claim");
    assert.equal(init?.method, "POST");
    assert.match(String(init?.body), /token/);
    return {
      ok: true,
      json: async () => ({ ok: true, doctorProfileId: "doc-1" }),
    } as Response;
  };

  const result = await claimAccountAfterAuth("secret-token", mockFetch);
  assert.ok(called);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.redirectPath, DOCTOR_DASHBOARD_PATH);
  }
});

test("failed claim returns safe server error", async () => {
  const mockFetch = async () =>
    ({
      ok: false,
      json: async () => ({ ok: false, error: "This invite has expired." }),
    }) as Response;

  const result = await claimAccountAfterAuth("secret-token", mockFetch);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "This invite has expired.");
    assert.equal(claimErrorMessageKey(result.error), "auth.claim.errorExpired");
  }
});

test("completeAuthWithOptionalClaim skips claim when no token", async () => {
  const result = await completeAuthWithOptionalClaim({
    queryToken: null,
    persistedToken: null,
    defaultRedirect: "/dashboard/patient",
    fetchImpl: async () => {
      throw new Error("should not fetch");
    },
  });
  assert.deepEqual(result, { ok: true, redirectPath: "/dashboard/patient" });
});

test("completeAuthWithOptionalClaim uses query token", async () => {
  const mockFetch = async () =>
    ({
      ok: true,
      json: async () => ({ ok: true }),
    }) as Response;

  const result = await completeAuthWithOptionalClaim({
    queryToken: "abc",
    defaultRedirect: "/dashboard",
    fetchImpl: mockFetch,
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.redirectPath, DOCTOR_DASHBOARD_PATH);
});

test("buildAuthHrefWithClaimToken preserves existing query params", () => {
  assert.equal(
    buildAuthHrefWithClaimToken("/login?from=request-review", "tok"),
    "/login?from=request-review&claimToken=tok"
  );
});

test("patient signup path unchanged without claimToken", () => {
  const params = new URLSearchParams("from=request-review&role=patient");
  assert.equal(getClaimTokenFromSearchParams(params), null);
  assert.equal(shouldShowClaimSignupForm(null, { status: "idle" }), true);
});

test("standalone doctor signup path unchanged without claimToken", () => {
  const params = new URLSearchParams("role=doctor");
  assert.equal(getClaimTokenFromSearchParams(params), null);
  assert.equal(resolveClaimSignupViewMode(null, { status: "idle" }), "normal");
});

test("standalone clinic signup path unchanged without claimToken", () => {
  const params = new URLSearchParams("role=clinic");
  assert.equal(getClaimTokenFromSearchParams(params), null);
  assert.equal(shouldShowClaimSignupForm(null, { status: "idle" }), true);
});

test("claim token session storage handoff", () => {
  const original = globalThis.sessionStorage;
  const memory = new MemoryStorage();
  Object.defineProperty(globalThis, "sessionStorage", { value: memory, configurable: true });
  try {
    persistClaimToken("handoff-token");
    assert.equal(memory.getItem(CLAIM_TOKEN_SESSION_KEY), "handoff-token");
    assert.equal(readPersistedClaimToken(), "handoff-token");
    clearPersistedClaimToken();
    assert.equal(readPersistedClaimToken(), null);
  } finally {
    Object.defineProperty(globalThis, "sessionStorage", { value: original, configurable: true });
  }
});

test("successful auth continuation calls claim API via completeAuthWithOptionalClaim", async () => {
  let claimCalled = false;
  const mockFetch = async () => {
    claimCalled = true;
    return {
      ok: true,
      json: async () => ({ ok: true }),
    } as Response;
  };

  await completeAuthWithOptionalClaim({
    queryToken: "persisted",
    defaultRedirect: "/dashboard/doctor",
    fetchImpl: mockFetch,
  });
  assert.ok(claimCalled);
});

test("failed claim shows mapped safe error key", async () => {
  const mockFetch = async () =>
    ({
      ok: false,
      json: async () => ({
        ok: false,
        error: "Your account is registered as a patient. Network professional access requires a separate doctor account.",
      }),
    }) as Response;

  const result = await claimAccountAfterAuth("token", mockFetch);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(claimErrorMessageKey(result.error), "auth.claim.errorPatientConflict");
  }
});
