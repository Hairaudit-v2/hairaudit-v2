/**
 * FI-OUTCOME-INTELLIGENCE-1F — Safe cleanup for FI-OI-1F-* fixture namespace only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertLongitudinalE2eFixturesAllowed,
  isLongitudinalE2eExternalCaseId,
  LONGITUDINAL_E2E_EXTERNAL_CASE_PREFIX,
  LONGITUDINAL_E2E_EMAIL_DOMAIN,
} from "./constants";

const BUCKET = process.env.CASE_FILES_BUCKET || "case-files";

async function deleteStorageUnderCase(
  admin: SupabaseClient,
  caseId: string
): Promise<void> {
  const prefixes = [`cases/${caseId}`, caseId];
  for (const prefix of prefixes) {
    try {
      const { data } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
      const files = (data ?? [])
        .filter((item) => item.name)
        .map((item) => `${prefix}/${item.name}`);
      if (files.length) {
        await admin.storage.from(BUCKET).remove(files);
      }
    } catch {
      // best-effort
    }
  }
}

/**
 * Delete lineage rows for a single case (FK-safe order). Does not delete the case row.
 */
export async function resetLongitudinalCaseLineage(
  admin: SupabaseClient,
  caseId: string
): Promise<void> {
  await admin.from("hairaudit_projection_comparisons").delete().eq("case_id", caseId);
  await admin.from("hairaudit_projection_observations").delete().eq("case_id", caseId);
  await admin
    .from("hairaudit_longitudinal_capture_plans")
    .delete()
    .eq("case_id", caseId);
  await admin.from("hairaudit_projection_snapshots").delete().eq("case_id", caseId);
  await admin.from("uploads").delete().eq("case_id", caseId);
  await deleteStorageUnderCase(admin, caseId);
}

export async function listLongitudinalE2eCases(
  admin: SupabaseClient
): Promise<Array<{ id: string; external_case_id: string; user_id: string | null; patient_id: string | null }>> {
  const { data, error } = await admin
    .from("cases")
    .select("id, external_case_id, user_id, patient_id")
    .like("external_case_id", `${LONGITUDINAL_E2E_EXTERNAL_CASE_PREFIX}%`);
  if (error) throw new Error(`list fixture cases failed: ${error.message}`);
  return (data ?? []).filter((c) =>
    isLongitudinalE2eExternalCaseId(String(c.external_case_id ?? ""))
  ) as Array<{
    id: string;
    external_case_id: string;
    user_id: string | null;
    patient_id: string | null;
  }>;
}

/**
 * Cleanup only FI-OI-1F fixture rows. Never truncates broad tables.
 */
export async function cleanupLongitudinalE2eFixtures(
  admin: SupabaseClient,
  opts?: { deleteUsers?: boolean }
): Promise<{ casesDeleted: number; usersDeleted: number }> {
  assertLongitudinalE2eFixturesAllowed();

  const cases = await listLongitudinalE2eCases(admin);
  const userIds = new Set<string>();

  for (const c of cases) {
    await resetLongitudinalCaseLineage(admin, c.id);
    await admin.from("reports").delete().eq("case_id", c.id);
    await admin.from("cases").delete().eq("id", c.id);
    if (c.user_id) userIds.add(c.user_id);
    if (c.patient_id) userIds.add(c.patient_id);
  }

  let usersDeleted = 0;
  if (opts?.deleteUsers !== false) {
    for (const userId of userIds) {
      const { data } = await admin.auth.admin.getUserById(userId);
      const email = data?.user?.email ?? "";
      if (
        email.endsWith(`@${LONGITUDINAL_E2E_EMAIL_DOMAIN}`) &&
        email.includes("e2e-fi-oi-1f-")
      ) {
        await admin.auth.admin.deleteUser(userId);
        usersDeleted += 1;
      }
    }
  }

  return { casesDeleted: cases.length, usersDeleted };
}
