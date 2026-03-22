import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PATIENT_AUDIT_SECTIONS, type PatientAuditAnswers } from "@/lib/patientAuditForm";
import GraftIntegrityCard from "./GraftIntegrityCard";
import { BENCHMARKING_GLOBAL_STANDARDS } from "@/lib/benchmarkingCopy";
import PatientDashboardI18nIntro from "@/components/i18n/PatientDashboardI18nIntro";
import PatientDashboardCompletionCard from "@/components/patient/PatientDashboardCompletionCard";
import PatientDashboardUnlockSection from "@/components/patient/PatientDashboardUnlockSection";
import PatientDashboardWhyMattersSection from "@/components/patient/PatientDashboardWhyMattersSection";
import PatientDashboardCaseHistorySection from "@/components/patient/PatientDashboardCaseHistorySection";
import PatientGraftIntegrityRolloutNotice from "@/components/patient/PatientGraftIntegrityRolloutNotice";

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
    message.includes("relation") && message.includes("does not exist")
  );
}

function isAnswered(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length > 0;
  return false;
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  if (!path.includes(".")) return obj[path];
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function computeRequiredQuestionsCompletion(answers: PatientAuditAnswers) {
  const requiredIds = PATIENT_AUDIT_SECTIONS
    .filter((s) => !s.advanced)
    .flatMap((s) => s.questions)
    .filter((q) => q.required)
    .map((q) => q.id);

  const total = requiredIds.length || 1;
  const answered = requiredIds.reduce((acc, id) => acc + (isAnswered(getByPath(answers as Record<string, unknown>, id)) ? 1 : 0), 0);
  return { total, answered, pct: answered / total };
}

type ModuleKey = "procedure" | "graftHandling" | "healingCourse" | "currentStatus";

const MODULE_DEFS: Array<{ key: ModuleKey; prefixes: string[] }> = [
  { key: "procedure", prefixes: ["enhanced_patient_answers.procedure_execution", "enhanced_patient_answers.donor_profile"] },
  { key: "graftHandling", prefixes: ["enhanced_patient_answers.graft_handling"] },
  { key: "healingCourse", prefixes: ["enhanced_patient_answers.healing_course"] },
  { key: "currentStatus", prefixes: ["enhanced_patient_answers.aesthetics", "enhanced_patient_answers.experience"] },
];

function computeModuleCompletion(answers: PatientAuditAnswers, prefixes: string[]) {
  const advancedQuestionIds = PATIENT_AUDIT_SECTIONS
    .filter((s) => s.advanced)
    .flatMap((s) => s.questions)
    .map((q) => q.id)
    .filter((id) => prefixes.some((p) => id.startsWith(p)));

  const total = advancedQuestionIds.length || 1;
  const answered = advancedQuestionIds.reduce((acc, id) => acc + (isAnswered(getByPath(answers as Record<string, unknown>, id)) ? 1 : 0), 0);
  return { total, answered, pct: answered / total };
}

export default async function PatientDashboardPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: cases } = await admin
    .from("cases")
    .select("id, title, status, created_at, submitted_at")
    .or(`patient_id.eq.${user.id},and(user_id.eq.${user.id},patient_id.is.null)`)
    .order("created_at", { ascending: false });

  const nextCase = (cases ?? []).find((c) => (c.status ?? "draft") !== "submitted" && !c.submitted_at) ?? (cases?.[0] ?? null);
  const latestSubmittedCase =
    (cases ?? []).find((c) => Boolean(c.submitted_at) || ["submitted", "processing", "complete", "audit_failed"].includes(String(c.status ?? ""))) ??
    null;

  // Latest report pdf_path + id per case (for "Report Ready" and Download PDF on dashboard).
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

  let patientAnswers: PatientAuditAnswers = {};
  let patientPhotoCount = 0;
  let hasAnyCaseData = false;

  if (nextCase?.id) {
    const { data: uploads } = await admin
      .from("uploads")
      .select("id, type")
      .eq("case_id", nextCase.id);
    const patientUploads = (uploads ?? []).filter((u) => String(u.type ?? "").startsWith("patient_photo:"));
    patientPhotoCount = patientUploads.length;

    const withAuditCols = await admin
      .from("reports")
      .select("id, summary, patient_audit_version, patient_audit_v2")
      .eq("case_id", nextCase.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (withAuditCols.error && String(withAuditCols.error.message || "").includes("patient_audit")) {
      const fallback = await admin
        .from("reports")
        .select("id, summary")
        .eq("case_id", nextCase.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const fromSummary = (fallback.data?.summary as Record<string, unknown> | undefined)?.patient_answers;
      if (fromSummary && typeof fromSummary === "object") patientAnswers = fromSummary as PatientAuditAnswers;
    } else {
      const r = withAuditCols.data as unknown as { patient_audit_version?: number; patient_audit_v2?: Record<string, unknown> | null; summary?: { patient_answers?: unknown } } | null;
      if (r?.patient_audit_version === 2 && r?.patient_audit_v2 && Object.keys(r.patient_audit_v2).length > 0) {
        patientAnswers = r.patient_audit_v2 as PatientAuditAnswers;
      } else {
        const fromSummary = (r?.summary as Record<string, unknown> | undefined)?.patient_answers;
        if (fromSummary && typeof fromSummary === "object") patientAnswers = fromSummary as PatientAuditAnswers;
      }
    }

    hasAnyCaseData = patientPhotoCount > 0 || Object.keys(patientAnswers).length > 0;
  }

  let graftIntegrityInitial: unknown = null;
  let graftIntegrityRolloutPending = false;
  if (latestSubmittedCase?.id) {
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

  const PHOTOS_TARGET = 8;
  const photosPct = clamp01(patientPhotoCount / PHOTOS_TARGET);
  const required = computeRequiredQuestionsCompletion(patientAnswers);
  const modules = Object.fromEntries(
    MODULE_DEFS.map((m) => [m.key, computeModuleCompletion(patientAnswers, m.prefixes)])
  ) as Record<ModuleKey, { total: number; answered: number; pct: number }>;
  const advancedAvgPct =
    (modules.procedure.pct + modules.graftHandling.pct + modules.healingCourse.pct + modules.currentStatus.pct) / 4;

  const completionPct = Math.round(
    100 *
      (0.2 * photosPct +
        0.5 * required.pct +
        0.3 * advancedAvgPct)
  );

  const showConversionPrompt = Boolean(nextCase?.id) && completionPct < 70;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <PatientDashboardI18nIntro
        showConversionPrompt={showConversionPrompt}
        nextCase={nextCase?.id ? { id: nextCase.id } : null}
        benchmarkingLine={BENCHMARKING_GLOBAL_STANDARDS}
      />

      {/* Intelligence gateway surface */}
      <section className="relative mt-8 overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Completion module */}
          <div className="flex flex-col gap-6 lg:col-span-5">
            <PatientDashboardCompletionCard
              nextCaseId={nextCase?.id ?? null}
              completionPct={completionPct}
              hasAnyCaseData={hasAnyCaseData}
              patientPhotoCount={patientPhotoCount}
              photosTarget={PHOTOS_TARGET}
              required={required}
              modules={{
                graftHandling: modules.graftHandling,
                healingCourse: modules.healingCourse,
                currentStatus: modules.currentStatus,
              }}
            />

            {graftIntegrityInitial ? (
              <GraftIntegrityCard
                caseId={latestSubmittedCase?.id ?? null}
                initialEstimate={(graftIntegrityInitial ?? null) as any}
              />
            ) : graftIntegrityRolloutPending ? (
              <PatientGraftIntegrityRolloutNotice />
            ) : null}
          </div>

          <PatientDashboardUnlockSection completionPct={completionPct} nextCaseId={nextCase?.id ?? null} />
        </div>

        <PatientDashboardWhyMattersSection />
      </section>

      <PatientDashboardCaseHistorySection cases={cases} pdfByCase={pdfByCase} reportIdByCase={reportIdByCase} />
    </div>
  );
}
