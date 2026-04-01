import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import AcademyReviewForm from "@/components/academy/AcademyReviewForm";

export const dynamic = "force-dynamic";

export default async function AcademyCaseReviewPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (!access.isStaff) redirect(`/academy/cases/${caseId}`);
  const supabase = await createSupabaseAuthServerClient();

  const { data: c, error } = await supabase
    .from("training_cases")
    .select("id, training_doctor_id")
    .eq("id", caseId)
    .maybeSingle();
  if (error || !c) notFound();

  const { data: doctor } = await supabase
    .from("training_doctors")
    .select("current_stage, full_name")
    .eq("id", c.training_doctor_id)
    .maybeSingle();

  const defaultStage = doctor?.current_stage ?? "foundation";

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 space-y-6">
      <div>
        <Link href={`/academy/cases/${caseId}`} className="text-sm font-medium text-amber-700 hover:underline">
          ← Case
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Trainer review</h1>
        <p className="mt-1 text-sm text-slate-600">{doctor?.full_name ?? "Trainee"}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <AcademyReviewForm caseId={caseId} defaultStage={defaultStage} />
      </div>
    </div>
  );
}
