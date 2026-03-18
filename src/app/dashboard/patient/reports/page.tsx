import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import DownloadReport from "@/app/cases/[caseId]/download-report";

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
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <Link
              href="/dashboard/patient"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              ← Back to dashboard
            </Link>
            <h1 className="mt-2 text-xl sm:text-2xl font-semibold text-white">
              Previous reports
            </h1>
            <p className="mt-1 text-sm text-slate-200/70">
              Your completed audit reports. View or download each report below.
            </p>
          </div>
        </div>

        {completedCases.length === 0 ? (
          <div className="relative mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
            <p className="text-slate-200/80 mb-4">
              No completed reports yet. Submit a case to generate your first audit report.
            </p>
            <Link
              href="/dashboard/patient"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 transition-colors"
            >
              Go to dashboard
            </Link>
          </div>
        ) : (
          <ul className="relative mt-6 space-y-3">
            {completedCases.map((c) => {
              const pdfPath = pdfByCase[c.id];
              const isReportReady = Boolean(pdfPath);

              return (
                <li key={c.id}>
                  <div className="group relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur hover:bg-white/8 hover:border-white/15 transition-all shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <Link
                            href={`/cases/${c.id}`}
                            className="text-sm sm:text-base font-semibold text-white hover:text-cyan-200 transition-colors"
                          >
                            {c.title ?? "Patient Audit"}
                          </Link>
                          <div className="mt-1 text-xs text-slate-200/70">
                            Created: {new Date(c.created_at).toLocaleString()}
                          </div>
                        </div>
                        <span
                          className={
                            isReportReady
                              ? "shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-100"
                              : "shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-200"
                          }
                        >
                          {isReportReady ? "Report Ready" : "Complete"}
                        </span>
                      </div>

                      {isReportReady && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <Link
                            href={`/cases/${c.id}`}
                            className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 transition-colors shadow-sm"
                          >
                            View Report
                          </Link>
                          <DownloadReport pdfPath={pdfPath} label="Download PDF" />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
