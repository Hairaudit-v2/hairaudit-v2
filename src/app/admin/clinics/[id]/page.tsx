import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { getNextMilestoneFromProfile } from "@/lib/transparency/awardRules";

export const dynamic = "force-dynamic";

const clinicSelect =
  "id, clinic_name, clinic_email, participation_status, current_award_tier, audited_case_count, contributed_case_count, benchmark_eligible_count, transparency_score, average_forensic_score, documentation_integrity_average, award_progression_paused, volume_confidence_score, validated_case_count, provisional_high_score_count, validated_high_score_count, low_score_case_count, benchmark_eligible_validated_count";

export default async function AdminClinicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) redirect("/login/auditor");

  const { data: clinic } = await admin
    .from("clinic_profiles")
    .select(clinicSelect)
    .eq("id", id)
    .maybeSingle();

  if (!clinic) notFound();

  const clinicRow = clinic as Record<string, unknown>;
  const nextMilestone = getNextMilestoneFromProfile({
    current_award_tier: clinic.current_award_tier,
    validated_case_count: (clinicRow.validated_case_count as number) ?? clinic.contributed_case_count,
    average_forensic_score: clinic.average_forensic_score,
    benchmark_eligible_validated_count: (clinicRow.benchmark_eligible_validated_count as number) ?? clinic.benchmark_eligible_count,
    transparency_score: clinic.transparency_score,
    documentation_integrity_average: clinic.documentation_integrity_average,
    award_progression_paused: clinicRow.award_progression_paused as boolean | undefined,
    volume_confidence_score: clinicRow.volume_confidence_score as number | undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/contribution-requests" className="text-sm text-slate-400 hover:text-cyan-300">
          ← Contribution Requests
        </Link>
      </div>
      <div className="rounded-xl border border-white/10 bg-slate-900/80 p-6">
        <h1 className="text-xl font-semibold text-white">{clinic.clinic_name}</h1>
        <p className="mt-1 text-sm text-slate-400">{clinic.clinic_email ?? "—"}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-500">Award Tier</p>
            <p className="mt-1 font-medium text-slate-200">{clinic.current_award_tier ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-500">Participation</p>
            <p className="mt-1 font-medium text-slate-200">{clinic.participation_status ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-500">Audited Cases</p>
            <p className="mt-1 font-medium text-slate-200">{clinic.audited_case_count ?? 0}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-500">Contributed</p>
            <p className="mt-1 font-medium text-slate-200">{clinic.contributed_case_count ?? 0}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-500">Validated (award-counting)</p>
            <p className="mt-1 font-medium text-slate-200">{(clinicRow.validated_case_count as number) ?? clinic.contributed_case_count ?? 0}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-500">Benchmark-eligible validated</p>
            <p className="mt-1 font-medium text-slate-200">{(clinicRow.benchmark_eligible_validated_count as number) ?? clinic.benchmark_eligible_count ?? 0}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-500">Provisional (not counting)</p>
            <p className="mt-1 font-medium text-slate-200">{(clinicRow.provisional_high_score_count as number) ?? 0}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-500">Participation rate</p>
            <p className="mt-1 font-medium text-slate-200">{Number(clinic.transparency_score ?? 0).toFixed(0)}%</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-500">Avg validated score</p>
            <p className="mt-1 font-medium text-slate-200">{Number(clinic.average_forensic_score ?? 0).toFixed(1)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-500">Progression</p>
            <p className="mt-1 font-medium text-slate-200">{(clinicRow.award_progression_paused as boolean) ? "Paused" : "Active"}</p>
          </div>
        </div>
        {nextMilestone && (
          <p className="mt-4 text-sm text-slate-300">
            <span className="text-slate-500">Next milestone:</span> {nextMilestone}
          </p>
        )}
      </div>
    </div>
  );
}
