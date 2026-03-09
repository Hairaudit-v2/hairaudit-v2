/**
 * Central orchestration for transparency metric refreshes.
 * Ensures clinic and doctor metrics stay in sync after lifecycle events.
 * Call refreshTransparencyMetricsForCase after:
 * - Report status becomes complete (e.g. pdf_ready)
 * - Auditor approves/rejects provisional (report-status API)
 * - Doctor contribution received (contribution-portal/submit — also calls refresh directly)
 * - Provisional high-score validated/rejected inside refresh (no extra trigger)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshClinicTransparencyMetrics, refreshDoctorTransparencyMetrics } from "./program";

const LOG_PREFIX = "[transparency-refresh]";

export type ResolvedProfiles = {
  clinicProfileId: string | null;
  doctorProfileId: string | null;
};

/**
 * Resolve clinic_profile_id and doctor_profile_id for a case.
 * Uses case_contribution_requests first, then falls back to case.clinic_id / case.doctor_id -> profiles.
 */
export async function resolveProfileIdsForCase(
  admin: SupabaseClient,
  caseId: string
): Promise<ResolvedProfiles> {
  const out: ResolvedProfiles = { clinicProfileId: null, doctorProfileId: null };

  const { data: requests } = await admin
    .from("case_contribution_requests")
    .select("clinic_profile_id, doctor_profile_id")
    .eq("case_id", caseId)
    .limit(1);

  const req = requests?.[0] as { clinic_profile_id?: string | null; doctor_profile_id?: string | null } | undefined;
  if (req?.clinic_profile_id) out.clinicProfileId = req.clinic_profile_id;
  if (req?.doctor_profile_id) out.doctorProfileId = req.doctor_profile_id;

  if (out.clinicProfileId && out.doctorProfileId) return out;

  const { data: caseRow } = await admin
    .from("cases")
    .select("clinic_id, doctor_id")
    .eq("id", caseId)
    .maybeSingle();

  const clinicUserId = (caseRow as { clinic_id?: string | null } | null)?.clinic_id ?? null;
  const doctorUserId = (caseRow as { doctor_id?: string | null } | null)?.doctor_id ?? null;

  if (!out.clinicProfileId && clinicUserId) {
    const { data: cp } = await admin
      .from("clinic_profiles")
      .select("id")
      .eq("linked_user_id", clinicUserId)
      .limit(1)
      .maybeSingle();
    if (cp?.id) out.clinicProfileId = cp.id;
  }
  if (!out.doctorProfileId && doctorUserId) {
    const { data: dp } = await admin
      .from("doctor_profiles")
      .select("id")
      .eq("linked_user_id", doctorUserId)
      .limit(1)
      .maybeSingle();
    if (dp?.id) out.doctorProfileId = dp.id;
  }

  return out;
}

/**
 * Trigger transparency metric refresh for clinic and doctor associated with a case.
 * Deduplicates by only calling each profile's refresh once per invocation.
 * Logs each trigger path when log is provided.
 */
export async function refreshTransparencyMetricsForCase(
  admin: SupabaseClient,
  caseId: string,
  options?: { reason?: string; log?: (msg: string, meta?: Record<string, unknown>) => void }
): Promise<{ clinicRefreshed: boolean; doctorRefreshed: boolean }> {
  const log = options?.log ?? (() => {});
  const reason = options?.reason ?? "lifecycle";

  log(`${LOG_PREFIX} resolving profiles for case`, { caseId, reason });

  const { clinicProfileId, doctorProfileId } = await resolveProfileIdsForCase(admin, caseId);

  let clinicRefreshed = false;
  let doctorRefreshed = false;

  if (clinicProfileId) {
    log(`${LOG_PREFIX} refreshing clinic transparency`, { caseId, clinicProfileId, reason });
    try {
      await refreshClinicTransparencyMetrics(admin, clinicProfileId);
      clinicRefreshed = true;
    } catch (e) {
      log(`${LOG_PREFIX} clinic refresh failed`, { caseId, clinicProfileId, error: String((e as Error)?.message) });
    }
  }

  if (doctorProfileId) {
    log(`${LOG_PREFIX} refreshing doctor transparency`, { caseId, doctorProfileId, reason });
    try {
      await refreshDoctorTransparencyMetrics(admin, doctorProfileId);
      doctorRefreshed = true;
    } catch (e) {
      log(`${LOG_PREFIX} doctor refresh failed`, { caseId, doctorProfileId, error: String((e as Error)?.message) });
    }
  }

  if (!clinicProfileId && !doctorProfileId) {
    log(`${LOG_PREFIX} no clinic or doctor profile resolved for case`, { caseId, reason });
  }

  return { clinicRefreshed, doctorRefreshed };
}
