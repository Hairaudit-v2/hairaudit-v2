/**
 * Regression tests for auth redirect flows: redirect helpers, callback behavior,
 * and homepage auth repair. Run: pnpm tsx --test tests/authRedirects.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeNextPath,
  dashboardPathForRole,
  getCanonicalAppUrl,
  getHomepageAuthRedirectTarget,
  buildAuthRedirectUrl,
} from "@/lib/auth/redirects";
import { GET as authCallbackGET } from "@/app/auth/callback/route";

// --- sanitizeNextPath ---
test("sanitizeNextPath: accepts internal relative paths", () => {
  assert.equal(sanitizeNextPath("/dashboard"), "/dashboard");
  assert.equal(sanitizeNextPath("/dashboard/clinic"), "/dashboard/clinic");
  assert.equal(sanitizeNextPath("/dashboard/doctor"), "/dashboard/doctor");
  assert.equal(sanitizeNextPath("/auth/recovery"), "/auth/recovery");
  assert.equal(sanitizeNextPath("/"), "/");
});

test("sanitizeNextPath: rejects null, undefined, empty", () => {
  assert.equal(sanitizeNextPath(null), null);
  assert.equal(sanitizeNextPath(undefined), null);
  assert.equal(sanitizeNextPath(""), null);
  assert.equal(sanitizeNextPath("   "), null);
});

test("sanitizeNextPath: rejects external or protocol-relative paths", () => {
  assert.equal(sanitizeNextPath("https://evil.com/path"), null);
  assert.equal(sanitizeNextPath("//evil.com/path"), null);
  assert.equal(sanitizeNextPath("/path:with:colons"), null);
  assert.equal(sanitizeNextPath("javascript:alert(1)"), null);
});

test("sanitizeNextPath: rejects paths not starting with /", () => {
  assert.equal(sanitizeNextPath("dashboard"), null);
  assert.equal(sanitizeNextPath("dashboard/clinic"), null);
});

test("sanitizeNextPath: trims whitespace", () => {
  assert.equal(sanitizeNextPath("  /dashboard/clinic  "), "/dashboard/clinic");
});

// --- dashboardPathForRole ---
test("dashboardPathForRole: maps clinic to /dashboard/clinic", () => {
  assert.equal(dashboardPathForRole("clinic"), "/dashboard/clinic");
});

test("dashboardPathForRole: maps doctor to /dashboard/doctor", () => {
  assert.equal(dashboardPathForRole("doctor"), "/dashboard/doctor");
});

test("dashboardPathForRole: maps auditor to /dashboard/auditor", () => {
  assert.equal(dashboardPathForRole("auditor"), "/dashboard/auditor");
});

test("dashboardPathForRole: fallback to /dashboard for patient and unknown", () => {
  assert.equal(dashboardPathForRole("patient"), "/dashboard");
  assert.equal(dashboardPathForRole(""), "/dashboard");
  assert.equal(dashboardPathForRole(null), "/dashboard");
  assert.equal(dashboardPathForRole(undefined), "/dashboard");
  assert.equal(dashboardPathForRole("unknown"), "/dashboard");
});

// --- getCanonicalAppUrl ---
test("getCanonicalAppUrl: returns string with no trailing slash", () => {
  const url = getCanonicalAppUrl();
  assert.equal(typeof url, "string");
  assert.ok(url.length > 0);
  assert.ok(!url.endsWith("/"), "should not end with slash");
});

test("getCanonicalAppUrl: forces https for hairaudit.com when env is http", () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  try {
    process.env.NEXT_PUBLIC_APP_URL = "http://hairaudit.com";
    const url = getCanonicalAppUrl();
    assert.ok(url.startsWith("https://"), "hairaudit.com should be upgraded to https");
  } finally {
    if (prev !== undefined) process.env.NEXT_PUBLIC_APP_URL = prev;
    else delete process.env.NEXT_PUBLIC_APP_URL;
  }
});

test("getCanonicalAppUrl: forces https for www.hairaudit.com when env is http", () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  try {
    process.env.NEXT_PUBLIC_APP_URL = "http://www.hairaudit.com";
    const url = getCanonicalAppUrl();
    assert.ok(url.startsWith("https://"), "www.hairaudit.com should be upgraded to https");
  } finally {
    if (prev !== undefined) process.env.NEXT_PUBLIC_APP_URL = prev;
    else delete process.env.NEXT_PUBLIC_APP_URL;
  }
});

// --- getHomepageAuthRedirectTarget (homepage auth repair) ---
test("getHomepageAuthRedirectTarget: returns /auth/callback?code=abc when code present", () => {
  const target = getHomepageAuthRedirectTarget({ code: "abc" });
  assert.equal(target, "/auth/callback?code=abc");
});

test("getHomepageAuthRedirectTarget: forwards next and signup_role when present", () => {
  const target = getHomepageAuthRedirectTarget({
    code: "xyz",
    next: "/dashboard/clinic",
    signup_role: "clinic",
  });
  assert.ok(target?.startsWith("/auth/callback?"));
  assert.ok(target?.includes("code=xyz"));
  assert.ok(target?.includes("next="));
  assert.ok(target?.includes("signup_role=clinic"));
});

test("getHomepageAuthRedirectTarget: returns null when no code", () => {
  assert.equal(getHomepageAuthRedirectTarget({}), null);
  assert.equal(getHomepageAuthRedirectTarget({ next: "/dashboard" }), null);
  assert.equal(getHomepageAuthRedirectTarget(null), null);
  assert.equal(getHomepageAuthRedirectTarget(undefined), null);
});

test("getHomepageAuthRedirectTarget: handles array code (first element)", () => {
  const target = getHomepageAuthRedirectTarget({ code: ["abc"] });
  assert.equal(target, "/auth/callback?code=abc");
});

// --- buildAuthRedirectUrl ---
test("buildAuthRedirectUrl: builds path with optional params", () => {
  const url = buildAuthRedirectUrl("/auth/callback", { signup_role: "clinic", next: "/dashboard/clinic" });
  assert.ok(url.startsWith("https://") || url.startsWith("http://"));
  assert.ok(url.includes("/auth/callback"));
  assert.ok(url.includes("signup_role=clinic"));
  assert.ok(url.includes("next="));
});

// --- /auth/callback route (no-code path only; avoids Supabase in tests) ---
const CALLBACK_ORIGIN = "https://example.com";
const REDIRECT_STATUS = 307; // NextResponse.redirect() uses 307

test("/auth/callback: with next=/dashboard/clinic redirects to origin + path", async () => {
  const req = new Request(`${CALLBACK_ORIGIN}/auth/callback?next=%2Fdashboard%2Fclinic`);
  const res = await authCallbackGET(req);
  assert.equal(res.status, REDIRECT_STATUS);
  assert.equal(res.headers.get("location"), `${CALLBACK_ORIGIN}/dashboard/clinic`);
});

test("/auth/callback: with invalid external next uses default (no open redirect)", async () => {
  const req = new Request(`${CALLBACK_ORIGIN}/auth/callback?next=https%3A%2F%2Fevil.com%2F`);
  const res = await authCallbackGET(req);
  assert.equal(res.status, REDIRECT_STATUS);
  const loc = res.headers.get("location");
  assert.ok(loc?.startsWith(CALLBACK_ORIGIN));
  assert.ok(!loc?.includes("evil.com"));
  assert.equal(loc, `${CALLBACK_ORIGIN}/dashboard`);
});

test("/auth/callback: with no next and signup_role=clinic redirects to /dashboard/clinic", async () => {
  const req = new Request(`${CALLBACK_ORIGIN}/auth/callback?signup_role=clinic`);
  const res = await authCallbackGET(req);
  assert.equal(res.status, REDIRECT_STATUS);
  assert.equal(res.headers.get("location"), `${CALLBACK_ORIGIN}/dashboard/clinic`);
});

test("/auth/callback: with no next and signup_role=doctor redirects to /dashboard/doctor", async () => {
  const req = new Request(`${CALLBACK_ORIGIN}/auth/callback?signup_role=doctor`);
  const res = await authCallbackGET(req);
  assert.equal(res.status, REDIRECT_STATUS);
  assert.equal(res.headers.get("location"), `${CALLBACK_ORIGIN}/dashboard/doctor`);
});

test("/auth/callback: with no next and no signup_role redirects to /dashboard", async () => {
  const req = new Request(`${CALLBACK_ORIGIN}/auth/callback`);
  const res = await authCallbackGET(req);
  assert.equal(res.status, REDIRECT_STATUS);
  assert.equal(res.headers.get("location"), `${CALLBACK_ORIGIN}/dashboard`);
});

test("/auth/callback: with invalid code redirects to /login?error=auth_callback_failed", async () => {
  const req = new Request(`${CALLBACK_ORIGIN}/auth/callback?code=invalid-code`);
  let res: Awaited<ReturnType<typeof authCallbackGET>>;
  try {
    res = await authCallbackGET(req);
  } catch (err) {
    // In CI without Next/Supabase env, handler may throw; skip assertion
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) throw err;
    return;
  }
  assert.equal(res.status, REDIRECT_STATUS);
  const loc = res.headers.get("location");
  assert.ok(loc?.includes("/login"));
  assert.ok(loc?.includes("error=auth_callback_failed"));
});
