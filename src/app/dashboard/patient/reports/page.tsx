import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BENCHMARKING_GLOBAL_STANDARDS } from "@/lib/benchmarkingCopy";
import PatientReportsI18nHeader from "@/components/i18n/PatientReportsI18nHeader";
import PatientReportsI18nEmpty from "@/components/i18n/PatientReportsI18nEmpty";
import PatientReportsCompletedCaseList from "@/components/patient/PatientReportsCompletedCaseList";

export default async function PatientReportsPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: cases } = await admin
    .from("cases")
    .select("id, title, status, created_at, submitted_at")
    .or(`patient_id.eq.${user.id},and(user_id.eq.${user.id},patient_id.is.null)`)
    .eq("status", "complete")
    .order("created_at", { ascending: false });

  const completedCases = cases ?? [];
  const caseIds = completedCases.map((c) => c.id);
  const pdfByCase: Record<string, string> = {};
  if (caseIds.length > 0) {
    const { data: reportRows } = await admin
      .from("reports")
      .select("case_id, pdf_path, version")
      .in("case_id", caseIds)
      .in("status", ["complete", "pdf_ready"])
      .not("pdf_path", "is", null)
      .order("version", { ascending: false });
    for (const r of reportRows ?? []) {
      const cid = (r as { case_id: string; pdf_path: string }).case_id;
      const path = (r as { case_id: string; pdf_path: string }).pdf_path;
      if (cid && path && !pdfByCase[cid]) pdfByCase[cid] = path;
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <PatientReportsI18nHeader benchmarkingLine={BENCHMARKING_GLOBAL_STANDARDS} />

        {completedCases.length === 0 ? (
          <PatientReportsI18nEmpty />
        ) : (
          <PatientReportsCompletedCaseList cases={completedCases} pdfByCase={pdfByCase} />
        )}
      </section>
    </div>
  );
}
