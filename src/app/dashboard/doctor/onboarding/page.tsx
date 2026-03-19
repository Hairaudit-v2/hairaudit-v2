import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import DoctorOnboardingForm from "./DoctorOnboardingForm";

export default async function DoctorOnboardingPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: doctorProfile } = await admin
    .from("doctor_profiles")
    .select("id")
    .eq("linked_user_id", user.id)
    .maybeSingle();

  // Already completed onboarding: avoid showing form again
  if (doctorProfile) {
    redirect("/dashboard/doctor");
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            Doctor onboarding
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Set up your professional profile so we can attribute your cases and build your
            transparent record.
          </p>
        </div>
        <Link
          href="/dashboard/doctor"
          className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Overview
        </Link>
      </div>
      <DoctorOnboardingForm />
    </div>
  );
}
