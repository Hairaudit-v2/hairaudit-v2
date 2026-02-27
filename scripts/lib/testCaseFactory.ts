/* eslint-disable no-console */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as crypto from "node:crypto";

export type TestPatientIdentity = {
  userId: string;
  email: string;
};

export type TestCaseRecord = {
  caseId: string;
  createdAt: string | null;
};

export type CreateTestPatientAndCaseResult = {
  patient: TestPatientIdentity;
  case: TestCaseRecord;
};

function rand(nBytes = 10): string {
  return crypto.randomBytes(nBytes).toString("hex");
}

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

export function createSupabaseServiceClient(): SupabaseClient {
  const url = env("NEXT_PUBLIC_SUPABASE_URL") ?? env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "Missing env. Required for scripts: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function ensureCasesIsTestColumnOrThrow(supabase: SupabaseClient): Promise<void> {
  // Fast, reliable: attempt to select the column; if it doesn't exist, PostgREST returns an error.
  const { error } = await supabase.from("cases").select("is_test").limit(1);
  if (!error) return;

  const msg = String((error as any)?.message ?? error);
  if (msg.toLowerCase().includes("is_test") && msg.toLowerCase().includes("does not exist")) {
    throw new Error(
      `cases.is_test column is missing.\n` +
        `Apply migration: supabase/migrations/20260227000003_cases_is_test.sql (via \`supabase db push\` or SQL editor).`
    );
  }

  // Unexpected error (permissions, RLS, etc.)
  throw new Error(`Unable to verify cases.is_test column: ${msg}`);
}

export async function createTestPatientIdentity(
  supabase: SupabaseClient
): Promise<TestPatientIdentity> {
  const email = `test+${rand(8)}@hairaudit.dev`;
  const password = `Test-${rand(12)}!`;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "patient", is_test: true },
  } as any);

  if (error || !data?.user?.id) {
    throw new Error(`Failed to create test user: ${error?.message ?? "unknown error"}`);
  }

  const userId = data.user.id;

  // Best-effort profile row (role is used by the app); ignore if profiles table isn't present yet.
  try {
    await supabase.from("profiles").upsert({
      id: userId,
      role: "patient",
      display_name: `Test Patient ${email}`,
    } as any);
  } catch {
    // ignore
  }

  return { userId, email };
}

export async function createTestCaseRecord(
  supabase: SupabaseClient,
  userId: string
): Promise<TestCaseRecord> {
  await ensureCasesIsTestColumnOrThrow(supabase);

  const { data, error } = await supabase
    .from("cases")
    .insert({
      user_id: userId,
      patient_id: userId,
      title: "Patient Audit",
      status: "draft",
      is_test: true,
    } as any)
    .select("id, created_at")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create test case: ${error?.message ?? "unknown error"}`);
  }

  return { caseId: String((data as any).id), createdAt: ((data as any).created_at as string) ?? null };
}

export async function createTestPatientAndCase(
  supabase: SupabaseClient
): Promise<CreateTestPatientAndCaseResult> {
  const patient = await createTestPatientIdentity(supabase);
  const c = await createTestCaseRecord(supabase, patient.userId);
  return { patient, case: c };
}

async function tableExistsProbe(supabase: SupabaseClient, table: string): Promise<boolean> {
  const { error } = await supabase.from(table as any).select("*").limit(1);
  if (!error) return true;
  const msg = String((error as any)?.message ?? error).toLowerCase();
  // PostgREST "Could not find the table" style errors vary by config; treat those as "missing".
  if (msg.includes("could not find") || msg.includes("not found") || msg.includes("does not exist")) return false;
  // If it's RLS/permission/etc, table does exist but we don't care (service role should not hit this).
  return true;
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function deleteStoragePrefixes(supabase: SupabaseClient, prefixes: string[]) {
  const bucket = env("CASE_FILES_BUCKET") ?? "case-files";

  // Supabase Storage list() is not recursive; we do a simple breadth-first traversal.
  const queue = [...prefixes];
  const toRemove: string[] = [];

  while (queue.length) {
    const prefix = queue.shift()!;
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) continue;
    for (const item of data ?? []) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if ((item as any).id && (item as any).metadata) {
        // file
        toRemove.push(full);
      } else if ((item as any).name) {
        // folder-ish: storage returns "name" entries; treat as subdir when no metadata
        if (!(item as any).metadata) queue.push(full);
      }
    }
  }

  for (const part of chunk(toRemove, 100)) {
    await supabase.storage.from(bucket).remove(part);
  }
}

export async function cleanupTestCases(supabase: SupabaseClient): Promise<{ deletedCases: number; deletedUsers: number }> {
  await ensureCasesIsTestColumnOrThrow(supabase);

  const { data: cases, error } = await supabase
    .from("cases")
    .select("id, user_id")
    .eq("is_test", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list test cases: ${error.message}`);
  const ids = (cases ?? []).map((c: any) => String(c.id));
  const userIds = Array.from(new Set((cases ?? []).map((c: any) => String(c.user_id)).filter(Boolean)));

  if (ids.length === 0) return { deletedCases: 0, deletedUsers: 0 };

  // Best-effort cleanup of related tables (most have ON DELETE CASCADE, but keep this robust)
  const maybeDeleteByCase = async (table: string) => {
    if (!(await tableExistsProbe(supabase, table))) return;
    for (const part of chunk(ids, 100)) {
      await supabase.from(table as any).delete().in("case_id" as any, part as any);
    }
  };

  await maybeDeleteByCase("uploads");
  await maybeDeleteByCase("reports");
  await maybeDeleteByCase("audit_photos");
  await maybeDeleteByCase("graft_integrity_estimates");

  // Storage (best-effort)
  try {
    await deleteStoragePrefixes(
      supabase,
      ids.flatMap((caseId) => [
        `cases/${caseId}`,
        `${caseId}`, // pdfs saved as `${caseId}/vN.pdf` in your Inngest flow
        `audit_photos/${caseId}`,
      ])
    );
  } catch {
    // ignore
  }

  // Delete cases
  for (const part of chunk(ids, 100)) {
    const { error: delErr } = await supabase.from("cases").delete().in("id" as any, part as any);
    if (delErr) throw new Error(`Failed to delete cases: ${delErr.message}`);
  }

  // Delete auth users created by these cases (best-effort).
  let deletedUsers = 0;
  for (const uid of userIds) {
    try {
      const { error: uErr } = await supabase.auth.admin.deleteUser(uid);
      if (!uErr) deletedUsers++;
    } catch {
      // ignore
    }
  }

  return { deletedCases: ids.length, deletedUsers };
}

