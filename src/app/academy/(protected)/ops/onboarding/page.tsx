import Link from "next/link";
import { redirect } from "next/navigation";
import { ACADEMY_ADMIN_FORBIDDEN_PATH, getAcademyAccess, isAcademyAdminRole } from "@/lib/academy/auth";
import { academyOpsInboxAddress } from "@/lib/academy/onboardingTemplate";
import { listAcademySites } from "@/lib/academy/academySites";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import OnboardingClient from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function AcademyOnboardingPage() {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (!isAcademyAdminRole(access.role)) redirect(ACADEMY_ADMIN_FORBIDDEN_PATH);

  const envFallbackConfigured = Boolean(academyOpsInboxAddress());
  const defaultRequesterEmail = access.user.email?.trim() ?? "";

  const supabase = await createSupabaseAuthServerClient();
  const sites = await listAcademySites(supabase);
  const { data: programsData } = await supabase
    .from("training_programs")
    .select("id, name, academy_site_id")
    .order("name", { ascending: true });
  const programs = programsData ?? [];
  const { data: doctorsData } = await supabase
    .from("training_doctors")
    .select("id, full_name, program_id")
    .order("full_name", { ascending: true });
  const doctors = doctorsData ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
      <div>
        <Link href="/academy/dashboard" className="text-sm font-medium text-amber-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Academy team access</h1>
        <p className="mt-1 text-sm text-slate-600">
          As a HairAudit academy admin: email the training academy (IIOHR / Evolved) to collect their official roster,
          then create Supabase logins for each person they confirm. Choose how to route the request (trainee, program,
          site, or global env fallback) — the resolved inbox is shown before you send.
        </p>
      </div>

      <OnboardingClient
        envFallbackConfigured={envFallbackConfigured}
        sites={sites.map((s) => ({ id: s.id, name: s.name, slug: s.slug, display_name: s.display_name }))}
        programs={programs}
        doctors={doctors}
        defaultHairauditAdminEmail={defaultRequesterEmail}
      />
    </div>
  );
}
