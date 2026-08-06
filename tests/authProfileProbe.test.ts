/**
 * HA-AUTH-PROFILE-401-FIX — /api/profiles contract + public-route probe safety.
 * Run: pnpm tsx --test tests/authProfileProbe.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolvePostAuthRedirect } from "@/lib/auth/resolvePostAuthRedirect";
import { dashboardPathForRole } from "@/lib/auth/redirects";

const root = process.cwd();

function readSrc(...parts: string[]) {
  return fs.readFileSync(path.join(root, ...parts), "utf8");
}

// --- resolvePostAuthRedirect ---
test("resolvePostAuthRedirect: waits while role is loading (no patient fallback)", () => {
  const result = resolvePostAuthRedirect({
    requestedNextPath: "/dashboard",
    resolvedRole: null,
    profileReady: false,
  });
  assert.equal("wait" in result, true);
  if ("wait" in result) assert.equal(result.reason, "role_loading");
});

test("resolvePostAuthRedirect: missing role after ready goes to controlled beta-access state", () => {
  const result = resolvePostAuthRedirect({
    requestedNextPath: "/dashboard/patient",
    resolvedRole: null,
    profileReady: true,
  });
  assert.equal("noRole" in result, true);
  if ("noRole" in result) {
    assert.equal(result.path, "/beta-access-message");
    assert.equal(result.reason, "profile_role_unavailable");
  }
});

test("resolvePostAuthRedirect: auditor never lands on patient dashboard", () => {
  for (const next of ["/dashboard", "/dashboard/patient", "/dashboard/patient/foo"]) {
    const result = resolvePostAuthRedirect({
      requestedNextPath: next,
      resolvedRole: "auditor",
      profileReady: true,
    });
    assert.equal("path" in result && !("noRole" in result), true);
    if ("path" in result && !("noRole" in result)) {
      assert.equal(result.path, "/dashboard/auditor");
    }
  }
});

test("resolvePostAuthRedirect: patient canonicalizes /dashboard", () => {
  const result = resolvePostAuthRedirect({
    requestedNextPath: "/dashboard",
    resolvedRole: "patient",
    profileReady: true,
  });
  assert.ok("path" in result);
  if ("path" in result) {
    assert.equal(result.path, "/dashboard/patient");
    assert.equal(result.reason, "canonical_role_dashboard");
  }
});

test("resolvePostAuthRedirect: preserves explicit non-generic next for patients", () => {
  const result = resolvePostAuthRedirect({
    requestedNextPath: "/cases/abc/patient/contact",
    resolvedRole: "patient",
    profileReady: true,
  });
  assert.ok("path" in result);
  if ("path" in result) {
    assert.equal(result.path, "/cases/abc/patient/contact");
    assert.equal(result.reason, "explicit_next");
  }
});

// --- Source contract: GET /api/profiles soft-anonymous ---
test("GET /api/profiles documents optional-auth soft-200 anonymous contract", () => {
  const src = readSrc("src/app/api/profiles/route.ts");
  assert.match(src, /authenticated:\s*false/);
  assert.match(src, /profile:\s*null/);
  assert.match(src, /HA-AUTH-PROFILE-401-FIX/);
  assert.match(src, /probeKind: "anonymous"/);
  // Must not treat anonymous as 401 on GET
  assert.match(src, /if \(!user\) \{[\s\S]*?return NextResponse\.json\(\{ authenticated: false, profile: null \}\)/);
  // Mutations stay hard-auth
  assert.match(src, /PATCH[\s\S]*status: 401/);
  assert.match(src, /POST[\s\S]*status: 401/);
  // Missing profile row must not invent patient via parseRole alone on empty row
  assert.match(src, /role: null/);
});

// --- I18nProvider: auth-first, no anonymous profiles probe ---
test("I18nProvider skips /api/profiles until session user exists", () => {
  const src = readSrc("src/components/i18n/I18nProvider.tsx");
  assert.match(src, /HA-AUTH-PROFILE-401-FIX/);
  assert.match(src, /getSession/);
  assert.match(src, /if \(!session\?\.user\)/);
  assert.match(src, /createSupabaseBrowserClient/);
  // Profile GET must be gated behind session.user
  const sessionGateIdx = src.indexOf("if (!session?.user)");
  const profileFetchIdx = src.indexOf('fetch("/api/profiles")');
  assert.ok(sessionGateIdx > 0, "expected session gate");
  assert.ok(profileFetchIdx > sessionGateIdx, "profile fetch must follow session gate");
  // Persist path also gated
  assert.match(src, /persistLocaleRemote[\s\S]*getSession/);
  assert.doesNotMatch(src, /signOut\(/);
  assert.doesNotMatch(src, /router\.(push|replace)/);
  assert.doesNotMatch(src, /location\.(href|assign|replace).*dashboard\/patient/);
});

// --- Root layout still mounts I18nProvider (public routes) ---
test("root layout mounts I18nProvider for all routes including public", () => {
  const src = readSrc("src/app/layout.tsx");
  assert.match(src, /I18nProvider/);
});

// --- OAuth callback cookies on redirect ---
test("auth callback writes session cookies onto redirect response", () => {
  const callbackSrc = readSrc("src/app/auth/callback/route.ts");
  const clientSrc = readSrc("src/lib/supabase/auth-callback-client.ts");
  assert.match(callbackSrc, /createAuthCallbackSupabaseClient/);
  assert.match(callbackSrc, /applyCookies/);
  assert.match(callbackSrc, /logAuthProbe/);
  assert.match(callbackSrc, /callbackExchangeSucceeded/);
  assert.match(clientSrc, /response\.cookies\.set/);
  assert.match(clientSrc, /exchangeCodeForSession|pending/);
});

// --- post-callback: no dash without session; auditor override ---
test("post-callback refuses dashboard without session and uses role resolver", () => {
  const src = readSrc("src/app/auth/post-callback/page.tsx");
  assert.match(src, /auth_session_missing/);
  assert.match(src, /resolvePostAuthRedirect/);
  assert.match(src, /fetch\("\/api\/profiles"\)/);
  assert.doesNotMatch(src, /window\.location\.replace\(nextPath\)/);
});

test("dashboardPathForRole still maps auditor correctly (regression)", () => {
  assert.equal(dashboardPathForRole("auditor"), "/dashboard/auditor");
  assert.equal(dashboardPathForRole("patient"), "/dashboard/patient");
});

test("public route list remains ungated by middleware auth redirects", () => {
  const src = readSrc("middleware.ts");
  assert.match(src, /pathname\.startsWith\("\/login"\)/);
  assert.match(src, /pathname\.startsWith\("\/signup"\)/);
  assert.match(src, /pathname\.startsWith\("\/auth"\)/);
  // Middleware must not sign out or force patient dashboard
  assert.doesNotMatch(src, /signOut/);
  assert.doesNotMatch(src, /dashboard\/patient/);
});
