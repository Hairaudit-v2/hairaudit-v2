import type { SupabaseClient } from "@supabase/supabase-js";

export type LinkClinicIdentityResult = {
  clinicProfileId: string;
  createdShell: boolean;
  linkedExisting: boolean;
};

export type LinkClinicIdentityConflict = {
  conflict: true;
  reason: string;
};

function mapNexusApprovalToParticipationStatus(approvalStatus: string): string {
  const s = approvalStatus.trim().toLowerCase();
  if (s === "approved") return "approved";
  if (s === "more_info_required") return "more_info_required";
  if (s === "pending" || s === "pending_review") return "pending_review";
  return "pending_review";
}

/**
 * Detects email-only clinic profiles that must not be linked without a matching external anchor.
 */
export async function detectClinicIdentityConflict(
  supabase: SupabaseClient,
  input: { globalClinicId: string; primaryContactEmail: string }
): Promise<LinkClinicIdentityConflict | null> {
  const globalId = input.globalClinicId.trim();
  const email = input.primaryContactEmail.trim().toLowerCase();
  if (!email) return null;

  const { data: byEmail, error } = await supabase
    .from("clinic_profiles")
    .select("id, external_clinic_id, linked_user_id")
    .ilike("clinic_email", email)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!byEmail?.id) return null;

  const existingAnchor = byEmail.external_clinic_id?.trim() ?? "";
  if (!existingAnchor) {
    return {
      conflict: true,
      reason: "email_only_profile_without_external_anchor",
    };
  }
  if (existingAnchor !== globalId) {
    return {
      conflict: true,
      reason: "external_anchor_mismatch",
    };
  }

  return null;
}

/**
 * Links a provisioned clinic to an existing clinic profile by global_clinic_id
 * (stored as external_clinic_id). Never grants access by email alone.
 */
export async function linkClinicIdentityFromNexus(
  supabase: SupabaseClient,
  input: {
    globalClinicId: string;
    clinicName: string;
    primaryContactEmail: string;
    primaryContactName?: string | null;
    country?: string | null;
    region?: string | null;
    approvalStatus: string;
  }
): Promise<LinkClinicIdentityResult> {
  const globalId = input.globalClinicId.trim();

  const conflict = await detectClinicIdentityConflict(supabase, {
    globalClinicId: globalId,
    primaryContactEmail: input.primaryContactEmail,
  });
  if (conflict) {
    throw new Error(`Clinic identity conflict: ${conflict.reason}`);
  }

  const { data: byExternalId, error: lookupErr } = await supabase
    .from("clinic_profiles")
    .select("id, external_clinic_id, linked_user_id")
    .eq("external_clinic_id", globalId)
    .maybeSingle();

  if (lookupErr) throw new Error(lookupErr.message);

  const participationStatus = mapNexusApprovalToParticipationStatus(input.approvalStatus);

  if (byExternalId?.id) {
    const { error: updateErr } = await supabase
      .from("clinic_profiles")
      .update({
        external_clinic_id: globalId,
        participation_approval_status: participationStatus,
        clinic_email: input.primaryContactEmail.trim(),
        clinic_name: input.clinicName.trim(),
        ...(input.country?.trim() ? { country: input.country.trim() } : {}),
        ...(input.region?.trim() ? { city: input.region.trim() } : {}),
      })
      .eq("id", byExternalId.id);

    if (updateErr) throw new Error(updateErr.message);

    return {
      clinicProfileId: byExternalId.id,
      createdShell: false,
      linkedExisting: true,
    };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("clinic_profiles")
    .insert({
      linked_user_id: null,
      clinic_name: input.clinicName.trim(),
      clinic_email: input.primaryContactEmail.trim(),
      external_clinic_id: globalId,
      participation_approval_status: participationStatus,
      participation_status: "not_started",
      ...(input.country?.trim() ? { country: input.country.trim() } : {}),
      ...(input.region?.trim() ? { city: input.region.trim() } : {}),
    })
    .select("id")
    .single();

  if (insertErr) throw new Error(insertErr.message);

  return {
    clinicProfileId: inserted.id,
    createdShell: true,
    linkedExisting: false,
  };
}
