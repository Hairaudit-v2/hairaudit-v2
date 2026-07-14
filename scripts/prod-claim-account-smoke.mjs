/**
 * Production claim-account smoke (HA-PROD-CLAIM-ACCOUNT-INCIDENT-1A).
 * Env from .env.local: NEXT_PUBLIC_SUPABASE_*, SUPABASE_SERVICE_ROLE_KEY
 * Optional: SMOKE_BASE_URL (default https://www.hairaudit.com), SMOKE_KEEP=1
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!l || l.startsWith("#") || !l.includes("=")) continue;
    const i = l.indexOf("=");
    const k = l.slice(0, i);
    const v = l.slice(i + 1);
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const BASE = (process.env.SMOKE_BASE_URL || "https://www.hairaudit.com").replace(/\/+$/, "");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INCIDENT_UID = "d7698f54-5e0e-4ce4-9355-3910ece3ede1";

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

const POST_SURGERY_KEYS = [
  "preop_front",
  "current_recipient_closeup",
  "preop_top",
  "preop_donor_rear",
  "preop_donor_closeup",
];

class CookieJar {
  constructor() {
    this.map = new Map();
  }
  absorb(res) {
    const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    const list = raw.length ? raw : [];
    const single = res.headers.get("set-cookie");
    if (!list.length && single) list.push(...single.split(/,(?=[^;]+?=)/));
    for (const c of list) {
      const pair = String(c).split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) this.map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  header() {
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function api(jar, method, pathname, body) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(jar.header() ? { cookie: jar.header() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  jar.absorb(res);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function seedPhotos(caseId, userId) {
  for (const key of POST_SURGERY_KEYS) {
    const type = `patient_photo:${key}`;
    const { error } = await admin.from("uploads").insert({
      case_id: caseId,
      user_id: userId,
      type,
      storage_path: `case/${caseId}/smoke/${key}.jpg`,
      metadata: { category: key, smoke: true, source: "HA-PROD-CLAIM-ACCOUNT-INCIDENT-1A" },
    });
    if (error) throw new Error(`upload seed ${key}: ${error.message}`);
  }
}

async function cleanup(userId, caseId, label) {
  if (!userId || userId === INCIDENT_UID) {
    console.log(`[cleanup] skip protected ${label}`);
    return;
  }
  console.log(`[cleanup] ${label} user=${userId} case=${caseId}`);
  await admin.from("uploads").delete().eq("case_id", caseId);
  await admin.from("audit_photos").delete().eq("case_id", caseId);
  await admin.from("reports").delete().eq("case_id", caseId);
  await admin.from("cases").delete().eq("id", caseId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.warn("deleteUser", error.message);
}

async function freshPath() {
  console.log("\n=== FRESH EMAIL PATH ===");
  const jar = new CookieJar();
  const started = await api(jar, "POST", "/api/audit/start", { pathway: "post_surgery" });
  console.log("start", started.status, started.json);
  if (!started.json?.ok) throw new Error("start failed");
  const caseId = started.json.caseId;
  const { data: caseRow } = await admin.from("cases").select("id,user_id,patient_id,status").eq("id", caseId).single();
  const userId = caseRow.user_id;
  console.log("uid", userId);

  // photos → questions (no-op API) → contact claim
  await seedPhotos(caseId, userId);
  // minimal questionnaire row (optional for photo gate; helps realism)
  await admin.from("reports").insert({
    case_id: caseId,
    status: "draft",
    patient_audit_v2: { answers: { clinic_name: "Smoke Clinic", clinic_country: "AU", procedure_type: "FUE" } },
  }).then(() => {}).catch(() => {});

  const email = `smoke-fresh-${Date.now()}@hairaudit.test`;
  const claimed = await api(jar, "POST", "/api/audit/claim-account", {
    caseId,
    email,
    firstName: "SmokeFresh",
  });
  console.log("claim", claimed.status, claimed.json);
  if (claimed.status !== 200 || !claimed.json?.ok) throw new Error(`fresh claim failed: ${JSON.stringify(claimed.json)}`);

  const { data: userWrap } = await admin.auth.admin.getUserById(userId);
  const user = userWrap.user;
  const { data: profile } = await admin.from("profiles").select("id,email,name,role,created_at,updated_at").eq("id", userId).maybeSingle();
  const { data: caseAfter } = await admin
    .from("cases")
    .select("id,user_id,patient_id,patient_email,status,created_at,updated_at")
    .eq("id", caseId)
    .single();

  console.log("VERIFY auth.users", {
    id: user.id,
    email: user.email,
    is_anonymous: user.is_anonymous,
    role: user.user_metadata?.role,
  });
  console.log("VERIFY profiles", profile);
  console.log("VERIFY cases", caseAfter);

  const submitted = await api(jar, "POST", "/api/submit", { caseId });
  console.log("submit", submitted.status, submitted.json);
  const { data: caseSubmitted } = await admin.from("cases").select("id,status,user_id,patient_id,patient_email").eq("id", caseId).single();
  console.log("case after submit", caseSubmitted);

  const processingOk =
    caseSubmitted.status === "processing" ||
    caseSubmitted.status === "submitted" ||
    caseSubmitted.status === "queued" ||
    (submitted.status === 200 && submitted.json && !submitted.json.error);

  const ok =
    user.id === userId &&
    (user.email || "").toLowerCase() === email &&
    (profile?.email || "").toLowerCase() === email &&
    profile?.role === "patient" &&
    user.is_anonymous === false &&
    caseAfter.user_id === userId &&
    caseAfter.patient_id === userId &&
    Boolean(claimed.json.correlationId) &&
    processingOk;

  console.log("FRESH_OK", ok, {
    sameUid: user.id === userId,
    emailPopulated: Boolean(user.email),
    is_anonymous: user.is_anonymous,
    profileRole: profile?.role,
    caseStatus: caseSubmitted.status,
    correlationId: claimed.json.correlationId,
  });

  return { ok, userId, caseId, email, user, profile, caseSubmitted, claimed, submitted };
}

async function existingPath() {
  console.log("\n=== EXISTING EMAIL PATH ===");
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  const existing = (listed.data.users || []).find(
    (u) => u.email && !u.email.includes("hairaudit.test") && !u.is_anonymous && u.email.includes("@")
  );
  if (!existing?.email) throw new Error("no existing registered email");

  const jar = new CookieJar();
  const started = await api(jar, "POST", "/api/audit/start", { pathway: "post_surgery" });
  if (!started.json?.ok) throw new Error("start failed");
  const caseId = started.json.caseId;
  const { data: caseRow } = await admin.from("cases").select("id,user_id,status").eq("id", caseId).single();
  const userId = caseRow.user_id;
  await seedPhotos(caseId, userId);
  const { count: beforeCount } = await admin
    .from("uploads")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId);

  const claimed = await api(jar, "POST", "/api/audit/claim-account", {
    caseId,
    email: existing.email,
    firstName: "SmokeDup",
  });
  console.log("claim", claimed.status, claimed.json);

  const { data: userWrap } = await admin.auth.admin.getUserById(userId);
  const user = userWrap.user;
  const { data: caseAfter } = await admin.from("cases").select("id,user_id,status,patient_email").eq("id", caseId).single();
  const { count: afterCount } = await admin
    .from("uploads")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId);

  const ok =
    claimed.status === 409 &&
    claimed.json?.code === "email_exists" &&
    /sign in/i.test(String(claimed.json?.error || "")) &&
    claimed.json?.code !== "unexpected_failure" &&
    user.is_anonymous === true &&
    !(user.email || "").trim() &&
    beforeCount === afterCount &&
    caseAfter.status === "draft" &&
    caseAfter.user_id === userId &&
    Boolean(claimed.json?.correlationId);

  console.log("EXISTING_OK", ok, {
    status: claimed.status,
    code: claimed.json?.code,
    error: claimed.json?.error,
    correlationId: claimed.json?.correlationId,
    stillAnonymous: user.is_anonymous,
    photosPreserved: beforeCount === afterCount,
    caseStatus: caseAfter.status,
  });

  return { ok, userId, caseId, claimed, beforeCount, afterCount };
}

async function strandedInventory() {
  console.log("\n=== STRANDED INVENTORY ===");
  const { data: cases, error } = await admin
    .from("cases")
    .select("id,user_id,status,created_at,updated_at,patient_email")
    .eq("audit_type", "patient")
    .gte("created_at", "2026-06-01")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const rows = [];
  for (const c of cases || []) {
    if (c.patient_email && String(c.patient_email).trim()) continue;
    const { data: uwrap } = await admin.auth.admin.getUserById(c.user_id);
    const u = uwrap?.user;
    if (!u?.is_anonymous) continue;
    const { count } = await admin.from("uploads").select("id", { count: "exact", head: true }).eq("case_id", c.id);
    const { count: photoCount } = await admin
      .from("audit_photos")
      .select("id", { count: "exact", head: true })
      .eq("case_id", c.id);
    rows.push({
      case_id: c.id,
      user_id: c.user_id,
      status: c.status,
      created_at: c.created_at,
      updated_at: c.updated_at,
      upload_count: count ?? 0,
      audit_photo_count: photoCount ?? 0,
      is_anonymous: true,
      priority: (count ?? 0) >= 5 || (photoCount ?? 0) >= 5 ? "high" : (count ?? 0) > 0 ? "medium" : "low",
    });
  }
  console.log("stranded_count", rows.length);
  console.log(JSON.stringify(rows, null, 2));
  return rows;
}

const mode = process.argv[2] || "all";
const out = {};
try {
  if (mode === "fresh" || mode === "all") out.fresh = await freshPath();
  if (mode === "existing" || mode === "all") out.existing = await existingPath();
  if (mode === "inventory" || mode === "all") out.inventory = await strandedInventory();
} catch (e) {
  console.error("SMOKE_FATAL", e);
  process.exitCode = 1;
}

if (process.env.SMOKE_KEEP !== "1") {
  if (out.fresh) await cleanup(out.fresh.userId, out.fresh.caseId, "fresh");
  if (out.existing) await cleanup(out.existing.userId, out.existing.caseId, "existing");
}

console.log("\n=== SUMMARY ===");
console.log(
  JSON.stringify(
    {
      base: BASE,
      freshOk: out.fresh?.ok ?? null,
      existingOk: out.existing?.ok ?? null,
      strandedCount: out.inventory?.length ?? null,
      freshCorrelationId: out.fresh?.claimed?.json?.correlationId ?? null,
      existingCorrelationId: out.existing?.claimed?.json?.correlationId ?? null,
      freshIsAnonymousAfterClaim: out.fresh?.user?.is_anonymous ?? null,
      freshCaseStatus: out.fresh?.caseSubmitted?.status ?? null,
    },
    null,
    2
  )
);

if (out.fresh && !out.fresh.ok) process.exitCode = 1;
if (out.existing && !out.existing.ok) process.exitCode = 1;
