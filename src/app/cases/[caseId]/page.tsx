import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import SubmitButton from "./submit-button";
import DownloadReport from "./download-report";
import AuditScoreBadge from "@/components/reports/AuditScoreBadge";
import GraftIntegrityCard from "@/app/dashboard/patient/GraftIntegrityCard";
import GraftIntegrityReviewPanel from "@/app/dashboard/auditor/GraftIntegrityReviewPanel";
import DoctorAnswersSummary from "@/components/reports/DoctorAnswersSummary";
import PatientAnswersSummary from "@/components/reports/PatientAnswersSummary";
import EvidenceSummary from "@/components/reports/EvidenceSummary";
import ScoreAreaGraph from "@/components/reports/ScoreAreaGraph";
import DomainScoreCards from "@/components/reports/DomainScoreCards";
import CompletenessIndexCard from "@/components/reports/CompletenessIndexCard";
import DoctorScoringNarrativeCard from "@/components/reports/DoctorScoringNarrativeCard";
import rubric from "@/lib/audit/rubrics/hairaudit_clinical_v1.json";
import { buildRubricTitles } from "@/lib/audit/rubricTitles";
import { mapLegacyDoctorAnswers } from "@/lib/doctorAuditSchema";

import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRole, USER_ROLES } from "@/lib/roles";
import { resolveAuditorRole } from "@/lib/auth/isAuditor";

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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <Link
        href={dashboardPath}
        className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        ← Back to dashboard
      </Link>

      <section className="relative mt-4 overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-wider text-slate-300/70 uppercase">Surgical Intelligence Case</p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
                {c.title ?? "Untitled case"}
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-200/70 max-w-2xl">
                Complete contributions to unlock the highest-confidence forensic audit.
              </p>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusPill}`}>
              {status}
            </span>
          </div>

          {showPatientFlow && (
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <Link
                href={`/cases/${c.id}/patient/questions`}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 transition-colors shadow-sm"
              >
                Continue Intelligence Questions
              </Link>
              <Link
                href={`/cases/${c.id}/patient/photos`}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-200 border border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur transition-colors"
              >
                Add / review photos
              </Link>
            </div>
          )}
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

      {/* 3-step flow: 1. Information → 2. Photos → 3. Submit */}
      {showPatientFlow && (
        <div className="mt-6 p-5 rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <h2 className="font-semibold text-white mb-4">Patient contribution</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/cases/${c.id}/patient/questions`}
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 transition-colors"
            >
              1. Intelligence questions
            </Link>
            <Link
              href={`/cases/${c.id}/patient/photos`}
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-200 border border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur transition-colors"
            >
              2. Add your photos
            </Link>
          </div>
        </div>
      )}

      {showDoctorFlow && (
        <div className="mt-6 p-5 rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <h2 className="font-semibold text-white mb-4">Doctor contribution</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/cases/${c.id}/doctor/form`}
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 bg-gradient-to-r from-blue-300 to-cyan-200 hover:from-blue-200 hover:to-cyan-100 transition-colors"
            >
              1. Complete your information
            </Link>
            <Link
              href={`/cases/${c.id}/doctor/photos`}
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-200 border border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur transition-colors"
            >
              2. Add your photos
            </Link>
          </div>
        </div>
      )}

      {showClinicFlow && (
        <div className="mt-6 p-5 rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <h2 className="font-semibold text-white mb-4">Clinic contribution</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/cases/${c.id}/clinic/form`}
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 bg-gradient-to-r from-emerald-300 to-cyan-200 hover:from-emerald-200 hover:to-cyan-100 transition-colors"
            >
              1. Complete your information
            </Link>
            <Link
              href={`/cases/${c.id}/clinic/photos`}
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-200 border border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur transition-colors"
            >
              2. Add your photos
            </Link>
          </div>
        </div>
      )}

      {(showPatientFlow || showDoctorFlow || showClinicFlow) && (
        <div className="mt-6 p-5 rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <h2 className="font-semibold text-white mb-2">3. Submit for audit</h2>
          <SubmitButton caseId={c.id} caseStatus={c.status ?? "draft"} submittedAt={c.submitted_at} />
        </div>
      )}

      <div className="mt-6">
        <EvidenceSummary caseRow={c} uploads={uploads ?? []} />
      </div>

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

      {reports && reports.length > 0 && (() => {
        const latest = reports[0];
        const summary = (latest?.summary as Record<string, unknown>) ?? {};
        const forensic = (summary?.forensic_audit as Record<string, unknown> | null | undefined) ?? null;
        const v1 = forensic && typeof forensic === "object"
          ? ((forensic as any).domain_scores_v1 as { domains?: unknown[] } | null | undefined)
          : null;
        const domains = Array.isArray(v1?.domains) ? (v1!.domains as any[]) : [];
        const benchmark = (forensic as any)?.benchmark as any;
        const overallScores = (forensic as any)?.overall_scores_v1 as any;
        const tiers = (forensic as any)?.tiers_v1 as any[] | undefined;
        if (!domains.length) return null;
        return (
          <div className="mt-6">
            <DomainScoreCards domains={domains as any} benchmark={benchmark as any} overallScores={overallScores as any} />
            {Array.isArray(tiers) && tiers.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5">
                <h3 className="font-semibold text-white">Submission Tier (v1)</h3>
                <p className="mt-1 text-sm text-slate-300/80">Based on submitted documentation.</p>
                <div className="mt-3 grid gap-2">
                  {tiers.slice(0, 3).map((t) => (
                    <div key={t.tier_id} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                      <div>
                        <div className="font-semibold text-white">{t.title}</div>
                        {Array.isArray(t.reasons) && t.reasons.length > 0 && (
                          <div className="text-xs text-slate-300/80 mt-1">{t.reasons[0]}</div>
                        )}
                      </div>
                      <div className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${t.eligible ? "bg-emerald-300/20 text-emerald-200" : "bg-slate-700/70 text-slate-200"}`}>
                        {t.eligible ? "Eligible" : "Not yet"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {reports && reports.length > 0 && (() => {
        const latest = reports[0];
        const summary = (latest?.summary as Record<string, unknown>) ?? {};
        const forensic = (summary?.forensic_audit as any) ?? null;
        const ci = forensic?.completeness_index_v1 ?? null;
        if (!ci) return null;
        return (
          <div className="mt-6">
            <CompletenessIndexCard ci={ci} />
          </div>
        );
      })()}

      {reports && reports.length > 0 && (() => {
        const latest = reports[0];
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

      <div className="mt-6 rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5">
        <h2 className="font-semibold text-white mb-2">Reports</h2>
        {repErr && <p className="text-rose-300 text-sm">❌ {repErr.message}</p>}
        {!reports || reports.length === 0 ? (
          <p className="text-slate-300/80 text-sm">No report yet. Submit the case to trigger audit.</p>
        ) : (
          <ul className="space-y-4">
            {reports.map((r) => {
              const summary = (r.summary ?? {}) as { score?: number };
              const isProcessing = !r.pdf_path && (r as any).status !== "failed";
              const isFailed = (r as any).status === "failed";
              return (
                <li key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-white">Report v{r.version}</b>
                    {isFailed ? (
                      <span className="rounded-md bg-rose-300/20 px-2 py-1 text-xs text-rose-200">Failed</span>
                    ) : isProcessing ? (
                      <span className="rounded-md bg-amber-300/20 px-2 py-1 text-xs text-amber-200">Processing…</span>
                    ) : (
                      <AuditScoreBadge score={summary?.score} />
                    )}
                    <span className="text-xs text-slate-300/70">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  {isFailed && (r as any).error && (
                    <p className="mt-2 text-xs text-rose-300">{(r as any).error}</p>
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

      <div className="mt-6 rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5">
        <h2 className="font-semibold text-white mb-2">Uploaded files</h2>
        {upErr && <p className="text-rose-300 text-sm">❌ {upErr.message}</p>}
        {!uploads || uploads.length === 0 ? (
          <p className="text-slate-300/80 text-sm">No uploads yet.</p>
        ) : (
          <ul className="space-y-2">
            {uploads.map((u) => (
              <li key={u.id} className="text-sm text-slate-200">
                <span className="font-medium text-white">{u.type}</span>
                <span className="text-slate-300/70 ml-2">{u.storage_path}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
