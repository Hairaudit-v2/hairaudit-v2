import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import SubmitButton from "./submit-button";
import DownloadReport from "./download-report";
import AuditScoreBadge from "@/components/reports/AuditScoreBadge";

import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { parseRole, USER_ROLES } from "@/lib/roles";

export default async function Page({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: c } = await admin
    .from("cases")
    .select("id, title, status, created_at, user_id, submitted_at, patient_id, doctor_id, clinic_id")
    .eq("id", caseId)
    .maybeSingle();

  const allowed = await canAccessCase(user.id, c);
  if (!c || !allowed) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="font-semibold text-slate-900">Case not found.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-amber-600 hover:text-amber-500 font-medium">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  let role = parseRole((user.user_metadata as Record<string, unknown>)?.role);
  try {
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role) role = parseRole(profile.role);
  } catch {
    /* profiles may not exist */
  }

  // In development, allow dev_role cookie to override
  if (process.env.NODE_ENV === "development") {
    const cookieStore = await cookies();
    const devRole = cookieStore.get("dev_role")?.value;
    if (devRole && USER_ROLES.includes(devRole as any)) {
      role = devRole as typeof role;
    }
  }

  const dashboardPath = role === "doctor" ? "/dashboard/doctor" : role === "clinic" ? "/dashboard/clinic" : role === "auditor" ? "/dashboard/auditor" : "/dashboard/patient";

  const { data: uploads, error: upErr } = await admin
    .from("uploads")
    .select("id, type, storage_path, created_at")
    .eq("case_id", c.id)
    .order("created_at", { ascending: false });

  const { data: reports, error: repErr } = await admin
    .from("reports")
    .select("id, version, pdf_path, summary, created_at")
    .eq("case_id", c.id)
    .order("version", { ascending: false });

  // Role-specific action links
  const showPatientFlow = role === "patient" || role === "auditor";
  const showDoctorFlow = role === "doctor" || role === "auditor";
  const showClinicFlow = role === "clinic" || role === "auditor";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      <Link
        href={dashboardPath}
        className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-amber-600 transition-colors"
      >
        ← Back to dashboard
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mt-4">{c.title ?? "Untitled case"}</h1>
      <p className="text-slate-600 text-sm mt-1">Status: {c.status}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        {showPatientFlow && (
          <>
            <Link
              href={`/cases/${c.id}/patient/photos`}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-amber-300 hover:bg-amber-50/50 transition-colors"
            >
              Patient Photos →
            </Link>
            <Link
              href={`/cases/${c.id}/patient/questions`}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-amber-300 hover:bg-amber-50/50 transition-colors"
            >
              Patient Questions →
            </Link>
          </>
        )}
        {showDoctorFlow && (
          <>
            <Link
              href={`/cases/${c.id}/doctor/form`}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
            >
              Doctor Form →
            </Link>
            <Link
              href={`/cases/${c.id}/doctor/photos`}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
            >
              Doctor Photos →
            </Link>
          </>
        )}
        {showClinicFlow && (
          <>
            <Link
              href={`/cases/${c.id}/clinic/form`}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-amber-300 hover:bg-amber-50/50 transition-colors"
            >
              Clinic Form →
            </Link>
            <Link
              href={`/cases/${c.id}/clinic/photos`}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-amber-300 hover:bg-amber-50/50 transition-colors"
            >
              Clinic Photos →
            </Link>
          </>
        )}
      </div>

      {(showPatientFlow || showDoctorFlow || showClinicFlow) && (
        <div className="mt-6 p-4 rounded-xl border border-slate-200 bg-white">
          <h2 className="font-semibold text-slate-900 mb-2">Submit</h2>
          <SubmitButton caseId={c.id} caseStatus={c.status ?? "draft"} submittedAt={c.submitted_at} />
        </div>
      )}

      <div className="mt-6 p-4 rounded-xl border border-slate-200 bg-white">
        <h2 className="font-semibold text-slate-900 mb-2">Reports</h2>
        {repErr && <p className="text-red-600 text-sm">❌ {repErr.message}</p>}
        {!reports || reports.length === 0 ? (
          <p className="text-slate-600 text-sm">No report yet. Submit the case to trigger audit.</p>
        ) : (
          <ul className="space-y-4">
            {reports.map((r) => {
              const summary = (r.summary ?? {}) as { score?: number };
              const isProcessing = !r.pdf_path;
              return (
                <li key={r.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-slate-900">Report v{r.version}</b>
                    {isProcessing ? (
                      <span className="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-800">Processing…</span>
                    ) : (
                      <AuditScoreBadge score={summary?.score} />
                    )}
                    <span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  {r.pdf_path && (
                    <div className="mt-2">
                      <DownloadReport pdfPath={r.pdf_path} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-6 p-4 rounded-xl border border-slate-200 bg-white">
        <h2 className="font-semibold text-slate-900 mb-2">Uploaded files</h2>
        {upErr && <p className="text-red-600 text-sm">❌ {upErr.message}</p>}
        {!uploads || uploads.length === 0 ? (
          <p className="text-slate-600 text-sm">No uploads yet.</p>
        ) : (
          <ul className="space-y-2">
            {uploads.map((u) => (
              <li key={u.id} className="text-sm text-slate-700">
                <span className="font-medium">{u.type}</span>
                <span className="text-slate-500 ml-2">{u.storage_path}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
