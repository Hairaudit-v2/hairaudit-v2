import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import DoctorOnboardingPageHeader from "@/components/dashboard/DoctorOnboardingPageHeader";
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
      <DoctorOnboardingPageHeader />
      <DoctorOnboardingForm />
    </div>
  );
}
