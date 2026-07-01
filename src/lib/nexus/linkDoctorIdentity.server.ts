import type { SupabaseClient } from "@supabase/supabase-js";

import { readHaNexusAllowedSources } from "@/lib/nexus/haNexusEnv.server";

export type LinkDoctorIdentityResult = {
  doctorProfileId: string;
  createdShell: boolean;
  linkedExisting: boolean;
};

function mapNexusApprovalToParticipationStatus(approvalStatus: string): string {
  const s = approvalStatus.trim().toLowerCase();
  if (s === "approved") return "approved";
  if (s === "more_info_required") return "more_info_required";
  if (s === "pending" || s === "pending_review") return "pending_review";
  return "pending_review";
}

/**
 * Links a provisioned professional to an existing doctor profile by global_professional_id
 * (stored as external_provider_id). Never grants access by email alone.
 */
export async function linkDoctorIdentityFromNexus(
  supabase: SupabaseClient,
  input: {
    globalProfessionalId: string;
    email: string;
    fullName?: string | null;
    approvalStatus: string;
  }
): Promise<LinkDoctorIdentityResult> {
  const globalId = input.globalProfessionalId.trim();

  const { data: byExternalId, error: lookupErr } = await supabase
    .from("doctor_profiles")
    .select("id, external_provider_id, linked_user_id")
    .eq("external_provider_id", globalId)
    .maybeSingle();

  if (lookupErr) throw new Error(lookupErr.message);

  if (byExternalId?.id) {
    const participationStatus = mapNexusApprovalToParticipationStatus(input.approvalStatus);
    const { error: updateErr } = await supabase
      .from("doctor_profiles")
      .update({
        external_provider_id: globalId,
        participation_approval_status: participationStatus,
        doctor_email: input.email.trim(),
        ...(input.fullName?.trim() ? { doctor_name: input.fullName.trim() } : {}),
      })
      .eq("id", byExternalId.id);

    if (updateErr) throw new Error(updateErr.message);

    return {
      doctorProfileId: byExternalId.id,
      createdShell: false,
      linkedExisting: true,
    };
  }

  const participationStatus = mapNexusApprovalToParticipationStatus(input.approvalStatus);
  const { data: inserted, error: insertErr } = await supabase
    .from("doctor_profiles")
    .insert({
      linked_user_id: null,
      doctor_name: input.fullName?.trim() || "Network Professional",
      doctor_email: input.email.trim(),
      external_provider_id: globalId,
      participation_approval_status: participationStatus,
      participation_status: "not_started",
    })
    .select("id")
    .single();

  if (insertErr) throw new Error(insertErr.message);

  return {
    doctorProfileId: inserted.id,
    createdShell: true,
    linkedExisting: false,
  };
}

export function validateNexusSourceSystem(sourceSystem: string | undefined): { ok: true; source: string } | { ok: false; error: string } {
  const source = (sourceSystem?.trim() || "iiohr").toLowerCase();
  const allowed = readHaNexusAllowedSources();
  if (!allowed.has(source)) {
    return { ok: false, error: `sourceSystem '${source}' is not allowed.` };
  }
  return { ok: true, source };
}

/**
 * When a doctor auth user later links to a nexus shell, attach linked_user_id without email-only matching.
 */
export async function attachLinkedUserToNexusDoctorProfile(
  supabase: SupabaseClient,
  input: { userId: string; globalProfessionalId: string }
): Promise<boolean> {
  const globalId = input.globalProfessionalId.trim();
  const { data: profile, error } = await supabase
    .from("doctor_profiles")
    .select("id, linked_user_id, external_provider_id")
    .eq("external_provider_id", globalId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile?.id) return false;
  if (profile.linked_user_id && profile.linked_user_id !== input.userId) return false;

  const { error: updateErr } = await supabase
    .from("doctor_profiles")
    .update({ linked_user_id: input.userId })
    .eq("id", profile.id)
    .is("linked_user_id", null);

  if (updateErr) throw new Error(updateErr.message);
  return true;
}
