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

/** Inputs used to build clinic progress guidance (all from existing product state). */
export type ClinicProgressInputs = {
  onboardingSteps: number;
  basicCompletion: number;
  capabilityCount: number;
  submittedCasesCount: number;
  completedCasesCount: number;
  benchmarkEligibleCount: number;
  profileVisible: boolean;
};

export type ClinicProgressStep = {
  id: string;
  message: string;
  href: string;
  detail: string;
};

/**
 * Builds an ordered list of next-step guidance items from real clinic data.
 * Uses the same thresholds as dashboard readiness (no new ranking logic).
 * Order: profile/onboarding → clinical stack → first case → benchmarking → public profile.
 */
export function buildClinicProgressSteps(inputs: ClinicProgressInputs): ClinicProgressStep[] {
  const steps: ClinicProgressStep[] = [];
  const {
    onboardingSteps,
    basicCompletion,
    capabilityCount,
    submittedCasesCount,
    completedCasesCount,
    benchmarkEligibleCount,
    profileVisible,
  } = inputs;

  if (onboardingSteps < 5) {
    steps.push({
      id: "onboarding",
      message: "Complete your clinic profile",
      href: "/dashboard/clinic/onboarding",
      detail: `Onboarding ${onboardingSteps}/5 steps done. Finish identity and setup.`,
    });
  }

  if (basicCompletion < 90 && onboardingSteps >= 5) {
    steps.push({
      id: "basic_profile",
      message: "Complete your clinic profile",
      href: "/dashboard/clinic/profile",
      detail: `Basic profile at ${basicCompletion}%. Add tagline, location, contact, and website.`,
    });
  }

  if (capabilityCount < 4) {
    steps.push({
      id: "clinical_stack",
      message: "Add your clinical stack",
      href: "/dashboard/clinic/profile#clinical-stack",
      detail: `${capabilityCount} items added. Add methods, tools, and devices for credibility.`,
    });
  }

  if (submittedCasesCount === 0) {
    steps.push({
      id: "first_case",
      message: "Submit your first case",
      href: "/dashboard/clinic/submit-case",
      detail: "Submitted Cases build your evidence base and help you qualify for benchmarking.",
    });
  }

  if (
    completedCasesCount >= 1 &&
    benchmarkEligibleCount === 0 &&
    !steps.some((s) => s.id === "first_case")
  ) {
    steps.push({
      id: "validated_cases",
      message: "Increase validated cases to improve benchmarking visibility",
      href: "/dashboard/clinic/submit-case",
      detail: "More completed, high-quality cases help your clinic appear on leaderboards.",
    });
  }

  if (!profileVisible) {
    steps.push({
      id: "public_profile",
      message: "Prepare your public profile",
      href: "/dashboard/clinic/profile",
      detail: "Enable your public listing so patients can find and trust your clinic.",
    });
  }

  return steps;
}
