import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import SubmitButton from "./submit-button";
import DownloadReport from "./download-report";
import GraftIntegrityCard from "@/app/dashboard/patient/GraftIntegrityCard";
import GraftIntegrityReviewPanel from "@/app/dashboard/auditor/GraftIntegrityReviewPanel";
import AuditorRerunPanel from "./AuditorRerunPanel";
import DoctorAnswersSummary from "@/components/reports/DoctorAnswersSummary";
import PatientAnswersSummary from "@/components/reports/PatientAnswersSummary";
import EvidenceSummary from "@/components/reports/EvidenceSummary";
import CompletenessIndexCard from "@/components/reports/CompletenessIndexCard";
import DoctorScoringNarrativeCard from "@/components/reports/DoctorScoringNarrativeCard";
import { mapLegacyDoctorAnswers } from "@/lib/doctorAuditSchema";
import { normalizeIntakeFormData } from "@/lib/intake/normalizeIntakeFormData";
import DomainIntelligenceAccordion from "@/components/reports/DomainIntelligenceAccordion";
import AuditorReviewPanel from "@/components/reports/AuditorReviewPanel";
import VersionHistoryDrawer from "@/components/reports/VersionHistoryDrawer";
import UploadThumbnailGallery from "@/components/reports/UploadThumbnailGallery";
import LatestReportCard from "@/components/reports/LatestReportCard";
import InviteClinicContributionCard from "@/components/case/InviteClinicContributionCard";

import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRole, USER_ROLES } from "@/lib/roles";
import { resolveAuditorRole } from "@/lib/auth/isAuditor";

function scoreChipClass(score: number | null | undefined) {
  if (typeof score !== "number") return "border-slate-300/25 bg-slate-300/10 text-slate-100";
  if (score >= 85) return "border-emerald-300/40 bg-emerald-300/20 text-emerald-100";
  if (score >= 70) return "border-lime-300/40 bg-lime-300/20 text-lime-100";
  if (score >= 55) return "border-amber-300/40 bg-amber-300/20 text-amber-100";
  return "border-rose-300/40 bg-rose-300/20 text-rose-100";
}

function barClass(score: number) {
  if (score >= 85) return "bg-gradient-to-r from-emerald-300 to-lime-300";
  if (score >= 70) return "bg-gradient-to-r from-cyan-300 to-emerald-300";
  if (score >= 55) return "bg-gradient-to-r from-amber-300 to-yellow-300";
  return "bg-gradient-to-r from-rose-300 to-amber-300";
}

export default async function Page({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
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

  let role = parseRole((user.user_metadata as Record<string, unknown>)?.role) || "patient";
  try {
    const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
    role = resolveAuditorRole({
      profileRole: profile?.role,
      userMetadataRole: (user.user_metadata as Record<string, unknown>)?.role,
      userEmail: user.email,
    });
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

  // Optional feature: graft integrity must never break case page
  let graftIntegrityEstimate: any = null;
  try {
    const giiRes = await db
      .from("graft_integrity_estimates")
      .select(
        "id, case_id, claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, variance_claimed_vs_extracted_min_pct, variance_claimed_vs_extracted_max_pct, confidence, confidence_label, evidence_sufficiency_score, inputs_used, limitations, flags, ai_notes, auditor_status, auditor_notes, auditor_adjustments, audited_by, audited_at, created_at, updated_at"
      )
      .eq("case_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!giiRes.error) graftIntegrityEstimate = giiRes.data;
  } catch {
    /* table may not exist */
  }

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

  // Case-scoped access flags (auditor sees all)
  const isAuditor = role === "auditor";
  const isPatientForCase = user.id === c.user_id || user.id === c.patient_id;
  const isDoctorForCase = user.id === c.doctor_id;
  const isClinicForCase = user.id === c.clinic_id;

  const showPatientFlow = isAuditor || isPatientForCase;
  const showDoctorFlow = isAuditor || isDoctorForCase;
  const showClinicFlow = isAuditor || isClinicForCase;

  const status = String(c.status ?? "draft");
  const statusPill =
    status === "complete"
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
      : status === "submitted"
        ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
        : status === "audit_failed"
          ? "border-rose-300/20 bg-rose-300/10 text-rose-200"
          : "border-white/10 bg-white/5 text-slate-200/80";

  const latestReport = reports?.[0] ?? null;
  const latestSummary = (latestReport?.summary as Record<string, unknown>) ?? {};
  const forensic = (latestSummary?.forensic_audit as Record<string, unknown> | null | undefined) ?? null;
  const domainV1 = forensic && typeof forensic === "object" ? ((forensic as any).domain_scores_v1 as { domains?: unknown[] } | null | undefined) : null;
  const domains = Array.isArray(domainV1?.domains) ? (domainV1?.domains as any[]) : [];
  const benchmark = (forensic as any)?.benchmark as { eligible?: boolean; reasons?: string[] } | undefined;
  const overallScores = (forensic as any)?.overall_scores_v1 as
    | { performance_score?: number; confidence_grade?: string; confidence_multiplier?: number; benchmark_score?: number }
    | undefined;
  const completenessIndex = (forensic as any)?.completeness_index_v1 ?? null;
  const reportScore = typeof latestSummary?.score === "number" ? latestSummary.score : overallScores?.performance_score;

  const reportPatientAnswers =
    latestReport?.patient_audit_version === 2 && latestReport?.patient_audit_v2 && Object.keys(latestReport.patient_audit_v2).length > 0
      ? latestReport.patient_audit_v2
      : ((latestSummary?.patient_answers as Record<string, unknown> | undefined) ?? null);
  const normalizedPatient = reportPatientAnswers ? (normalizeIntakeFormData(reportPatientAnswers) as Record<string, unknown>) : null;
  const monthLabels: Record<string, string> = { under_3: "<3 mo", "3_6": "3-6 mo", "6_9": "6-9 mo", "9_12": "9-12 mo", "12_plus": "12+ mo" };
  const clinicLabel = normalizedPatient?.clinic_name ? String(normalizedPatient.clinic_name) : "Unknown clinic";
  const doctorLabel = normalizedPatient?.doctor_name
    ? String(normalizedPatient.doctor_name)
    : normalizedPatient?.surgeon_name
      ? String(normalizedPatient.surgeon_name)
      : "";
  const procedureDate = normalizedPatient?.procedure_date ? String(normalizedPatient.procedure_date) : "Not provided";
  const monthsPostOp = normalizedPatient?.months_since ? (monthLabels[String(normalizedPatient.months_since)] ?? String(normalizedPatient.months_since)) : "Not provided";
  const confidenceLabel = overallScores?.confidence_grade ?? c.confidence_label_doctor ?? c.confidence_label_patient ?? "pending";

  const uploadEntryPath = showDoctorFlow
    ? `/cases/${c.id}/doctor/photos`
    : showClinicFlow
      ? `/cases/${c.id}/clinic/photos`
      : `/cases/${c.id}/patient/photos`;
  const continuePath = showPatientFlow
    ? `/cases/${c.id}/patient/questions`
    : showDoctorFlow
      ? `/cases/${c.id}/doctor/form`
      : showClinicFlow
        ? `/cases/${c.id}/clinic/form`
        : `/cases/${c.id}`;

  return (
    <div className="mx-auto mt-4 max-w-[1200px] rounded-3xl border border-slate-800 bg-slate-950 px-4 pb-10 pt-4 shadow-2xl sm:px-6">
      <Link
        href={dashboardPath}
        className="inline-flex items-center text-sm font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
      >
        ← Back to dashboard
      </Link>

      <section className="relative mt-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="relative grid gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Forensic AI Workspace</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">{c.title ?? "Untitled case"}</h1>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase ${statusPill}`}>
              {status.replaceAll("_", " ")}
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10">
                <p className="text-xs uppercase tracking-wide text-slate-400">Case ID</p>
                <p className="mt-1 truncate font-mono text-sm text-slate-100">{c.id}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10">
                <p className="text-xs uppercase tracking-wide text-slate-400">Clinic</p>
                <p className="mt-1 text-sm text-slate-100">{clinicLabel}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10">
                <p className="text-xs uppercase tracking-wide text-slate-400">Procedure Date</p>
                <p className="mt-1 text-sm text-slate-100">{procedureDate}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10">
                <p className="text-xs uppercase tracking-wide text-slate-400">Months Post-op</p>
                <p className="mt-1 text-sm text-slate-100">{monthsPostOp}</p>
              </div>
              <div className={`rounded-xl border p-3 ${scoreChipClass(typeof reportScore === "number" ? reportScore : null)}`}>
                <p className="text-xs uppercase tracking-wide text-slate-400">Score</p>
                <p className="mt-1 text-lg font-semibold text-white">{reportScore ?? "Pending"}</p>
              </div>
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Confidence</p>
                <p className="mt-1 text-sm font-medium text-cyan-200">{String(confidenceLabel).toUpperCase()}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href={continuePath}
                className="inline-flex items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:bg-cyan-300/25"
              >
                Continue Questions
              </Link>
              <Link
                href={uploadEntryPath}
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-slate-100 transition-all hover:-translate-y-0.5 hover:bg-white/15"
              >
                Upload Evidence
              </Link>
              <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Run Audit</p>
                <SubmitButton caseId={c.id} caseStatus={c.status ?? "draft"} submittedAt={c.submitted_at} compact />
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm">
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Download Report</p>
                {latestReport?.pdf_path ? <DownloadReport pdfPath={latestReport.pdf_path} /> : <p className="text-xs text-slate-300/70">No PDF yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {role === "auditor" && c.status === "audit_failed" && (
        <div className="mt-6 p-5 rounded-2xl border border-rose-300/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <h2 className="font-semibold text-white mb-2">Manual audit required</h2>
          <p className="text-sm text-slate-200/70 mb-3">
            The automated audit failed. Complete a manual audit to finalize this case.
          </p>
          <Link
            href={`/cases/${c.id}/audit`}
            className="inline-flex items-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 bg-gradient-to-r from-rose-300 to-amber-200 hover:from-rose-200 hover:to-amber-100 transition-colors"
          >
            Complete manual audit →
          </Link>
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Contribution Paths</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {showPatientFlow && (
            <Link
              href={`/cases/${c.id}/patient/questions`}
              className="inline-flex items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-300/15 px-4 py-3 text-sm font-semibold text-cyan-100"
            >
              Patient Questions
            </Link>
          )}
          {showDoctorFlow && (
            <Link
              href={`/cases/${c.id}/doctor/form`}
              className="inline-flex items-center justify-center rounded-xl border border-blue-300/35 bg-blue-300/15 px-4 py-3 text-sm font-semibold text-blue-100"
            >
              Doctor Form
            </Link>
          )}
          {showClinicFlow && (
            <Link
              href={`/cases/${c.id}/clinic/form`}
              className="inline-flex items-center justify-center rounded-xl border border-emerald-300/35 bg-emerald-300/15 px-4 py-3 text-sm font-semibold text-emerald-100"
            >
              Clinic Form
            </Link>
          )}
        </div>
      </section>

      {isPatientForCase && (
        <InviteClinicContributionCard
          caseId={c.id}
          disabled={Boolean(c.submitted_at) || c.status === "submitted"}
          defaultClinicName={clinicLabel === "Unknown clinic" ? "" : clinicLabel}
          defaultDoctorName={doctorLabel}
        />
      )}

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="grid gap-6">
          <EvidenceSummary caseRow={c} uploads={uploads ?? []} />
          <CompletenessIndexCard ci={completenessIndex} />
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-white">Intelligence Dashboard</h2>
          <p className="mt-1 text-sm text-slate-300/80">Domain signal strengths and benchmark readiness.</p>

          <div className="mt-4 space-y-3">
            {domains.length > 0 ? (
              domains.map((domain) => {
                const weighted = Math.round(Number((domain as any).weighted_score ?? 0));
                const confidence = Math.round(Number((domain as any).confidence ?? 0) * 100);
                return (
                  <div key={(domain as any).domain_id} className="rounded-lg border border-slate-700 bg-slate-800/80 p-3 transition-colors hover:bg-slate-800">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">
                        {(domain as any).domain_id} - {(domain as any).title}
                      </p>
                      <span className="rounded-md border border-cyan-300/35 bg-cyan-300/15 px-2 py-0.5 text-xs font-semibold text-cyan-100">
                        {weighted}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-700/70">
                      <div className={`h-full rounded-full ${barClass(weighted)}`} style={{ width: `${Math.max(5, Math.min(100, weighted))}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-300/80">Confidence {confidence}%</p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-300/70">No domain data available yet.</p>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Evidence Confidence Multiplier</p>
              <p className="mt-1 text-lg font-semibold text-cyan-100">
                {typeof overallScores?.confidence_multiplier === "number" ? overallScores.confidence_multiplier.toFixed(2) : "N/A"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Benchmark Eligibility</p>
              <p className={`mt-1 text-sm font-semibold ${benchmark?.eligible ? "text-emerald-200" : "text-slate-200"}`}>
                {benchmark?.eligible ? "Eligible" : "Not Eligible"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Graft Integrity: auditor sees full review panel; patient sees approved/pending card */}
      {isAuditor && (
        <div className="mt-6 rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5">
          <h2 className="font-semibold text-white mb-4">Graft Integrity Review</h2>
          <GraftIntegrityReviewPanel
            cases={[c] as any}
            initialEstimates={graftIntegrityEstimate ? [graftIntegrityEstimate] : []}
            emptyMessage="No Graft Integrity estimate generated yet for this case."
          />
        </div>
      )}
      {isPatientForCase && (
        <div className="mt-6">
          <GraftIntegrityCard caseId={c.id} initialEstimate={graftIntegrityEstimate} />
        </div>
      )}

      {isAuditor && reports && reports.length > 0 && (
        <div className="mt-6">
          <AuditorRerunPanel caseId={c.id} latestReportVersion={(reports[0] as any)?.version} />
        </div>
      )}

      {domains.length > 0 && (
        <div className="mt-6">
          {isAuditor && latestReport ? (
            <AuditorReviewPanel
              caseId={c.id}
              reportId={latestReport.id}
              domains={domains as any}
              benchmark={benchmark}
              overallScores={overallScores}
            />
          ) : (
            <DomainIntelligenceAccordion domains={domains as any} />
          )}
        </div>
      )}

      {latestReport && (() => {
        const latest = latestReport;
        const summary = latest?.summary as Record<string, unknown> | undefined;
        const raw = summary?.doctor_answers as Record<string, unknown> | undefined;
        const doctorAnswers = raw ? mapLegacyDoctorAnswers(raw) : null;
        const scoring = (raw as any)?.scoring ?? null;
        const scoringVersion = (raw as any)?.scoring_version ?? null;
        const scoringGeneratedAt = (raw as any)?.scoring_generated_at ?? null;
        const aiContext = (raw as any)?.ai_context ?? null;
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
            {(scoring && typeof scoring === "object") && (
              <DoctorScoringNarrativeCard
                scoring={scoring as any}
                scoringVersion={scoringVersion as any}
                generatedAt={scoringGeneratedAt as any}
                aiContext={aiContext as any}
              />
            )}
            {hasPatient && (
              <div className="mt-6">
                <PatientAnswersSummary answers={patientAnswers!} />
              </div>
            )}
          </>
        );
      })()}

      <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Latest Report</h2>
            {repErr && <p className="text-sm text-rose-300">{repErr.message}</p>}
          </div>
          {reports && reports.length > 0 && <VersionHistoryDrawer reports={reports as any} />}
        </div>
        <div className="mt-4">
          <LatestReportCard report={latestReport as any} />
        </div>
      </section>

      {upErr && <p className="mt-6 text-sm text-rose-300">{upErr.message}</p>}
      <div className="mt-6">
        <UploadThumbnailGallery uploads={(uploads ?? []) as any} />
      </div>
    </div>
  );
}
