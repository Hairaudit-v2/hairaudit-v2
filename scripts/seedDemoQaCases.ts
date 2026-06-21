/**
 * Development-only seed for 20 dual-pathway demo QA patient cases.
 *
 * Creates 10 pre_surgery + 10 post_surgery cases with:
 * - anonymous patient users (presurgery-demo-NN / postsurgery-demo-NN @hairaudit.test)
 * - required pathway uploads, recommended samples, minimal intake
 * - submitted_at history, complete status, intelligence bundle, pathway report, PDF
 *
 * Usage:
 *   npm run seed:demo-qa
 *   npm run seed:demo-qa -- --cleanup
 *   npm run seed:demo-qa -- --dry-run
 *
 * Requires (non-production):
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 *
 * Windows TLS / antivirus SSL inspection:
 *   If you see UNABLE_TO_VERIFY_LEAF_SIGNATURE, run:
 *   PowerShell: $env:DEMO_SEED_INSECURE_TLS='true'; npm run seed:demo-qa
 *
 * Production guard: blocked unless DEMO_SEED_ENABLED=true
 *
 * Idempotent: re-run updates cases keyed by external_case_id (demo-qa:presurgery:01 …).
 */

import * as fs from "fs";
import * as path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAuditCaseInsertData } from "../src/lib/cases/createCase";
import {
  assertDemoSeedAllowed,
  DEMO_QA_SEED_BATCH_PREFIX,
  DEMO_QA_SEED_USER_PASSWORD,
  demoQaDisplayName,
  demoQaExternalCaseId,
  demoQaUserEmail,
} from "../src/lib/demo/qaCaseSeed/constants";
import { buildDemoQaReportSummary, buildDemoQaUploadTypes } from "../src/lib/demo/qaCaseSeed/buildReportSummary";
import { DEMO_QA_ALL_SCENARIOS } from "../src/lib/demo/qaCaseSeed/scenarios";
import type { DemoQaScenario } from "../src/lib/demo/qaCaseSeed/types";
import { tryCreateSupabaseAdminClient } from "../src/lib/supabase/admin";
import {
  applyDemoSeedInsecureTlsIfRequested,
  assertDemoSeedSupabaseReachable,
  createDemoSeedSupabaseClient,
  formatDemoSeedTlsHelp,
} from "./lib/demoQaSupabase";
import { applyPatientPhotoCategoryFields } from "../src/lib/uploads/patientPhotoCategoryIntegrity";
import { getDefaultImageBuffer } from "../tests/audit-harness/helpers/imageBuffer";
import { createDemoQaPdfBuffer } from "./lib/demoQaPdf";

const BUCKET = process.env.CASE_FILES_BUCKET || "case-files";

function loadEnvLocal() {
  const root = path.resolve(__dirname, "..");
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const val = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1).replace(/\\"/g, '"') : raw;
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs(): { cleanup: boolean; dryRun: boolean } {
  const args = process.argv.slice(2);
  return {
    cleanup: args.includes("--cleanup"),
    dryRun: args.includes("--dry-run"),
  };
}

let demoUserIdByEmailCache: Map<string, string> | null = null;

async function loadDemoUserIdCache(supabase: SupabaseClient): Promise<Map<string, string>> {
  if (demoUserIdByEmailCache) return demoUserIdByEmailCache;

  const map = new Map<string, string>();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    for (const user of data.users) {
      if (user.email) map.set(user.email.toLowerCase(), user.id);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  demoUserIdByEmailCache = map;
  return map;
}

async function resolveDemoUserIdByEmail(supabase: SupabaseClient, email: string): Promise<string | null> {
  const map = await loadDemoUserIdCache(supabase);
  return map.get(email.toLowerCase()) ?? null;
}

async function upsertDemoProfile(
  supabase: SupabaseClient,
  userId: string,
  scenario: DemoQaScenario
): Promise<void> {
  await supabase.from("profiles").upsert({
    id: userId,
    role: "patient",
    display_name: demoQaDisplayName(scenario.pathway, scenario.index, scenario.title),
  });
}

async function ensureDemoUser(
  supabase: SupabaseClient,
  scenario: DemoQaScenario
): Promise<{ userId: string; email: string; created: boolean }> {
  const email = demoQaUserEmail(scenario.pathway, scenario.index);
  const externalCaseId = demoQaExternalCaseId(scenario.pathway, scenario.index);

  const existingCase = await findCaseByExternalId(supabase, externalCaseId);
  if (existingCase?.user_id) {
    await upsertDemoProfile(supabase, existingCase.user_id, scenario);
    return { userId: existingCase.user_id, email, created: false };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_QA_SEED_USER_PASSWORD,
    email_confirm: true,
    user_metadata: {
      role: "patient",
      is_test: true,
      demo_qa_seed: true,
      demo_qa_scenario: scenario.id,
    },
  });

  if (!error && data.user?.id) {
    await upsertDemoProfile(supabase, data.user.id, scenario);
    return { userId: data.user.id, email, created: true };
  }

  const duplicate =
    error?.message?.toLowerCase().includes("already") ||
    error?.message?.toLowerCase().includes("registered") ||
    error?.status === 422;

  if (duplicate) {
    const userId = await resolveDemoUserIdByEmail(supabase, email);
    if (!userId) {
      throw new Error(`Demo user ${email} exists but could not be resolved.`);
    }
    await upsertDemoProfile(supabase, userId, scenario);
    return { userId, email, created: false };
  }

  throw new Error(`Failed to create demo user ${email}: ${error?.message ?? "unknown"}`);
}

async function findCaseByExternalId(supabase: SupabaseClient, externalCaseId: string) {
  const { data, error } = await supabase
    .from("cases")
    .select("id, user_id")
    .eq("external_case_id", externalCaseId)
    .maybeSingle();
  if (error) throw new Error(`Case lookup failed: ${error.message}`);
  return data as { id: string; user_id: string } | null;
}

async function deleteCaseArtifacts(supabase: SupabaseClient, caseId: string) {
  await supabase.from("uploads").delete().eq("case_id", caseId);
  await supabase.from("reports").delete().eq("case_id", caseId);
  await supabase.from("audit_photos").delete().eq("case_id", caseId);

  const prefixes = [`cases/${caseId}`, `${caseId}`];
  for (const prefix of prefixes) {
    const { data: files } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (files?.length) {
      await supabase.storage.from(BUCKET).remove(files.map((f) => `${prefix}/${f.name}`));
    }
  }
}

async function uploadDemoPhoto(
  supabase: SupabaseClient,
  args: {
    caseId: string;
    userId: string;
    categoryKey: string;
    buffer: Buffer;
  }
) {
  const { caseId, userId, categoryKey, buffer } = args;
  const storagePath = `cases/${caseId}/patient/${categoryKey}/${Date.now()}-demo-qa.jpg`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (upErr) throw new Error(`Storage upload failed for ${categoryKey}: ${upErr.message}`);

  const { type, metadata } = applyPatientPhotoCategoryFields(categoryKey, {
    original_name: "demo-qa.jpg",
    mime: "image/jpeg",
    size: buffer.length,
    demo_qa_seed: true,
  });

  const { error: insErr } = await supabase.from("uploads").insert({
    case_id: caseId,
    user_id: userId,
    type,
    storage_path: storagePath,
    metadata,
  });
  if (insErr) throw new Error(`Upload insert failed for ${categoryKey}: ${insErr.message}`);
}

async function seedScenario(
  supabase: SupabaseClient,
  scenario: DemoQaScenario,
  imageBuffer: Buffer
): Promise<{ caseId: string; email: string; action: "created" | "updated" }> {
  const externalCaseId = demoQaExternalCaseId(scenario.pathway, scenario.index);
  const email = demoQaUserEmail(scenario.pathway, scenario.index);

  const { userId } = await ensureDemoUser(supabase, scenario);
  const existing = await findCaseByExternalId(supabase, externalCaseId);
  let caseId: string;
  let action: "created" | "updated";

  const submittedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const caseInsert = {
    ...buildAuditCaseInsertData(userId, "patient", scenario.pathway),
    user_id: userId,
    patient_id: userId,
    title: scenario.pathway === "pre_surgery" ? `Pre-Surgery Review — ${scenario.title}` : `Patient Audit — ${scenario.title}`,
    status: "complete",
    submitted_at: submittedAt,
    is_test: true,
    external_case_id: externalCaseId,
  };

  if (existing?.id) {
    caseId = existing.id;
    action = "updated";
    await deleteCaseArtifacts(supabase, caseId);
    const { error: updErr } = await supabase.from("cases").update(caseInsert).eq("id", caseId);
    if (updErr) throw new Error(`Case update failed: ${updErr.message}`);
  } else {
    const { data, error } = await supabase.from("cases").insert(caseInsert).select("id").single();
    if (error || !data?.id) throw new Error(`Case insert failed: ${error?.message ?? "no id"}`);
    caseId = data.id as string;
    action = "created";
  }

  const uploadKeys = buildDemoQaUploadTypes(scenario).map((t) => t.replace("patient_photo:", ""));
  for (const key of uploadKeys) {
    await uploadDemoPhoto(supabase, { caseId, userId, categoryKey: key, buffer: imageBuffer });
  }

  const summary = buildDemoQaReportSummary({ scenario, caseId });
  const pdfBuffer = await createDemoQaPdfBuffer(`${scenario.title} (${scenario.pathway})`);
  const pdfPath = `${caseId}/v1.pdf`;
  const { error: pdfErr } = await supabase.storage.from(BUCKET).upload(pdfPath, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (pdfErr) throw new Error(`PDF upload failed: ${pdfErr.message}`);

  const { error: reportErr } = await supabase.from("reports").insert({
    case_id: caseId,
    version: 1,
    summary,
    pdf_path: pdfPath,
    status: "complete",
    patient_audit_version: 2,
    patient_audit_v2: scenario.intakeAnswers,
  });
  if (reportErr) throw new Error(`Report insert failed: ${reportErr.message}`);

  return { caseId, email, action };
}

async function cleanupDemoQaCases(supabase: SupabaseClient): Promise<number> {
  const { data: cases, error } = await supabase
    .from("cases")
    .select("id, external_case_id, user_id")
    .like("external_case_id", `${DEMO_QA_SEED_BATCH_PREFIX}:%`);

  if (error) throw new Error(`Cleanup list failed: ${error.message}`);
  const rows = cases ?? [];
  const userIds = new Set(rows.map((row) => String(row.user_id ?? "")).filter(Boolean));

  for (const row of rows) {
    await deleteCaseArtifacts(supabase, row.id as string);
    await supabase.from("cases").delete().eq("id", row.id);
  }

  for (const userId of userIds) {
    await supabase.auth.admin.deleteUser(userId);
  }

  return rows.length;
}

async function main() {
  loadEnvLocal();
  applyDemoSeedInsecureTlsIfRequested();
  assertDemoSeedAllowed();

  const { cleanup, dryRun } = parseArgs();

  if (dryRun) {
    console.log("Dry run — no database changes.\n");
    for (const scenario of DEMO_QA_ALL_SCENARIOS) {
      const email = demoQaUserEmail(scenario.pathway, scenario.index);
      const externalCaseId = demoQaExternalCaseId(scenario.pathway, scenario.index);
      console.log(`○ ${scenario.id} → ${email} (${externalCaseId}) [${scenario.pathway}]`);
    }
    console.log(`\nWould seed ${DEMO_QA_ALL_SCENARIOS.length} cases (10 pre-surgery, 10 post-surgery).`);
    return;
  }

  const supabase = createDemoSeedSupabaseClient();
  if (!supabase) {
    console.error("Missing Supabase env (URL + SUPABASE_SERVICE_ROLE_KEY).");
    process.exit(1);
  }

  try {
    await assertDemoSeedSupabaseReachable(supabase);
  } catch (err) {
    const message = String((err as Error).message ?? err);
    if (
      message.includes("TLS certificate verification failed") ||
      message.toLowerCase().includes("fetch failed") ||
      message.includes("unable to verify the first certificate")
    ) {
      console.error(message.includes("Fix options") ? message : formatDemoSeedTlsHelp());
    } else {
      console.error(message);
    }
    process.exit(1);
  }

  if (cleanup) {
    const removed = await cleanupDemoQaCases(supabase);
    console.log(`Removed ${removed} demo QA case(s) and associated demo users.`);
    return;
  }

  const imageBuffer = await getDefaultImageBuffer();
  const results: Array<{ scenario: string; caseId: string; email: string; action: string }> = [];

  for (const scenario of DEMO_QA_ALL_SCENARIOS) {
    const result = await seedScenario(supabase, scenario, imageBuffer);
    results.push({
      scenario: scenario.id,
      caseId: result.caseId,
      email: result.email,
      action: result.action,
    });
    console.log(`${result.action === "skipped" ? "○" : "✓"} ${scenario.id} → ${result.email} (${result.caseId})`);
  }

  console.log(`\nDemo QA seed complete.`);
  console.log(`  Cases: ${results.length}`);
  console.log(`  Pre-surgery: ${DEMO_QA_ALL_SCENARIOS.filter((s) => s.pathway === "pre_surgery").length}`);
  console.log(`  Post-surgery: ${DEMO_QA_ALL_SCENARIOS.filter((s) => s.pathway === "post_surgery").length}`);
  console.log(`  Login password (all demo users): ${DEMO_QA_SEED_USER_PASSWORD}`);
  console.log("\nQA routes:");
  console.log("  Pre:  / → Pre-Surgery Review → /cases/[id]/patient/photos → questions → contact → waiting → report");
  console.log("  Post: / → Post-Surgery Audit   → same funnel");
  console.log("\nRe-run safely — cases are upserted by external_case_id.");
}

main().catch((err) => {
  const message = String((err as Error).message ?? err);
  if (
    message.toLowerCase().includes("fetch failed") ||
    message.includes("unable to verify the first certificate") ||
    message.includes("UNABLE_TO_VERIFY")
  ) {
    console.error(formatDemoSeedTlsHelp());
  } else {
    console.error("Demo QA seed failed:", message);
  }
  process.exit(1);
});
