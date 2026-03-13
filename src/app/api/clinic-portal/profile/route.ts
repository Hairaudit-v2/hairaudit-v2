import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import {
  computeAdvancedCompletionScore,
  computeProfileCompletionScore,
  normalizeStepList,
  resolveClinicProfileForUser,
} from "@/lib/clinicPortal";

export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function GET() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userEmail = String(user.email ?? "").toLowerCase();
  const { admin, clinicProfile } = await resolveClinicProfileForUser({
    userId: user.id,
    userEmail,
  });

  if (!clinicProfile) {
    return NextResponse.json({ error: "Unable to initialize clinic profile" }, { status: 500 });
  }

  const { data: portal } = await admin
    .from("clinic_portal_profiles")
    .select(
      "id, onboarding_status, onboarding_current_step, onboarding_completed_steps, onboarding_completed_at, portal_mode, basic_profile, advanced_profile, training_readiness_score, internal_qa_enabled, doctor_benchmarking_enabled, clinic_benchmarking_enabled, white_label_enabled"
    )
    .eq("clinic_profile_id", clinicProfile.id)
    .maybeSingle();

  const basicProfile = asRecord((portal as { basic_profile?: unknown } | null)?.basic_profile);
  const advancedProfile = asRecord((portal as { advanced_profile?: unknown } | null)?.advanced_profile);

  return NextResponse.json({
    ok: true,
    clinicProfile,
    portalProfile: portal ?? null,
    completion: {
      basic: computeProfileCompletionScore(basicProfile),
      advanced: computeAdvancedCompletionScore(advancedProfile),
    },
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const userEmail = String(user.email ?? "").toLowerCase();
  const { admin, clinicProfile } = await resolveClinicProfileForUser({
    userId: user.id,
    userEmail,
  });
  if (!clinicProfile) return NextResponse.json({ error: "Clinic profile missing" }, { status: 500 });

  const current = await admin
    .from("clinic_portal_profiles")
    .select("id, onboarding_completed_steps, basic_profile, advanced_profile")
    .eq("clinic_profile_id", clinicProfile.id)
    .maybeSingle();

  const existing = (current.data ?? {}) as {
    id?: string;
    onboarding_completed_steps?: unknown;
    basic_profile?: unknown;
    advanced_profile?: unknown;
  };

  const nextBasic = { ...asRecord(existing.basic_profile), ...asRecord(body?.basicProfile) };
  const nextAdvanced = { ...asRecord(existing.advanced_profile), ...asRecord(body?.advancedProfile) };
  const nextSteps = normalizeStepList([
    ...normalizeStepList(existing.onboarding_completed_steps),
    ...normalizeStepList(body?.completedSteps),
  ]);

  const onboardingStatus =
    nextSteps.length >= 5 ? "complete" : nextSteps.length > 0 ? "in_progress" : "not_started";

  const payload = {
    clinic_profile_id: clinicProfile.id,
    onboarding_status: onboardingStatus,
    onboarding_current_step: String(body?.currentStep ?? "foundation"),
    onboarding_completed_steps: nextSteps,
    onboarding_completed_at: onboardingStatus === "complete" ? new Date().toISOString() : null,
    portal_mode: String(body?.portalMode ?? "hairaudit_public"),
    basic_profile: nextBasic,
    advanced_profile: nextAdvanced,
    internal_qa_enabled: Boolean(body?.internalQaEnabled),
    doctor_benchmarking_enabled: Boolean(body?.doctorBenchmarkingEnabled),
    clinic_benchmarking_enabled: body?.clinicBenchmarkingEnabled !== false,
    white_label_enabled: Boolean(body?.whiteLabelEnabled),
  };

  const { data: saved, error } = await admin
    .from("clinic_portal_profiles")
    .upsert(payload, { onConflict: "clinic_profile_id" })
    .select(
      "id, onboarding_status, onboarding_current_step, onboarding_completed_steps, onboarding_completed_at, portal_mode, basic_profile, advanced_profile, training_readiness_score, internal_qa_enabled, doctor_benchmarking_enabled, clinic_benchmarking_enabled, white_label_enabled"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    portalProfile: saved,
    completion: {
      basic: computeProfileCompletionScore(nextBasic),
      advanced: computeAdvancedCompletionScore(nextAdvanced),
    },
  });
}
