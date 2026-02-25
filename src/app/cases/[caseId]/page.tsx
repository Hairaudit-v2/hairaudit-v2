import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import SubmitButton from "./submit-button";
import DownloadReport from "./download-report";
import AuditScoreBadge from "@/components/reports/AuditScoreBadge";
import DoctorAnswersSummary from "@/components/reports/DoctorAnswersSummary";
import PatientAnswersSummary from "@/components/reports/PatientAnswersSummary";
import EvidenceSummary from "@/components/reports/EvidenceSummary";
import ScoreAreaGraph from "@/components/reports/ScoreAreaGraph";
import rubric from "@/lib/audit/rubrics/hairaudit_clinical_v1.json";
import { buildRubricTitles } from "@/lib/audit/rubricTitles";
import { mapLegacyDoctorAnswers } from "@/lib/doctorAuditSchema";

import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRole, USER_ROLES } from "@/lib/roles";

export default async function Page({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  let supabase: Awaited<ReturnType<typeof createSupabaseAuthServerClient>>;
  try {
    supabase = await createSupabaseAuthServerClient();
  } catch (e) {
    console.error("[cases/page] createSupabaseAuthServerClient failed", { caseId, error: e });
    throw e;
  }

  let user: any | null = null;
  try {
    const res = await supabase.auth.getUser();
    user = (res?.data?.user ?? null) as typeof user;
  } catch (e) {
    console.error("[cases/page] auth.getUser failed", { caseId, error: e });
    throw e;
  }
  if (!user) redirect("/login");

  let admin: ReturnType<typeof tryCreateSupabaseAdminClient>;
  try {
    admin = tryCreateSupabaseAdminClient();
  } catch (e) {
    console.error("[cases/page] tryCreateSupabaseAdminClient threw", { caseId, error: e });
    throw e;
  }
  const db = admin ?? supabase;

  let role = parseRole((user.user_metadata as Record<string, unknown>)?.role);
  try {
    const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role) role = parseRole(profile.role);
  } catch {
    /* profiles may not exist / RLS may block */
  }

  let c: { id: string; title?: string; status?: string; created_at?: string; user_id?: string; submitted_at?: string | null; patient_id?: string | null; doctor_id?: string | null; clinic_id?: string | null; evidence_score_patient?: string | null; confidence_label_patient?: string | null; evidence_score_doctor?: string | null; confidence_label_doctor?: string | null; evidence_details?: Record<string, unknown> | null } | null;
  let caseRes: any;
  try {
    caseRes = await db
      .from("cases")
      .select("id, title, status, created_at, user_id, submitted_at, patient_id, doctor_id, clinic_id, evidence_score_patient, confidence_label_patient, evidence_score_doctor, confidence_label_doctor, evidence_details")
      .eq("id", caseId)
      .maybeSingle();
  } catch (e) {
    console.error("[cases/page] cases select threw", { caseId, error: e });
    throw e;
  }
  if (caseRes.error && String(caseRes.error.message || "").includes("evidence")) {
    const fallback = await db.from("cases").select("id, title, status, created_at, user_id, submitted_at, patient_id, doctor_id, clinic_id").eq("id", caseId).maybeSingle();
    c = fallback.data;
  } else {
    c = caseRes.data;
  }

  const allowed =
    Boolean(c) &&
    (c!.user_id === user.id ||
      c!.patient_id === user.id ||
      c!.doctor_id === user.id ||
      c!.clinic_id === user.id ||
      role === "auditor");
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

  // In development, allow dev_role cookie to override
  if (process.env.NODE_ENV === "development") {
    const cookieStore = await cookies();
    const devRole = cookieStore.get("dev_role")?.value;
    if (devRole && USER_ROLES.includes(devRole as any)) {
      role = devRole as typeof role;
    }
  }

  const dashboardPath = role === "doctor" ? "/dashboard/doctor" : role === "clinic" ? "/dashboard/clinic" : role === "auditor" ? "/dashboard/auditor" : "/dashboard/patient";

  const { data: uploads, error: upErr } = await db
    .from("uploads")
    .select("id, type, storage_path, created_at")
    .eq("case_id", c.id)
    .order("created_at", { ascending: false });

  // Try with status/error (requires migration 20250210000004); fallback if columns don't exist
  let reports: { id: string; version: number; pdf_path: string | null; summary: unknown; created_at: string; status?: string; error?: string | null; patient_audit_version?: number; patient_audit_v2?: Record<string, unknown> | null }[] | null = null;
  let repErr: { message: string } | null = null;
  const withStatus = await db
    .from("reports")
    .select("id, version, pdf_path, summary, created_at, status, error, patient_audit_version, patient_audit_v2")
    .eq("case_id", c.id)
    .order("version", { ascending: false });
  if (withStatus.error && (String(withStatus.error.message).includes("status") || String(withStatus.error.message).includes("patient_audit") || String(withStatus.error.message).includes("does not exist"))) {
    const fallback = await db
      .from("reports")
      .select("id, version, pdf_path, summary, created_at")
      .eq("case_id", c.id)
      .order("version", { ascending: false });
    reports = fallback.data;
    repErr = fallback.error;
  } else {
    reports = withStatus.data;
    repErr = withStatus.error;
  }

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

      {role === "auditor" && c.status === "audit_failed" && (
        <div className="mt-6 p-5 rounded-xl border-2 border-amber-300 bg-amber-50">
          <h2 className="font-semibold text-slate-900 mb-2">Manual audit required</h2>
          <p className="text-sm text-slate-600 mb-3">
            The automated audit failed. Complete a manual audit to finalize this case.
          </p>
          <Link
            href={`/cases/${c.id}/audit`}
            className="inline-flex items-center rounded-lg px-5 py-3 text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400"
          >
            Complete manual audit →
          </Link>
        </div>
      )}

      {/* 3-step flow: 1. Information → 2. Photos → 3. Submit */}
      {showPatientFlow && (
        <div className="mt-6 p-5 rounded-xl border border-slate-200 bg-white">
          <h2 className="font-semibold text-slate-900 mb-4">Patient contribution</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/cases/${c.id}/patient/questions`}
              className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
            >
              1. Complete your information
            </Link>
            <Link
              href={`/cases/${c.id}/patient/photos`}
              className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              2. Add your photos
            </Link>
          </div>
        </div>
      )}

      {showDoctorFlow && (
        <div className="mt-6 p-5 rounded-xl border border-slate-200 bg-white">
          <h2 className="font-semibold text-slate-900 mb-4">Doctor contribution</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/cases/${c.id}/doctor/form`}
              className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              1. Complete your information
            </Link>
            <Link
              href={`/cases/${c.id}/doctor/photos`}
              className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              2. Add your photos
            </Link>
          </div>
        </div>
      )}

      {showClinicFlow && (
        <div className="mt-6 p-5 rounded-xl border border-slate-200 bg-white">
          <h2 className="font-semibold text-slate-900 mb-4">Clinic contribution</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/cases/${c.id}/clinic/form`}
              className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              1. Complete your information
            </Link>
            <Link
              href={`/cases/${c.id}/clinic/photos`}
              className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              2. Add your photos
            </Link>
          </div>
        </div>
      )}

      {(showPatientFlow || showDoctorFlow || showClinicFlow) && (
        <div className="mt-6 p-5 rounded-xl border border-slate-200 bg-white">
          <h2 className="font-semibold text-slate-900 mb-2">3. Submit for audit</h2>
          <SubmitButton caseId={c.id} caseStatus={c.status ?? "draft"} submittedAt={c.submitted_at} />
        </div>
      )}

      <div className="mt-6">
        <EvidenceSummary caseRow={c} uploads={uploads ?? []} />
      </div>

      {reports && reports.length > 0 && (() => {
        const latest = reports[0];
        const summary = latest?.summary as Record<string, unknown> | undefined;
        const raw = summary?.doctor_answers as Record<string, unknown> | undefined;
        const doctorAnswers = raw ? mapLegacyDoctorAnswers(raw) : null;
        const r = latest as { patient_audit_version?: number; patient_audit_v2?: Record<string, unknown> | null };
        const patientAnswers =
          r?.patient_audit_version === 2 && r?.patient_audit_v2 && Object.keys(r.patient_audit_v2).length > 0
            ? r.patient_audit_v2
            : (summary?.patient_answers as Record<string, unknown> | undefined) ?? null;
        const hasDoctor = doctorAnswers && Object.keys(doctorAnswers).length > 0;
        const hasPatient = patientAnswers && Object.keys(patientAnswers).length > 0;
        return (
          <>
            {hasDoctor && (
              <div className="mt-6">
                <DoctorAnswersSummary answers={doctorAnswers!} />
              </div>
            )}
            {hasPatient && (
              <div className="mt-6">
                <PatientAnswersSummary answers={patientAnswers!} />
              </div>
            )}
          </>
        );
      })()}

      {reports && reports.length > 0 && (() => {
        const latest = reports[0];
        const summary = (latest?.summary as Record<string, unknown>) ?? {};
        const computed = summary?.computed as
          | { component_scores?: { domains?: Record<string, number>; sections?: Record<string, number> } }
          | undefined;
        const comp = computed?.component_scores;
        const fallbackDomains = (summary?.area_scores as Record<string, number> | null | undefined) ?? undefined;
        const fallbackSections = (summary?.section_scores as Record<string, number> | null | undefined) ?? undefined;
        const domains = comp?.domains ?? fallbackDomains;
        const sections = comp?.sections ?? fallbackSections;
        if (!domains && !sections) return null;
        const { domainTitles, sectionTitles } = buildRubricTitles(
          rubric as { domains?: { domain_id: string; title: string; sections?: { section_id: string; title: string }[] }[] }
        );
        return (
          <div className="mt-6">
            <ScoreAreaGraph
              domains={domains}
              sections={sections}
              domainTitles={domainTitles}
              sectionTitles={sectionTitles}
            />
          </div>
        );
      })()}

      <div className="mt-6 p-4 rounded-xl border border-slate-200 bg-white">
        <h2 className="font-semibold text-slate-900 mb-2">Reports</h2>
        {repErr && <p className="text-red-600 text-sm">❌ {repErr.message}</p>}
        {!reports || reports.length === 0 ? (
          <p className="text-slate-600 text-sm">No report yet. Submit the case to trigger audit.</p>
        ) : (
          <ul className="space-y-4">
            {reports.map((r) => {
              const summary = (r.summary ?? {}) as { score?: number };
              const isProcessing = !r.pdf_path && (r as any).status !== "failed";
              const isFailed = (r as any).status === "failed";
              return (
                <li key={r.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-slate-900">Report v{r.version}</b>
                    {isFailed ? (
                      <span className="rounded-md bg-red-100 px-2 py-1 text-xs text-red-800">Failed</span>
                    ) : isProcessing ? (
                      <span className="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-800">Processing…</span>
                    ) : (
                      <AuditScoreBadge score={summary?.score} />
                    )}
                    <span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  {isFailed && (r as any).error && (
                    <p className="mt-2 text-xs text-red-600">{(r as any).error}</p>
                  )}
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
