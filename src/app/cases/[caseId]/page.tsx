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
import CaseReadinessCard from "@/components/reports/CaseReadinessCard";
import { getCompletedCategories, getRequiredKeys } from "@/lib/auditPhotoSchemas";
import DoctorScoringNarrativeCard from "@/components/reports/DoctorScoringNarrativeCard";
import { mapLegacyDoctorAnswers } from "@/lib/doctorAuditSchema";
import { normalizeIntakeFormData } from "@/lib/intake/normalizeIntakeFormData";
import DomainIntelligenceAccordion from "@/components/reports/DomainIntelligenceAccordion";
import AuditorReviewPanel from "@/components/reports/AuditorReviewPanel";
import { isAuditorReviewAvailable } from "@/lib/auditor/eligibility";
import { applyAuditorOverridesToSummary, type OverrideRow } from "@/lib/auditor/applyOverrides";
import UnlockAuditorReviewButton from "./UnlockAuditorReviewButton";
import VersionHistoryDrawer from "@/components/reports/VersionHistoryDrawer";
import UploadThumbnailGallery from "@/components/reports/UploadThumbnailGallery";
import LatestReportCard from "@/components/reports/LatestReportCard";
import InviteClinicContributionCard from "@/components/case/InviteClinicContributionCard";
import ForensicCaseTimelineViewer from "@/components/reports/ForensicCaseTimelineViewer";
import PatientNextActionPanel from "@/components/patient/PatientNextActionPanel";
import PatientSafeSummaryShell from "@/components/patient/PatientSafeSummaryShell";
import { BENCHMARKING_GLOBAL_STANDARDS } from "@/lib/benchmarkingCopy";
import CaseNotFoundRecovery from "@/components/case/CaseNotFoundRecovery";
import PatientImageEvidenceQualityPanel from "@/components/reports/PatientImageEvidenceQualityPanel";
import { computePatientImageEvidenceQualityFromCaseUploads } from "@/lib/audit/patientImageEvidenceConfidence";
import { isInternalImageEvidenceQualityPanelEnabled } from "@/lib/features/enableInternalImageEvidenceQualityPanel";
import { buildClinicEvidencePromptsFromSufficiency } from "@/lib/audit/clinicEvidencePromptsFromSufficiency";
import type { ClinicEvidencePrompt } from "@/lib/audit/clinicEvidencePromptsFromSufficiency";
import { buildFollowupTimelineFromPatientUploads } from "@/lib/audit/followupTimelineFromPatientUploads";
import type { FollowupTimelineResult } from "@/lib/audit/followupTimelineFromPatientUploads";
import { isClinicEvidencePromptsEnabled } from "@/lib/features/enableClinicEvidencePrompts";
import { isFollowupTimelineEnabled } from "@/lib/features/enableFollowupTimeline";
import ClinicEvidencePromptPanel from "@/components/clinic/ClinicEvidencePromptPanel";
import FollowupTimelinePanel from "@/components/clinic/FollowupTimelinePanel";
import FollowupReminderReadinessPanel from "@/components/clinic/FollowupReminderReadinessPanel";
import { buildFollowupReminderReadinessFromTimeline } from "@/lib/audit/followupReminderReadinessFromTimeline";
import type { FollowupReminderReadiness } from "@/lib/audit/followupReminderReadinessFromTimeline";
import { isClinicFollowupReminderReadinessEnabled } from "@/lib/features/enableFollowupReminderReadiness";
import { isClinicFollowupReminderDraftsEnabled } from "@/lib/features/enableFollowupReminderDrafts";
import { buildFollowupReminderDraftsFromReadiness } from "@/lib/audit/followupReminderDraftsFromReadiness";
import type { FollowupReminderDraft } from "@/lib/audit/followupReminderDraftsFromReadiness";
import FollowupReminderDraftsPanel from "@/components/clinic/FollowupReminderDraftsPanel";
import FollowupReminderManualSendPanel from "@/components/clinic/FollowupReminderManualSendPanel";
import { isClinicFollowupManualSendEnabled } from "@/lib/features/enableFollowupReminderManualSend";
import type { FollowupReminderSendLogRow } from "@/lib/audit/followupReminderSendPayload";

import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRole, USER_ROLES } from "@/lib/roles";
import { resolveAuditorRole } from "@/lib/auth/isAuditor";
import { isMissingFeatureError } from "@/lib/db/isMissingFeatureError";
import { getTranslation } from "@/lib/i18n/getTranslation";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import { buildPatientSafeSummaryObservations } from "@/lib/reports/patientSafeSummary";
import { resolvePublicSeoLocale } from "@/lib/seo/localeMetadata";

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

function monthsFromBucket(value: string | null | undefined): number | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const map: Record<string, number> = {
    under_3: 2,
    "3_6": 4.5,
    "6_9": 7.5,
    "9_12": 10.5,
    "12_plus": 12.5,
  };
  return map[v] ?? null;
}

function monthsFromProcedureDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  return Math.max(0, months);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams?: Promise<{ from?: string }> | { from?: string };
}) {
  const { caseId } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const fromContributionRequests = resolvedSearchParams?.from === "contribution-requests";
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

  const seoLocale = await resolvePublicSeoLocale();
  const tr = (key: TranslationKey) => getTranslation(key, seoLocale);

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

  const usedAdmin = !!admin;
  const LOG_PREFIX = "[cases/page]";

  // Minimal columns needed for ownership and draft display; safe if newer columns are missing.
  const CASE_SELECT_MINIMAL =
    "id, title, status, created_at, user_id, submitted_at, patient_id, doctor_id, clinic_id, audit_type, submission_channel, visibility_scope";

  let c: { id: string; title?: string; status?: string; created_at?: string; user_id?: string; submitted_at?: string | null; patient_id?: string | null; doctor_id?: string | null; clinic_id?: string | null; audit_type?: "patient" | "doctor" | "clinic" | null; submission_channel?: string | null; visibility_scope?: string | null; rerun_count?: number | null; last_rerun_at?: string | null; last_rerun_by?: string | null; evidence_score_patient?: string | null; confidence_label_patient?: string | null; evidence_score_doctor?: string | null; confidence_label_doctor?: string | null; evidence_details?: Record<string, unknown> | null } | null;
  let caseRes: any;
  try {
    caseRes = await db
      .from("cases")
      .select("id, title, status, created_at, user_id, submitted_at, patient_id, doctor_id, clinic_id, audit_type, submission_channel, visibility_scope, rerun_count, last_rerun_at, last_rerun_by, evidence_score_patient, confidence_label_patient, evidence_score_doctor, confidence_label_doctor, evidence_details")
      .eq("id", caseId)
      .maybeSingle();
  } catch (e) {
    console.error(LOG_PREFIX, "cases select threw", { caseId, userId: user.id, role, usedAdmin, error: e });
    throw e;
  }

  if (caseRes.error) {
    console.warn(LOG_PREFIX, "cases select error; trying minimal fallback", {
      caseId,
      userId: user.id,
      role,
      usedAdmin,
      queryError: caseRes.error.message,
      queryCode: caseRes.error.code,
    });
    const fallback = await db
      .from("cases")
      .select(CASE_SELECT_MINIMAL)
      .eq("id", caseId)
      .maybeSingle();
    if (fallback.error) {
      console.error(LOG_PREFIX, "minimal fallback also failed", {
        caseId,
        userId: user.id,
        usedAdmin,
        fallbackError: fallback.error.message,
      });
    }
    c = fallback.data ?? null;
  } else {
    c = caseRes.data;
  }

  console.info(LOG_PREFIX, "case load result", {
    caseId,
    userId: user.id,
    role,
    usedAdmin,
    hasCase: !!c,
    caseUserId: c?.user_id,
    casePatientId: c?.patient_id,
    caseStatus: c?.status,
  });

  const allowed =
    Boolean(c) &&
    (c!.user_id === user.id ||
      c!.patient_id === user.id ||
      c!.doctor_id === user.id ||
      c!.clinic_id === user.id ||
      role === "auditor");

  const dashboardPath =
    role === "doctor"
      ? "/dashboard/doctor"
      : role === "clinic"
        ? "/dashboard/clinic"
        : role === "auditor"
          ? "/dashboard/auditor"
          : "/dashboard/patient";

  if (!c) {
    console.error("[case_not_found] case overview", {
      caseId,
      userId: user.id,
      role,
      usedAdmin,
      queryError: caseRes?.error?.message ?? null,
      queryCode: caseRes?.error?.code ?? null,
    });

    let hasOtherCases = false;
    try {
      const { data: otherCases } = await db
        .from("cases")
        .select("id")
        .or(`patient_id.eq.${user.id},and(user_id.eq.${user.id},patient_id.is.null)`)
        .limit(1);
      hasOtherCases = (otherCases ?? []).length > 0;
    } catch {
      // If this check fails, we still want to render the recovery UI.
    }

    return (
      <CaseNotFoundRecovery
        dashboardHref={dashboardPath}
        startNewHref={dashboardPath}
        showExistingCasesLink={hasOtherCases}
        existingCasesHref="/dashboard/patient"
      />
    );
  }

  if (!allowed) {
    redirect(dashboardPath);
  }

  // In development, allow dev_role cookie to override
  if (process.env.NODE_ENV === "development") {
    const cookieStore = await cookies();
    const devRole = cookieStore.get("dev_role")?.value;
    if (devRole && USER_ROLES.includes(devRole as any)) {
      role = devRole as typeof role;
    }
  }

  const { data: uploads, error: upErr } = await db
    .from("uploads")
    .select("id, type, storage_path, created_at")
    .eq("case_id", c.id)
    .order("created_at", { ascending: false });

  // Optional feature: graft integrity must never break case page
  let graftIntegrityEstimate: any = null;
  try {
    const giiSelectWithEvidence =
      "id, case_id, claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, variance_claimed_vs_extracted_min_pct, variance_claimed_vs_extracted_max_pct, confidence, confidence_label, evidence_sufficiency_score, inputs_used, limitations, flags, ai_notes, auditor_status, auditor_notes, auditor_adjustments, audited_by, audited_at, created_at, updated_at";
    const giiSelectFallback =
      "id, case_id, claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, variance_claimed_vs_extracted_min_pct, variance_claimed_vs_extracted_max_pct, confidence, confidence_label, inputs_used, limitations, flags, ai_notes, auditor_status, auditor_notes, auditor_adjustments, audited_by, audited_at, created_at, updated_at";

    const primaryRes = await db
      .from("graft_integrity_estimates")
      .select(giiSelectWithEvidence)
      .eq("case_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!primaryRes.error) {
      graftIntegrityEstimate = primaryRes.data;
    } else if (isMissingFeatureError(primaryRes.error)) {
      const fallbackRes = await db
        .from("graft_integrity_estimates")
        .select(giiSelectFallback)
        .eq("case_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!fallbackRes.error) graftIntegrityEstimate = fallbackRes.data;
    }
  } catch {
    /* table may not exist */
  }

  // Try with status/error and auditor review columns; fallback if columns don't exist
  let reports: { id: string; version: number; pdf_path: string | null; summary: unknown; created_at: string; status?: string; error?: string | null; patient_audit_version?: number; patient_audit_v2?: Record<string, unknown> | null; auditor_review_eligibility?: string; auditor_review_status?: string; auditor_review_reason?: string | null; provisional_status?: string; counts_for_awards?: boolean }[] | null = null;
  let repErr: { message: string } | null = null;
  const withStatus = await db
    .from("reports")
    .select("id, version, pdf_path, summary, created_at, status, error, patient_audit_version, patient_audit_v2, auditor_review_eligibility, auditor_review_status, auditor_review_reason, provisional_status, counts_for_awards")
    .eq("case_id", c.id)
    .order("version", { ascending: false });
  if (withStatus.error && (String(withStatus.error.message).includes("status") || String(withStatus.error.message).includes("patient_audit") || String(withStatus.error.message).includes("auditor_review") || String(withStatus.error.message).includes("provisional") || String(withStatus.error.message).includes("does not exist"))) {
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
  let patientImageEvidenceQuality: ReturnType<typeof computePatientImageEvidenceQualityFromCaseUploads> | null = null;
  if (isAuditor && isInternalImageEvidenceQualityPanelEnabled()) {
    try {
      patientImageEvidenceQuality = computePatientImageEvidenceQualityFromCaseUploads(
        (uploads ?? []) as { id?: string | null; type?: string | null; storage_path?: string | null }[]
      );
    } catch (e) {
      console.error(LOG_PREFIX, "patientImageEvidenceQuality compute failed", { caseId, error: e });
    }
  }
  const isPatientForCase = user.id === c.user_id || user.id === c.patient_id;
  const isDoctorForCase = user.id === c.doctor_id;
  const isClinicForCase = user.id === c.clinic_id;

  const clinicEvidencePromptsFlag = isClinicEvidencePromptsEnabled();
  const followupTimelineFlag = isFollowupTimelineEnabled();
  const followupReminderReadinessFlag = isClinicFollowupReminderReadinessEnabled();
  const followupReminderDraftsFlag = isClinicFollowupReminderDraftsEnabled();
  const followupReminderManualSendFlag = isClinicFollowupManualSendEnabled();
  let clinicEvidencePrompts: ClinicEvidencePrompt[] = [];
  let clinicFollowupTimeline: FollowupTimelineResult | null = null;
  if (isClinicForCase && (clinicEvidencePromptsFlag || followupTimelineFlag || followupReminderReadinessFlag || followupReminderDraftsFlag)) {
    try {
      const patientPhotoUploads = (uploads ?? []).filter((u) => String((u as { type?: string }).type ?? "").startsWith("patient_photo:"));
      const q = computePatientImageEvidenceQualityFromCaseUploads(
        patientPhotoUploads as { id?: string | null; type?: string | null; storage_path?: string | null }[]
      );
      if (clinicEvidencePromptsFlag) {
        clinicEvidencePrompts = buildClinicEvidencePromptsFromSufficiency(q);
      }
      if (followupTimelineFlag || followupReminderReadinessFlag || followupReminderDraftsFlag) {
        clinicFollowupTimeline = buildFollowupTimelineFromPatientUploads(patientPhotoUploads);
      }
    } catch (e) {
      console.error(LOG_PREFIX, "clinic stage 8 evidence compute failed", { caseId, error: e });
    }
  }

  const showClinicEvidencePromptPanel =
    isClinicForCase && clinicEvidencePromptsFlag && clinicEvidencePrompts.length > 0;
  const showFollowupTimelinePanel = isClinicForCase && followupTimelineFlag && clinicFollowupTimeline !== null;

  const showPatientFlow = isAuditor || isPatientForCase;
  const showDoctorFlow = isAuditor || isDoctorForCase;
  const showClinicFlow = isAuditor || isClinicForCase;

  const status = String(c.status ?? "draft");
  const hasReportPdf = !!(reports?.[0] as { pdf_path?: string } | null)?.pdf_path;
  const isCompleteWithReport = status === "complete" && hasReportPdf;
  const isProcessing = status === "submitted" || status === "processing";
  const statusDisplayLabel = isCompleteWithReport
    ? tr("dashboard.reports.statusReportReady")
    : isProcessing
      ? tr("dashboard.reports.statusProcessing")
      : status === "audit_failed"
        ? tr("dashboard.reports.statusAuditFailed")
        : status === "complete"
          ? tr("dashboard.reports.statusComplete")
          : status.replaceAll("_", " ");
  const statusPill =
    isCompleteWithReport
      ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100"
      : status === "complete"
        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
        : status === "submitted" || status === "processing"
          ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
          : status === "audit_failed"
            ? "border-rose-300/20 bg-rose-300/10 text-rose-200"
            : "border-white/10 bg-white/5 text-slate-200/80";

  const latestReport = reports?.[0] ?? null;
  const previousReport = reports?.[1] ?? null;
  const auditorReviewEligibility = (latestReport as { auditor_review_eligibility?: string } | null)?.auditor_review_eligibility;
  const provisionalStatus = (latestReport as { provisional_status?: string } | null)?.provisional_status;
  const countsForAwards = (latestReport as { counts_for_awards?: boolean } | null)?.counts_for_awards;
  const showAuditorReview = isAuditor && latestReport && isAuditorReviewAvailable(auditorReviewEligibility);
  const latestSummary = (latestReport?.summary as Record<string, unknown>) ?? {};
  const previousSummary = (previousReport?.summary as Record<string, unknown>) ?? {};
  const latestDoctorAnswers = (latestSummary?.doctor_answers as Record<string, unknown> | undefined) ?? null;
  const latestClinicAnswers = (latestSummary?.clinic_answers as Record<string, unknown> | undefined) ?? null;
  const previousDoctorAnswers = (previousSummary?.doctor_answers as Record<string, unknown> | undefined) ?? null;
  const previousClinicAnswers = (previousSummary?.clinic_answers as Record<string, unknown> | undefined) ?? null;
  const latestStructuredAnswers = latestDoctorAnswers ?? latestClinicAnswers;
  const previousStructuredAnswers = previousDoctorAnswers ?? previousClinicAnswers;
  const forensic = (latestSummary?.forensic_audit as Record<string, unknown> | null | undefined) ?? null;
  const domainV1 = forensic && typeof forensic === "object" ? ((forensic as any).domain_scores_v1 as { domains?: unknown[] } | null | undefined) : null;
  const domains = Array.isArray(domainV1?.domains) ? (domainV1?.domains as any[]) : [];
  const benchmark = (forensic as any)?.benchmark as { eligible?: boolean; reasons?: string[] } | undefined;
  const overallScores = (forensic as any)?.overall_scores_v1 as
    | { performance_score?: number; confidence_grade?: string; confidence_multiplier?: number; benchmark_score?: number }
    | undefined;
  const completenessIndex = (forensic as any)?.completeness_index_v1 ?? null;
  const reportScore = typeof latestSummary?.score === "number" ? latestSummary.score : overallScores?.performance_score;
  const scoreNum = typeof reportScore === "number" ? reportScore : Number(overallScores?.performance_score ?? overallScores?.benchmark_score ?? 0);

  let latestReportDisplayScore: number | undefined = scoreNum;
  if (latestReport?.id && typeof scoreNum === "number") {
    try {
      const { data: overrideRows } = await db
        .from("audit_score_overrides")
        .select("domain_key, ai_score, ai_weighted_score, manual_score, manual_weighted_score, delta_score")
        .eq("report_id", latestReport.id);
      const overrides = (overrideRows ?? []) as OverrideRow[];
      if (overrides.length > 0) {
        const applied = applyAuditorOverridesToSummary(latestSummary as Record<string, unknown>, overrides);
        const forensicApplied = (applied.forensic_audit ?? applied.forensic) as { overall_scores_v1?: { performance_score?: number } } | undefined;
        const perf = forensicApplied?.overall_scores_v1?.performance_score;
        if (typeof perf === "number") latestReportDisplayScore = perf;
      }
    } catch {
      // Overrides table may not exist or RLS may block; keep scoreNum
    }
  }

  const isHighScore = scoreNum > 90;
  const isHighScoreProvisional = isHighScore && provisionalStatus === "pending_validation";
  const isHighScoreValidated = isHighScore && countsForAwards === true && (provisionalStatus === "validated_by_auditor" || provisionalStatus === "validated_by_evidence" || provisionalStatus === "validated_by_consistency");

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
  const monthsSinceSurgery =
    monthsFromProcedureDate(normalizedPatient?.procedure_date ? String(normalizedPatient.procedure_date) : null) ??
    monthsFromBucket(normalizedPatient?.months_since ? String(normalizedPatient.months_since) : null);

  let clinicFollowupReminderReadiness: FollowupReminderReadiness | null = null;
  if (isClinicForCase && (followupReminderReadinessFlag || followupReminderDraftsFlag) && clinicFollowupTimeline) {
    try {
      clinicFollowupReminderReadiness = buildFollowupReminderReadinessFromTimeline(clinicFollowupTimeline, {
        monthsPostOpEstimate: monthsSinceSurgery,
      });
    } catch (e) {
      console.error(LOG_PREFIX, "followup reminder readiness compute failed", { caseId, error: e });
    }
  }

  let clinicFollowupReminderDrafts: FollowupReminderDraft[] = [];
  if (isClinicForCase && followupReminderDraftsFlag && clinicFollowupReminderReadiness) {
    try {
      clinicFollowupReminderDrafts = buildFollowupReminderDraftsFromReadiness(clinicFollowupReminderReadiness, {
        caseId: c.id,
        generatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error(LOG_PREFIX, "followup reminder drafts compute failed", { caseId, error: e });
    }
  }

  const showFollowupReminderReadinessPanel =
    isClinicForCase &&
    followupReminderReadinessFlag &&
    clinicFollowupReminderReadiness != null &&
    clinicFollowupReminderReadiness.summaryLines.length > 0;
  const showFollowupReminderDraftsPanel =
    isClinicForCase && followupReminderDraftsFlag && clinicFollowupReminderDrafts.length > 0;

  let clinicFollowupReminderSendLog: FollowupReminderSendLogRow[] = [];
  if (isClinicForCase && followupReminderManualSendFlag) {
    try {
      const logRes = await db
        .from("followup_reminder_send_log")
        .select(
          "id, case_id, milestone, channel, recipient, subject, body, sent_by_user_id, sent_at, source, draft_schema_version, delivery_status, error_message"
        )
        .eq("case_id", c.id)
        .order("sent_at", { ascending: false })
        .limit(50);
      if (logRes.error) {
        if (!isMissingFeatureError(logRes.error)) {
          console.error(LOG_PREFIX, "followup_reminder_send_log select failed", logRes.error);
        }
      } else {
        clinicFollowupReminderSendLog = (logRes.data ?? []) as FollowupReminderSendLogRow[];
      }
    } catch (e) {
      console.error(LOG_PREFIX, "followup_reminder_send_log select threw", { caseId, error: e });
    }
  }

  const showFollowupReminderManualSendPanel = isClinicForCase && followupReminderManualSendFlag;

  const auditType = c.audit_type ?? (c.clinic_id ? "clinic" : c.doctor_id ? "doctor" : "patient");
  const auditSource =
    c.visibility_scope === "internal" || c.submission_channel === "imported"
      ? "internal"
      : c.submission_channel === "doctor_submitted"
        ? "doctor"
        : c.submission_channel === "clinic_submitted"
          ? "clinic"
          : c.submission_channel === "patient_submitted"
            ? "patient"
            : auditType;
  const confidenceLabel = overallScores?.confidence_grade ?? c.confidence_label_doctor ?? c.confidence_label_patient ?? "pending";
  const giiLimitations: string[] =
    Array.isArray(graftIntegrityEstimate?.limitations) ? (graftIntegrityEstimate.limitations as string[]) : [];
  const giiNotes = typeof graftIntegrityEstimate?.auditor_notes === "string" ? (graftIntegrityEstimate.auditor_notes as string) : null;
  const summaryObservations = buildPatientSafeSummaryObservations(latestSummary);

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
  const priorityEvidence = {
    preopDonor: (uploads ?? []).filter((u) => String((u as { type?: string }).type ?? "").includes("img_preop_donor_rear")).length,
    postopDonor: (uploads ?? []).filter((u) => String((u as { type?: string }).type ?? "").includes("img_immediate_postop_donor")).length,
    postopRecipient: (uploads ?? []).filter((u) => String((u as { type?: string }).type ?? "").includes("img_immediate_postop_recipient")).length,
    graftTrayCloseup: (uploads ?? []).filter((u) => String((u as { type?: string }).type ?? "").includes("img_graft_tray_closeup")).length,
    followup: (uploads ?? []).filter((u) => {
      const t = String((u as { type?: string }).type ?? "");
      return t.includes("img_followup_front") || t.includes("img_followup_top") || t.includes("img_followup_crown") || t.includes("img_followup_donor");
    }).length,
  };
  const changedFieldsOnly = (() => {
    if (!latestStructuredAnswers || !previousStructuredAnswers) return [] as string[];
    const keys = new Set<string>([
      ...Object.keys(previousStructuredAnswers),
      ...Object.keys(latestStructuredAnswers),
    ]);
    const changed: string[] = [];
    for (const key of keys) {
      if (key === "field_provenance") continue;
      const a = previousStructuredAnswers[key];
      const b = latestStructuredAnswers[key];
      const aa = Array.isArray(a) ? [...a].sort() : a;
      const bb = Array.isArray(b) ? [...b].sort() : b;
      if (JSON.stringify(aa ?? null) !== JSON.stringify(bb ?? null)) changed.push(key);
    }
    return changed.slice(0, 40);
  })();
  const completenessScoreNum =
    typeof (completenessIndex as { score?: number } | null)?.score === "number"
      ? Number((completenessIndex as { score?: number }).score)
      : typeof (completenessIndex as { completeness_score?: number } | null)?.completeness_score === "number"
        ? Number((completenessIndex as { completeness_score?: number }).completeness_score)
        : null;
  const evidenceScoreNum =
    c.evidence_score_doctor != null
      ? Number(c.evidence_score_doctor)
      : c.evidence_score_patient != null
        ? Number(c.evidence_score_patient)
        : null;
  const confidenceEstimateNum =
    typeof overallScores?.confidence_multiplier === "number"
      ? Math.round(overallScores.confidence_multiplier * 100)
      : null;
  const technicalDataSufficiency =
    priorityEvidence.graftTrayCloseup > 0 && priorityEvidence.postopRecipient > 0 && priorityEvidence.postopDonor > 0
      ? "high"
      : priorityEvidence.postopRecipient > 0 || priorityEvidence.postopDonor > 0
        ? "medium"
        : "low";
  const manualAuditReadinessScore = (() => {
    const parts = [completenessScoreNum, evidenceScoreNum, confidenceEstimateNum].filter(
      (v): v is number => typeof v === "number" && !Number.isNaN(v)
    );
    if (!parts.length) return null;
    return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  })();
  const missingCriticalEvidenceFlags = [
    priorityEvidence.preopDonor === 0 ? "missing_preop_donor" : null,
    priorityEvidence.postopDonor === 0 ? "missing_immediate_postop_donor" : null,
    priorityEvidence.postopRecipient === 0 ? "missing_immediate_postop_recipient" : null,
    priorityEvidence.graftTrayCloseup === 0 ? "missing_graft_tray_closeup" : null,
  ].filter((v): v is string => !!v);

  const photoUploads = (uploads ?? []).map((u) => ({ type: (u as { type?: string }).type ?? "" }));
  const doctorCompleted = getCompletedCategories("doctor", photoUploads);
  const patientCompleted = getCompletedCategories("patient", photoUploads);
  const missingDoctorRequired = [...getRequiredKeys("doctor")].filter((k) => !doctorCompleted.has(k));
  const missingPatientRequired = [...getRequiredKeys("patient")].filter((k) => !patientCompleted.has(k));
  const missingRequiredPhotoCategories =
    showDoctorFlow && (uploads ?? []).some((u) => String((u as { type?: string }).type ?? "").startsWith("doctor_photo:"))
      ? missingDoctorRequired
      : missingPatientRequired.length > 0
        ? missingPatientRequired
        : missingDoctorRequired;

  return (
    <div className="mx-auto mt-4 max-w-[1200px] rounded-3xl border border-slate-800 bg-slate-950 px-4 pb-10 pt-4 shadow-2xl sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        {fromContributionRequests && role === "auditor" ? (
          <>
            <Link
              href="/admin/contribution-requests"
              className="inline-flex items-center text-sm font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              ← Return to Contribution Requests
            </Link>
            <span className="text-slate-500">|</span>
            <Link
              href="/dashboard/auditor"
              className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Auditor Dashboard
            </Link>
          </>
        ) : (
          <Link
            href={dashboardPath}
            className="inline-flex items-center text-sm font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
          >
            ← Back to dashboard
          </Link>
        )}
      </div>

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
              {statusDisplayLabel}
            </span>
          </div>

          {showPatientFlow && (
            <PatientNextActionPanel
              status={status}
              caseId={c.id}
              pdfPath={(latestReport as { pdf_path?: string } | null)?.pdf_path}
              variant="case"
            />
          )}

          {isPatientForCase && latestReport && (
            <PatientSafeSummaryShell
              statusLabel={statusDisplayLabel}
              score={latestReportDisplayScore}
              observations={summaryObservations}
            />
          )}

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
                <p className="text-xs uppercase tracking-wide text-slate-400">Audit Source</p>
                <p className="mt-1 text-sm text-slate-100 capitalize">{auditSource}</p>
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
                <p className="mt-1 text-lg font-semibold text-white">
                  {reportScore ?? tr("reports.status.pending")}
                </p>
              </div>
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Confidence</p>
                <p className="mt-1 text-sm font-medium text-cyan-200">{String(confidenceLabel).toUpperCase()}</p>
              </div>
            </div>
            {isHighScoreProvisional && (
              <div className="mt-3 rounded-xl border border-amber-300/40 bg-amber-950/40 px-4 py-3">
                <p className="text-sm font-semibold text-amber-100">High Score (Provisional)</p>
                <p className="mt-1 text-xs text-amber-200/90">Awaiting validation before award contribution.</p>
              </div>
            )}
            {isHighScoreValidated && (
              <div className="mt-3 rounded-xl border border-emerald-300/40 bg-emerald-950/40 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-100">High Score (Validated)</p>
                <p className="mt-1 text-xs text-emerald-200/90">Counts toward clinic awards.</p>
              </div>
            )}

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
                {showPatientFlow ? "Upload Photos" : "Upload Evidence"}
              </Link>
              <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">{tr("reports.chrome.runAuditLabel")}</p>
                <SubmitButton caseId={c.id} caseStatus={c.status ?? "draft"} submittedAt={c.submitted_at} compact />
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm">
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{tr("reports.chrome.downloadReportLabel")}</p>
                {latestReport?.pdf_path ? (
                  <DownloadReport pdfPath={latestReport.pdf_path} label={tr("reports.actions.downloadPdf")} />
                ) : (
                  <p className="text-xs text-slate-300/70">{tr("reports.chrome.noPdfYet")}</p>
                )}
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Rerun Tracking</p>
                <p className="text-xs text-slate-200">rerun_count: {Number(c.rerun_count ?? 0)}</p>
                <p className="text-xs text-slate-300/80">last_rerun_at: {c.last_rerun_at ? new Date(c.last_rerun_at).toLocaleString() : "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isAuditor && (
        <ForensicCaseTimelineViewer
          caseId={c.id}
          auditType={auditType}
          procedureDate={normalizedPatient?.procedure_date ? String(normalizedPatient.procedure_date) : null}
          monthsSinceSurgery={monthsSinceSurgery}
          confidenceLabel={String(confidenceLabel)}
          uploads={(uploads ?? []) as Array<{ id: string; type: string; storage_path: string; created_at?: string }>}
          giiNotes={giiNotes}
          giiLimitations={giiLimitations}
          aiObservations={summaryObservations}
        />
      )}

      {isAuditor && (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <h2 className="text-base font-semibold text-white">Evidence Priority Panel</h2>
            <p className="mt-1 text-xs text-slate-400">High-value evidence coverage for manual readiness.</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between text-slate-200"><dt>Pre-op donor</dt><dd>{priorityEvidence.preopDonor}</dd></div>
              <div className="flex justify-between text-slate-200"><dt>Immediate post-op donor</dt><dd>{priorityEvidence.postopDonor}</dd></div>
              <div className="flex justify-between text-slate-200"><dt>Immediate post-op recipient</dt><dd>{priorityEvidence.postopRecipient}</dd></div>
              <div className="flex justify-between text-slate-200"><dt>Graft tray close-up images</dt><dd>{priorityEvidence.graftTrayCloseup}</dd></div>
              <div className="flex justify-between text-slate-200"><dt>Follow-up front/top/crown/donor</dt><dd>{priorityEvidence.followup}</dd></div>
            </dl>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <h2 className="text-base font-semibold text-white">Follow-up Delta View</h2>
            <p className="mt-1 text-xs text-slate-400">Original surgery baseline versus latest follow-up submission.</p>
            <p className="mt-3 text-sm text-slate-200">Changed fields: {changedFieldsOnly.length}</p>
            {changedFieldsOnly.length > 0 ? (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-700 p-2 text-xs text-slate-300">
                {changedFieldsOnly.map((field) => (
                  <div key={field} className="border-b border-slate-800 py-1 last:border-b-0">
                    {field}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">No explicit field deltas detected between latest and prior report versions.</p>
            )}
            <p className="mt-3 text-xs text-slate-400">Inherited baseline fields are reflected by field provenance tags in submission summaries.</p>
          </div>
        </section>
      )}

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
          defaultClinicName={clinicLabel === "Unknown clinic" ? "" : clinicLabel}
          defaultDoctorName={doctorLabel}
        />
      )}

      {showClinicEvidencePromptPanel ||
      showFollowupTimelinePanel ||
      showFollowupReminderReadinessPanel ||
      showFollowupReminderDraftsPanel ||
      showFollowupReminderManualSendPanel ? (
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          {showClinicEvidencePromptPanel ? <ClinicEvidencePromptPanel prompts={clinicEvidencePrompts} /> : null}
          {showFollowupTimelinePanel && clinicFollowupTimeline ? (
            <FollowupTimelinePanel timeline={clinicFollowupTimeline} />
          ) : null}
          {showFollowupReminderReadinessPanel && clinicFollowupReminderReadiness ? (
            <div className="lg:col-span-2">
              <FollowupReminderReadinessPanel readiness={clinicFollowupReminderReadiness} />
            </div>
          ) : null}
          {showFollowupReminderDraftsPanel ? (
            <div className="lg:col-span-2">
              <FollowupReminderDraftsPanel drafts={clinicFollowupReminderDrafts} />
            </div>
          ) : null}
          {showFollowupReminderManualSendPanel ? (
            <div className="lg:col-span-2">
              <FollowupReminderManualSendPanel
                caseId={c.id}
                drafts={clinicFollowupReminderDrafts}
                initialLog={clinicFollowupReminderSendLog}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="grid gap-6">
          <EvidenceSummary caseRow={c} uploads={uploads ?? []} />
          <CaseReadinessCard
            hasDoctorAnswers={!!latestDoctorAnswers && Object.keys(latestDoctorAnswers).filter((k) => k !== "field_provenance").length > 0}
            hasClinicAnswers={!!latestClinicAnswers && Object.keys(latestClinicAnswers).filter((k) => k !== "field_provenance").length > 0}
            missingRequiredPhotoCategories={missingRequiredPhotoCategories}
            submitterType={showDoctorFlow ? "doctor" : "patient"}
            fieldProvenance={(latestDoctorAnswers?.field_provenance as Record<string, string> | undefined) ?? null}
          />
          <CompletenessIndexCard ci={completenessIndex} />
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-white">Intelligence Dashboard</h2>
          <p className="mt-1 text-sm text-slate-300/80">Domain signal strengths and benchmark readiness.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-xs text-slate-200">Data completeness score: {completenessScoreNum ?? "N/A"}</div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-xs text-slate-200">Evidence score: {evidenceScoreNum ?? "N/A"}</div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-xs text-slate-200">Technical data sufficiency: {technicalDataSufficiency}</div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-xs text-slate-200">Manual audit readiness score: {manualAuditReadinessScore ?? "N/A"}</div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-xs text-slate-200">Confidence estimate: {confidenceEstimateNum != null ? `${confidenceEstimateNum}%` : String(confidenceLabel).toUpperCase()}</div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-xs text-slate-200">
              Missing critical evidence flags: {missingCriticalEvidenceFlags.length ? missingCriticalEvidenceFlags.join(", ") : "none"}
            </div>
          </div>

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

      {patientImageEvidenceQuality && (
        <PatientImageEvidenceQualityPanel result={patientImageEvidenceQuality} />
      )}

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
          {showAuditorReview && latestReport ? (
            <>
              {auditorReviewEligibility === "eligible_low_score" && (
                <div className="mb-4 rounded-xl border border-amber-300/40 bg-amber-950/40 px-4 py-3">
                  <p className="text-sm font-medium text-amber-100">
                    Extreme-score review available: this case scored below 60 and is eligible for optional expert auditor review.
                  </p>
                </div>
              )}
              {auditorReviewEligibility === "eligible_high_score" && (
                <div className="mb-4 rounded-xl border border-emerald-300/40 bg-emerald-950/40 px-4 py-3">
                  <p className="text-sm font-medium text-emerald-100">
                    Recognition-band review available: this case scored above 90 and is eligible for optional expert auditor review.
                  </p>
                </div>
              )}
              {auditorReviewEligibility === "eligible_manual_unlock" && (
                <div className="mb-4 rounded-xl border border-slate-500/40 bg-slate-800/40 px-4 py-3">
                  <p className="text-sm font-medium text-slate-200">
                    Manual review unlocked: this case has been made eligible for optional auditor review by an admin.
                  </p>
                </div>
              )}
              <AuditorReviewPanel
                caseId={c.id}
                reportId={latestReport.id}
                domains={domains as any}
                benchmark={benchmark}
                overallScores={overallScores}
                provisionalStatus={provisionalStatus}
                countsForAwards={countsForAwards}
              />
            </>
          ) : (
            <>
              <DomainIntelligenceAccordion domains={domains as any} />
              {isAuditor && latestReport && !showAuditorReview && (
                <UnlockAuditorReviewButton reportId={latestReport.id} />
              )}
            </>
          )}
        </div>
      )}

      {latestReport && (() => {
        const latest = latestReport;
        const summary = latest?.summary as Record<string, unknown> | undefined;
        const raw = summary?.doctor_answers as Record<string, unknown> | undefined;
        const doctorAnswers = raw ? mapLegacyDoctorAnswers(raw) : null;
        const clinicAnswers = (summary?.clinic_answers as Record<string, unknown> | undefined) ?? null;
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
        const hasClinic = clinicAnswers && Object.keys(clinicAnswers).length > 0;
        const hasPatient = patientAnswers && Object.keys(patientAnswers).length > 0;
        return (
          <>
            {hasDoctor && (
              <div className="mt-6">
                <DoctorAnswersSummary
                  answers={doctorAnswers!}
                  baselineAnswers={previousDoctorAnswers}
                  title="Doctor Submission Summary"
                />
              </div>
            )}
            {hasClinic && (
              <div className="mt-6">
                <DoctorAnswersSummary
                  answers={clinicAnswers!}
                  baselineAnswers={previousClinicAnswers}
                  title="Clinic Submission Summary"
                />
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
            <h2 className="text-lg font-semibold text-white">{tr("reports.chrome.latestReportSectionTitle")}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{BENCHMARKING_GLOBAL_STANDARDS}</p>
            {repErr && <p className="text-sm text-rose-300">{repErr.message}</p>}
          </div>
          {reports && reports.length > 0 && <VersionHistoryDrawer reports={reports as any} />}
        </div>
        <div className="mt-4">
          <LatestReportCard report={latestReport as any} caseId={c.id} displayScore={latestReportDisplayScore} />
        </div>
      </section>

      {upErr && <p className="mt-6 text-sm text-rose-300">{upErr.message}</p>}
      <div className="mt-6">
        <UploadThumbnailGallery uploads={(uploads ?? []) as any} />
      </div>
    </div>
  );
}
