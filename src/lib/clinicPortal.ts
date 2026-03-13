import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PortalMode =
  | "hairaudit_public"
  | "clinic_internal"
  | "training"
  | "doctor_benchmarking"
  | "clinic_benchmarking"
  | "follicle_whitelabel";

export type CapabilityType =
  | "method"
  | "tool"
  | "device"
  | "machine"
  | "optional_extra"
  | "protocol";

export const CLINIC_PORTAL_STEPS = [
  "foundation",
  "clinical_stack",
  "audit_workspaces",
  "visibility_controls",
  "activation",
] as const;

export type ClinicPortalStep = (typeof CLINIC_PORTAL_STEPS)[number];

export const CAPABILITY_TYPES: CapabilityType[] = [
  "method",
  "tool",
  "device",
  "machine",
  "optional_extra",
  "protocol",
];

export function normalizeStepList(value: unknown): ClinicPortalStep[] {
  if (!Array.isArray(value)) return [];
  const out = value
    .map((entry) => String(entry ?? "").trim())
    .filter((entry): entry is ClinicPortalStep =>
      (CLINIC_PORTAL_STEPS as readonly string[]).includes(entry)
    );
  return [...new Set(out)];
}

export function computeProfileCompletionScore(profile: Record<string, unknown>): number {
  const expected = [
    "tagline",
    "primary_country",
    "primary_city",
    "year_established",
    "lead_doctor",
    "contact_email",
    "website",
  ];
  const complete = expected.filter((k) => {
    const value = profile[k];
    if (typeof value === "number") return true;
    return String(value ?? "").trim().length > 0;
  }).length;
  return Math.round((complete / expected.length) * 100);
}

export function computeAdvancedCompletionScore(profile: Record<string, unknown>): number {
  const expected = [
    "surgical_team_size",
    "avg_cases_per_month",
    "qa_protocol",
    "training_program",
    "internal_audit_frequency",
    "primary_machine_stack",
    "sterilization_protocol",
    "patient_followup_protocol",
  ];
  const complete = expected.filter((k) => String(profile[k] ?? "").trim().length > 0).length;
  return Math.round((complete / expected.length) * 100);
}

type ClinicProfileRow = {
  id: string;
  linked_user_id: string | null;
  clinic_name: string;
  clinic_email: string | null;
};

export async function resolveClinicProfileForUser(params: {
  userId: string;
  userEmail: string;
}) {
  const { userId, userEmail } = params;
  const admin = createSupabaseAdminClient();

  const select = "id, linked_user_id, clinic_name, clinic_email";
  const { data: byUser } = await admin
    .from("clinic_profiles")
    .select(select)
    .eq("linked_user_id", userId)
    .limit(1)
    .maybeSingle();

  const { data: byEmail } =
    !byUser && userEmail
      ? await admin
          .from("clinic_profiles")
          .select(select)
          .eq("clinic_email", userEmail)
          .limit(1)
          .maybeSingle()
      : { data: null as ClinicProfileRow | null };

  let clinicProfile = (byUser ?? byEmail) as ClinicProfileRow | null;

  if (!clinicProfile) {
    const { data: created } = await admin
      .from("clinic_profiles")
      .insert({
        linked_user_id: userId,
        clinic_name: `Clinic ${userId.slice(0, 8)}`,
        clinic_email: userEmail || null,
      })
      .select(select)
      .maybeSingle();
    clinicProfile = (created as ClinicProfileRow | null) ?? null;
  } else if (!clinicProfile.linked_user_id) {
    await admin.from("clinic_profiles").update({ linked_user_id: userId }).eq("id", clinicProfile.id);
    clinicProfile = { ...clinicProfile, linked_user_id: userId };
  }

  return { admin, clinicProfile };
}
