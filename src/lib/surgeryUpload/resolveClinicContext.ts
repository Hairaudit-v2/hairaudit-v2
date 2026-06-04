// HairAudit Mobile Surgery Upload Portal — Stage 2
// Resolve the clinic context (clinic_profiles.id + name) for a user, used to load
// and apply clinic surgery defaults. Safe by design: returns nulls rather than
// throwing when no clinic can be resolved (e.g. unaffiliated doctors, auditors).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/roles";

export type SurgeryClinicContext = {
  clinicProfileId: string | null;
  clinicName: string | null;
  /** How the clinic was resolved (for logging / UI hints). */
  source: "clinic_owner" | "doctor_link" | "none";
};

/**
 * Resolve a user's clinic profile.
 * - clinic users: their own clinic_profiles row (linked_user_id)
 * - doctor users: the clinic_profile_id on their doctor_profiles row, if any
 * - auditors / unaffiliated: { null, null, "none" }
 */
export async function resolveSurgeryClinicContext(
  admin: SupabaseClient,
  userId: string,
  role: UserRole
): Promise<SurgeryClinicContext> {
  try {
    if (role === "clinic") {
      const { data } = await admin
        .from("clinic_profiles")
        .select("id, clinic_name")
        .eq("linked_user_id", userId)
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        return {
          clinicProfileId: data.id as string,
          clinicName: (data.clinic_name as string | null) ?? null,
          source: "clinic_owner",
        };
      }
      return { clinicProfileId: null, clinicName: null, source: "none" };
    }

    if (role === "doctor") {
      const { data: doctor } = await admin
        .from("doctor_profiles")
        .select("clinic_profile_id")
        .eq("linked_user_id", userId)
        .limit(1)
        .maybeSingle();
      const clinicProfileId = (doctor?.clinic_profile_id as string | null) ?? null;
      if (!clinicProfileId) {
        return { clinicProfileId: null, clinicName: null, source: "none" };
      }
      const { data: clinic } = await admin
        .from("clinic_profiles")
        .select("clinic_name")
        .eq("id", clinicProfileId)
        .maybeSingle();
      return {
        clinicProfileId,
        clinicName: (clinic?.clinic_name as string | null) ?? null,
        source: "doctor_link",
      };
    }
  } catch {
    // Never block uploads because clinic resolution failed.
  }

  return { clinicProfileId: null, clinicName: null, source: "none" };
}
