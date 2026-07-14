/**
 * Production claim-account smoke (HA-PROD-CLAIM-ACCOUNT-INCIDENT-1A).
 * Uses production Supabase + https://www.hairaudit.com API.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Optional: SMOKE_BASE_URL (default https://www.hairaudit.com)
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  const env = Object.fromEntries(
    fs
      .readFileSync(p, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      })
  );
  for (const [k, v] of Object.entries(env)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const BASE = (process.env.SMOKE_BASE_URL || "https://www.hairaudit.com").replace(/\/+$/, "");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

function cookieJar() {
  /** @type {Map<string, string>} */
  const jar = new Map();
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() ?? [];
      for (const c of raw) {
        const [pair] = c.split(";");
        const eq = pair.indexOf("=");
        if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
      }
      // fallback single set-cookie
      const single = res.headers.get("set-cookie");
      if (single && raw.length === 0) {
        for (const part of single.split(/,(?=\s*[^;]+=)/)) {
          const [pair] = part.trim().split(";");
          const eq = pair.indexOf("=");
          if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
        }
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function startAudit(cookies) {
  const res = await fetch(`${BASE}/api/audit/start`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookies.header(),
    },
    body: JSON.stringify({ pathway: "post_surgery" }),
  });
  cookies.store(res);
  const json = await res.json();
  return { status: res.status, json, setCookie: res.headers.getSetCookie?.() ?? [] };
}

async function claim(cookies, caseId, email, firstName = "Smoke") {
  const res = await fetch(`${BASE}/api/audit/claim-account`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookies.header(),
    },
    body: JSON.stringify({ caseId, email, firstName }),
  });
  cookies.store(res);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function submit(cookies, caseId) {
  const res = await fetch(`${BASE}/api/submit`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookies.header(),
    },
    body: JSON.stringify({ caseId }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function seedMinimalPhotos(caseId, userId) {
  // Insert minimal upload rows so submit photo gate may pass depending on policy.
  // Prefer copying categories from a known draft if available; else create stub rows.
  const categories = [
    "patient_photo:front",
    "patient_photo:left",
    "patient_photo:right",
    "patient_photo:top",
    "patient_photo:donor",
    "patient_photo:immediate_postop",
  ];
  for (const type of categories) {
    const { error } = await admin.from("uploads").insert({
      case_id: caseId,
      type,
      storage_path: `smoke/${caseId}/${type.replace(":", "_")}.jpg`,
      user_id: userId,
    });
    if (error) {
      // column names may differ — try alternate shapes
      const alt = await admin.from("uploads").insert({
        case_id: caseId,
        type,
        path: `smoke/${caseId}/${type.replace(":", "_")}.jpg`,
      });
      if (alt.error) console.warn("upload seed warn", type, error.message, alt.error.message);
    }
  }
}

async function verifyUser(userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw error;
  return data.user;
}

async function verifyProfile(userId) {
  const { data, error } = await admin.from("profiles").select("id,email,name,role,created_at,updated_at").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function verifyCase(caseId) {
  const { data, error } = await admin
    .from("cases")
    .select("id,user_id,patient_id,patient_email,status,created_at,updated_at")
    .eq("id", caseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function cleanupSmoke(userId, caseId, label) {
  console.log(`[cleanup] ${label} case=${caseId} user=${userId}`);
  // Delete case-related rows then user — only smoke-tagged emails
  await admin.from("uploads").delete().eq("case_id", caseId);
  await admin.from("audit_photos").delete().eq("case_id", caseId);
  await admin.from("cases").delete().eq("id", caseId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.warn("deleteUser", error.message);
}

const mode = process.argv[2] || "all";

async function freshEmailPath() {
  console.log("\n=== FRESH EMAIL PATH ===");
  const cookies = cookieJar();
  const started = await startAudit(cookies);
  console.log("start", started.status, started.json);
  if (!started.json?.ok || !started.json.caseId) throw new Error("start failed");
  const caseId = started.json.caseId;

  // Resolve session user via admin listing recent anon with this case
  const caseRow = await verifyCase(caseId);
  const userId = caseRow.user_id;
  console.log("uid", userId, "case", caseId);

  await seedMinimalPhotos(caseId, userId);

  // Optional: insert minimal report/answers if submit requires questionnaire
  const email = `smoke-fresh-${Date.now()}@hairaudit.test`;
  const claimed = await claim(cookies, caseId, email, "SmokeFresh");
  console.log("claim", claimed.status, claimed.json);
  if (claimed.status !== 200 || !claimed.json?.ok) throw new Error("fresh claim failed");

  const user = await verifyUser(userId);
  const profile = await verifyProfile(userId);
  const afterClaimCase = await verifyCase(caseId);
  console.log("auth.users", {
    id: user.id,
    email: user.email,
    is_anonymous: user.is_anonymous,
    role: user.user_metadata?.role,
  });
  console.log("profiles", profile);
  console.log("cases", afterClaimCase);

  const submitted = await submit(cookies, caseId);
  console.log("submit", submitted.status, submitted.json);
  const afterSubmit = await verifyCase(caseId);
  console.log("case after submit", afterSubmit);

  const ok =
    user.id === userId &&
    user.email?.toLowerCase() === email &&
    profile?.email?.toLowerCase() === email &&
    profile?.role === "patient" &&
    afterClaimCase.user_id === userId &&
    afterClaimCase.patient_id === userId &&
    (afterSubmit.status === "processing" ||
      afterSubmit.status === "submitted" ||
      afterSubmit.status === "queued" ||
      submitted.status === 200);

  console.log("FRESH_OK", ok, {
    sameUid: user.id === userId,
    emailPopulated: Boolean(user.email),
    isAnonymous: user.is_anonymous,
    profileRole: profile?.role,
    caseStatus: afterSubmit.status,
    submitStatus: submitted.status,
    correlationId: claimed.json.correlationId,
  });

  return { ok, userId, caseId, email, claimed, submitted, user, profile, afterSubmit };
}

async function existingEmailPath() {
  console.log("\n=== EXISTING EMAIL PATH ===");
  // Find an existing registered email (non-smoke)
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  const existing = (listed.data.users || []).find(
    (u) => u.email && !u.email.includes("hairaudit.test") && !u.is_anonymous && u.email.includes("@")
  );
  if (!existing?.email) throw new Error("no existing email found for conflict test");
  console.log("conflict target email hash", existing.email.replace(/(.{2}).+(@.+)/, "$1***$2"), "uid", existing.id);

  const cookies = cookieJar();
  const started = await startAudit(cookies);
  if (!started.json?.ok) throw new Error("start failed");
  const caseId = started.json.caseId;
  const caseRow = await verifyCase(caseId);
  const userId = caseRow.user_id;

  // seed a couple uploads to prove preservation
  await seedMinimalPhotos(caseId, userId);
  const photosBefore = await admin.from("uploads").select("id").eq("case_id", caseId);
  const photoCountBefore = (photosBefore.data || []).length;

  const claimed = await claim(cookies, caseId, existing.email, "SmokeDup");
  console.log("claim", claimed.status, claimed.json);

  const userAfter = await verifyUser(userId);
  const caseAfter = await verifyCase(caseId);
  const photosAfter = await admin.from("uploads").select("id").eq("case_id", caseId);
  const photoCountAfter = (photosAfter.data || []).length;

  const ok =
    claimed.status === 409 &&
    claimed.json?.code === "email_exists" &&
    /sign in/i.test(String(claimed.json?.error || "")) &&
    claimed.status !== 500 &&
    claimed.json?.code !== "unexpected_failure" &&
    userAfter.is_anonymous === true &&
    !userAfter.email &&
    photoCountAfter === photoCountBefore &&
    caseAfter.status === "draft" &&
    caseAfter.user_id === userId;

  console.log("EXISTING_OK", ok, {
    status: claimed.status,
    code: claimed.json?.code,
    error: claimed.json?.error,
    correlationId: claimed.json?.correlationId,
    stillAnonymous: userAfter.is_anonymous,
    emailStillEmpty: !userAfter.email,
    photosPreserved: photoCountAfter === photoCountBefore,
    caseStatus: caseAfter.status,
  });

  return { ok, userId, caseId, claimed, photoCountBefore, photoCountAfter };
}

const results = {};
try {
  if (mode === "fresh" || mode === "all") {
    results.fresh = await freshEmailPath();
  }
  if (mode === "existing" || mode === "all") {
    results.existing = await existingEmailPath();
  }
} catch (e) {
  console.error("SMOKE_FATAL", e);
  process.exitCode = 1;
}

// Cleanup smoke data (never touch incident uid)
const INCIDENT = "d7698f54-5e0e-4ce4-9355-3910ece3ede1";
if (results.fresh && process.env.SMOKE_KEEP !== "1") {
  if (results.fresh.userId !== INCIDENT) {
    await cleanupSmoke(results.fresh.userId, results.fresh.caseId, "fresh");
  }
}
if (results.existing && process.env.SMOKE_KEEP !== "1") {
  if (results.existing.userId !== INCIDENT) {
    await cleanupSmoke(results.existing.userId, results.existing.caseId, "existing");
  }
}

console.log("\n=== SUMMARY ===");
console.log(
  JSON.stringify(
    {
      base: BASE,
      freshOk: results.fresh?.ok ?? null,
      existingOk: results.existing?.ok ?? null,
      freshCorrelationId: results.fresh?.claimed?.json?.correlationId,
      existingCorrelationId: results.existing?.claimed?.json?.correlationId,
    },
    null,
    2
  )
);

if (results.fresh && !results.fresh.ok) process.exitCode = 1;
if (results.existing && !results.existing.ok) process.exitCode = 1;
