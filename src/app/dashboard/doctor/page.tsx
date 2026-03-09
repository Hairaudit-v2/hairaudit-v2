import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import CreateCaseButton from "../create-case-button";
import ClinicTransparencyProgressPanel from "@/components/dashboard/ClinicTransparencyProgressPanel";
import { getNextMilestoneFromProfile, getNextTier } from "@/lib/transparency/awardRules";

const doctorProfileSelect =
  "id, linked_user_id, doctor_name, transparency_score, audited_case_count, contributed_case_count, benchmark_eligible_count, average_forensic_score, documentation_integrity_average, current_award_tier, award_progression_paused, volume_confidence_score, validated_case_count, provisional_high_score_count, validated_high_score_count, low_score_case_count, benchmark_eligible_validated_count";

export default async function DoctorDashboardPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const userEmail = String(user.email ?? "").toLowerCase();
  const { data: byUserProfile } = await admin
    .from("doctor_profiles")
    .select(doctorProfileSelect)
    .eq("linked_user_id", user.id)
    .limit(1)
    .maybeSingle();
  const { data: byEmailProfile } = !byUserProfile && userEmail
    ? await admin
        .from("doctor_profiles")
        .select(doctorProfileSelect)
        .eq("doctor_email", userEmail)
        .limit(1)
        .maybeSingle()
    : { data: null as typeof byUserProfile };
  const doctorProfile = byUserProfile ?? byEmailProfile ?? null;

  const { data: cases } = await admin
    .from("cases")
    .select("id, title, status, created_at")
    .eq("doctor_id", user.id)
    .order("created_at", { ascending: false });

  const currentTier = (doctorProfile?.current_award_tier ?? "VERIFIED") as "VERIFIED" | "SILVER" | "GOLD" | "PLATINUM";
  const nextTier = getNextTier(currentTier);
  const nextMilestone = getNextMilestoneFromProfile({
    current_award_tier: doctorProfile?.current_award_tier,
    validated_case_count: (doctorProfile as { validated_case_count?: number })?.validated_case_count ?? doctorProfile?.contributed_case_count,
    average_forensic_score: doctorProfile?.average_forensic_score,
    benchmark_eligible_validated_count: (doctorProfile as { benchmark_eligible_validated_count?: number })?.benchmark_eligible_validated_count ?? doctorProfile?.benchmark_eligible_count,
    transparency_score: doctorProfile?.transparency_score,
    documentation_integrity_average: doctorProfile?.documentation_integrity_average,
    award_progression_paused: (doctorProfile as { award_progression_paused?: boolean })?.award_progression_paused,
    volume_confidence_score: (doctorProfile as { volume_confidence_score?: number })?.volume_confidence_score,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Doctor Dashboard</h1>
          <p className="text-slate-600 text-sm mt-1">Upload patient details and review your audits</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/clinics"
            className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            View Clinics Directory
          </Link>
          <Link
            href="/verified-surgeon-program"
            className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Learn About the Verified Program
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 mb-6">
        <p className="text-sm text-blue-900">
          Submit patient cases for audit. Upload procedure details, images, and review past audit feedback on your work.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500">Benchmarking</div>
            <div className="text-sm text-slate-700 mt-1">
              Rankings are confidence-gated and only include benchmark-eligible cases.
            </div>
          </div>
          <Link
            href="/leaderboards/doctors"
            className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
          >
            View doctor leaderboard →
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <ClinicTransparencyProgressPanel
          title="Doctor Transparency Progress"
          profile={doctorProfile}
          nextMilestone={nextMilestone}
          nextTierLabel={nextTier ?? null}
        />
        <p className="mt-3 text-sm text-slate-600">
          <Link href="/verified-surgeon-program" className="font-medium text-cyan-700 hover:text-cyan-800">
            See how clinic recognition works
          </Link>
        </p>
      </div>

      <div className="mb-8">
        <CreateCaseButton />
      </div>

      <h2 className="text-lg font-semibold text-slate-900 mt-8 mb-3">My audits</h2>
      {(!cases || cases.length === 0) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">No cases yet. Create one to submit a patient case for audit.</p>
          <CreateCaseButton />
        </div>
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <span className="font-medium text-slate-900">{c.title ?? "Patient audit"}</span>
                <span className="ml-2 text-slate-500 text-sm">— {c.status}</span>
                <div className="text-xs text-slate-400 mt-2">
                  Created: {new Date(c.created_at).toLocaleString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
