import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess, isAcademyAdminRole } from "@/lib/academy/auth";
import { fetchTrainingCaseCorrections } from "@/lib/academy/trainingCaseCorrections/audit";
import { isActiveTrainingCaseUpload } from "@/lib/academy/trainingCaseUploads";
import type { TrainingCaseUploadRow } from "@/lib/academy/types";
import TrainingCaseCorrectionEditor from "@/components/academy/training-case-corrections/TrainingCaseCorrectionEditor";
import TrainingCaseCorrectionHistory from "@/components/academy/training-case-corrections/TrainingCaseCorrectionHistory";

export const dynamic = "force-dynamic";

export default async function TrainingCaseEditPage({ params }: { params: Promise<{ caseId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (!access.isStaff) redirect("/academy/dashboard");

  const { caseId } = await params;
  const supabase = await createSupabaseAuthServerClient();

  const { data: c, error: cErr } = await supabase.from("training_cases").select("*").eq("id", caseId).maybeSingle();
  if (cErr || !c || c.deleted_at) notFound();

  const [{ data: doctor }, { data: uploadsRaw }, { data: metrics }, { data: doctors }, { data: trainers }, corrections] =
    await Promise.all([
      supabase.from("training_doctors").select("id, full_name").eq("id", c.training_doctor_id).maybeSingle(),
      supabase.from("training_case_uploads").select("*").eq("training_case_id", caseId).order("created_at", { ascending: true }),
      supabase.from("training_case_metrics").select("*").eq("training_case_id", caseId).maybeSingle(),
      supabase.from("training_doctors").select("id, full_name").order("full_name"),
      supabase
        .from("academy_users")
        .select("user_id, display_name, role")
        .in("role", ["academy_admin", "trainer", "clinic_staff"]),
      fetchTrainingCaseCorrections(supabase, caseId).catch(() => []),
    ]);

  const uploads = ((uploadsRaw ?? []) as TrainingCaseUploadRow[]).filter(isActiveTrainingCaseUpload);

  const userIds = [...new Set(corrections.map((r) => r.changed_by).filter(Boolean))] as string[];
  const userNamesById: Record<string, string> = {};
  if (userIds.length) {
    const { data: users } = await supabase.from("academy_users").select("user_id, display_name").in("user_id", userIds);
    for (const u of users ?? []) {
      userNamesById[u.user_id] = u.display_name || u.user_id.slice(0, 8);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8 pb-12">
      <div>
        <Link href={`/academy/cases/${caseId}`} className="text-sm font-medium text-amber-700 hover:underline">
          ← Training case
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Correct case data</h1>
        <p className="mt-1 text-sm text-slate-600">
          {doctor?.full_name ?? "Trainee"} · {c.surgery_date} · {c.procedure_type || "FUE"}
        </p>
      </div>

      <TrainingCaseCorrectionEditor
        caseId={caseId}
        initialCase={c}
        initialMetrics={(metrics ?? {}) as Record<string, string | number | boolean | null | undefined>}
        uploads={uploads}
        doctors={doctors ?? []}
        trainers={(trainers ?? []).map((t) => ({ user_id: t.user_id, display_name: t.display_name }))}
        isAdmin={isAcademyAdminRole(access.role)}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Correction history</h2>
        <TrainingCaseCorrectionHistory corrections={corrections} userNamesById={userNamesById} />
      </section>
    </div>
  );
}
