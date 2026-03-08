import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";

export const dynamic = "force-dynamic";

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
    .select("id, clinic_name, clinic_email, participation_status, current_award_tier, audited_case_count, contributed_case_count, benchmark_eligible_count, transparency_score, average_forensic_score, documentation_integrity_average")
    .eq("id", id)
    .maybeSingle();

  if (!clinic) notFound();

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
        </div>
      </div>
    </div>
  );
}
