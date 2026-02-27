import Link from "next/link";
import { redirect } from "next/navigation";
import PatientAuditFormClient from "./PatientAuditFormClient";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

export default async function Page({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: c } = await supabase
    .from("cases")
    .select("id, status, submitted_at, user_id, patient_id")
    .eq("id", caseId)
    .maybeSingle();

  const allowed = !!c && (c.user_id === user.id || c.patient_id === user.id);
  if (!allowed) redirect("/dashboard");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <Link
        href={`/cases/${caseId}`}
        className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        ← Back to case
      </Link>

      <section className="relative mt-4 overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">
            Intelligence Questions
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-200/70 max-w-2xl">
            These inputs unlock deeper forensic analysis across donor safety, graft viability, healing course, and aesthetic balance.
          </p>
          <div className="mt-4 text-xs leading-relaxed text-slate-300/70">
            <div>Powered by Follicle Intelligence™</div>
            <div>Vision Model: GPT-5.2</div>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <PatientAuditFormClient
          caseId={caseId}
          caseStatus={c.status ?? "draft"}
          submittedAt={c.submitted_at}
        />
      </div>
    </div>
  );
}
