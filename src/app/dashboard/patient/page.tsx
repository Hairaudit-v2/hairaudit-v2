import { redirect } from "next/navigation";
import { buildPatientLoginHref } from "@/lib/auth/patientLogin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import GraftIntegrityCard, { type GraftIntegrityEstimateRow } from "./GraftIntegrityCard";
import PatientDashboardCaseHistorySection from "@/components/patient/PatientDashboardCaseHistorySection";
import PatientGraftIntegrityRolloutNotice from "@/components/patient/PatientGraftIntegrityRolloutNotice";
import PatientResumeReviewPanel from "@/components/patient/PatientResumeReviewPanel";
import {
  canUnlockPostOpGuide,
  firstCaseOpenForSubmit,
  patientHasUnlockedPostOpGuide,
} from "@/lib/patient/caseSubmitStatus";
import {
  buildPatientResumeReviewForDashboard,
  fetchPatientCasesForPostOpGuide,
} from "@/lib/patient/fetchPatientCasesForPostOpGuide";
import { isPatientReportDelivered, resolvePatientReportDeliveryPhase } from "@/lib/patient/patientProcessingView";
import { shouldShowPatientDashboardAnalytics } from "@/lib/patient/patientResumeReview";
import { PATHWAY_CHOOSER_HREF } from "@/lib/patient/patientReviewPathway";
import PatientDashboardHliGuideCard from "@/components/patient/PatientDashboardHliGuideCard";
import {
  loadPatientInfoRequestsForCases,
  toPatientInfoRequestDisplay,
} from "@/lib/patient/patientInfoRequestDisplay";

function isMissingFeatureError(error: unknown): boolean {
  const e = error as { status?: number; code?: string; message?: string } | null;
  if (!e) return false;
  if (e.status === 404) return true;
  const code = String(e.code ?? "");
  const message = String(e.message ?? "").toLowerCase();
  return (
    code === "PGRST205" ||
    message.includes("not found") ||
    message.includes("could not find the table") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

export default async function PatientDashboardPage() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(buildPatientLoginHref("/dashboard/patient"));

  const admin = createSupabaseAdminClient();
  const cases = await fetchPatientCasesForPostOpGuide(admin, user.id);
  const resumeModel = await buildPatientResumeReviewForDashboard(admin, cases);

  const latestSubmittedCase = (cases ?? []).find((c) => canUnlockPostOpGuide(c)) ?? null;

  const caseIds = (cases ?? []).map((c) => c.id);
  const pdfByCase: Record<string, string> = {};
  const reportIdByCase: Record<string, string> = {};
  if (caseIds.length > 0) {
    const { data: reportRows } = await admin
      .from("reports")
      .select("id, case_id, pdf_path, version")
      .in("case_id", caseIds)
      .in("status", ["complete", "pdf_ready"])
      .not("pdf_path", "is", null)
      .order("version", { ascending: false });
    for (const r of reportRows ?? []) {
      const row = r as { id: string; case_id: string; pdf_path: string };
      const path = String(row.pdf_path ?? "").trim();
      if (row.case_id && path && !pdfByCase[row.case_id]) {
        pdfByCase[row.case_id] = path;
        reportIdByCase[row.case_id] = row.id;
      }
    }
  }

  const latestSubmittedPdfPath = latestSubmittedCase ? pdfByCase[latestSubmittedCase.id] : undefined;
  const latestSubmittedDelivered =
    latestSubmittedCase != null &&
    isPatientReportDelivered(
      resolvePatientReportDeliveryPhase({
        caseStatus: latestSubmittedCase.status,
        hasReportPdf: Boolean(latestSubmittedPdfPath),
      })
    );

  let graftIntegrityInitial: unknown = null;
  let graftIntegrityRolloutPending = false;
  if (latestSubmittedCase?.id && latestSubmittedDelivered && shouldShowPatientDashboardAnalytics(resumeModel.step)) {
    const giiRes = await admin
      .from("graft_integrity_estimates")
      .select(
        "id, case_id, claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, variance_claimed_vs_extracted_min_pct, variance_claimed_vs_extracted_max_pct, confidence, confidence_label, limitations, flags, ai_notes, auditor_status, auditor_notes, auditor_adjustments, evidence_sufficiency_score, inputs_used, created_at, updated_at"
      )
      .eq("case_id", latestSubmittedCase.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (giiRes.error) {
      if (isMissingFeatureError(giiRes.error)) {
        graftIntegrityInitial = null;
        graftIntegrityRolloutPending = true;
      } else {
        console.error("[patient/dashboard] graft_integrity_estimates query failed", giiRes.error);
      }
    } else {
      graftIntegrityInitial = giiRes.data ?? null;
    }
  }

  const hliGuideUnlocked = patientHasUnlockedPostOpGuide(cases ?? []);
  const openSubmitCase = firstCaseOpenForSubmit(
    (cases ?? []).map((c) => ({
      id: c.id,
      status: c.status,
      submitted_at: c.submitted_at,
    }))
  );
  const hliGuideSubmitCtaHref = openSubmitCase ? `/cases/${openSubmitCase.id}` : PATHWAY_CHOOSER_HREF;
  const showAnalytics = shouldShowPatientDashboardAnalytics(resumeModel.step);

  const infoRequestsByCase = await loadPatientInfoRequestsForCases(admin, cases ?? []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <PatientResumeReviewPanel model={resumeModel} />

      {showAnalytics ? (
        <section className="relative mt-8 overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-5">
              <PatientDashboardHliGuideCard unlocked={hliGuideUnlocked} submitCtaHref={hliGuideSubmitCtaHref} />

              {graftIntegrityInitial ? (
                <GraftIntegrityCard
                  caseId={latestSubmittedCase?.id ?? null}
                  initialEstimate={graftIntegrityInitial as GraftIntegrityEstimateRow}
                />
              ) : graftIntegrityRolloutPending ? (
                <PatientGraftIntegrityRolloutNotice />
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <PatientDashboardCaseHistorySection
        cases={cases.map((c) => ({
          id: c.id,
          title: c.title ?? null,
          status: c.status ?? null,
          created_at: c.created_at ?? "",
          submitted_at: c.submitted_at ?? null,
        }))}
        pdfByCase={pdfByCase}
        reportIdByCase={reportIdByCase}
        notificationEmail={user.email}
        compact={resumeModel.step !== "no_open_case"}
        primaryCaseId={resumeModel.primaryCase?.case.id ?? null}
        infoRequestsByCase={Object.fromEntries(
          Object.entries(infoRequestsByCase).map(([id, state]) => [id, toPatientInfoRequestDisplay(state)!])
        )}
      />
    </div>
  );
}
