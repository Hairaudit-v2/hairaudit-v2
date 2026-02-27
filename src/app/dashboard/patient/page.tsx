import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import CreateCaseButton from "../create-case-button";
import { PATIENT_AUDIT_SECTIONS, type PatientAuditAnswers } from "@/lib/patientAuditForm";
import DeleteDraftCaseButton from "./DeleteDraftCaseButton";
import GraftIntegrityCard from "./GraftIntegrityCard";

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

const MODULE_DEFS: Array<{ key: ModuleKey; title: string; prefixes: string[] }> = [
  { key: "procedure", title: "Procedure", prefixes: ["enhanced_patient_answers.procedure_execution", "enhanced_patient_answers.donor_profile"] },
  { key: "graftHandling", title: "Graft Handling", prefixes: ["enhanced_patient_answers.graft_handling"] },
  { key: "healingCourse", title: "Healing Course", prefixes: ["enhanced_patient_answers.healing_course"] },
  { key: "currentStatus", title: "Current Status", prefixes: ["enhanced_patient_answers.aesthetics", "enhanced_patient_answers.experience"] },
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

  const unlockCards: Array<{
    title: string;
    desc: string;
    unlockAt: number;
    icon: ReactNode;
  }> = [
    {
      title: "Performance Radar Signature",
      desc: "A multi-factor performance imprint synthesized from photos + procedure signals.",
      unlockAt: 20,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3" strokeLinecap="round" />
          <path d="M12 6a6 6 0 1 0 6 6" strokeLinecap="round" />
          <path d="M12 12l6-2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: "Donor Safety Index",
      desc: "Risk calibration for extraction density, pattern, and long-term donor integrity.",
      unlockAt: 40,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Graft Viability Model",
      desc: "Viability inference from handling signals—hydration, storage, time, and exposure.",
      unlockAt: 60,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2c3 4 6 7 6 11a6 6 0 1 1-12 0c0-4 3-7 6-11z" strokeLinejoin="round" />
          <path d="M9.5 14.5c.5 1.5 2 2.5 3.5 2.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: "Aesthetic Balance Assessment",
      desc: "Aesthetic consistency scoring across hairline, directionality, and symmetry signals.",
      unlockAt: 80,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v18" strokeLinecap="round" />
          <path d="M6 7h12M6 17h12" strokeLinecap="round" />
          <path d="M8 7l-2 4 2 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 17l2-4-2-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Predictive Growth Timeline",
      desc: "Stage-aware projection of growth and density maturation based on healing inputs.",
      unlockAt: 100,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18" strokeLinecap="round" />
          <path d="M7 12a5 5 0 0 1 10 0" strokeLinecap="round" />
          <path d="M12 12v7" strokeLinecap="round" />
          <path d="M9 19h6" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-24 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-5">
          <div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
              Your Surgical Intelligence Dashboard
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-200/80 max-w-2xl">
              Complete your intelligence inputs to unlock full forensic analysis.
            </p>
          </div>

          {showConversionPrompt && (
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur px-4 py-3 text-sm text-slate-200">
              Complete your final inputs to increase audit precision by up to 35%.
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            {nextCase?.id ? (
              <Link
                href={`/cases/${nextCase.id}/patient/questions`}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 transition-colors shadow-sm"
              >
                Complete Intelligence Questions
              </Link>
            ) : (
              <CreateCaseButton variant="premium" />
            )}

            <a
              href="#unlock-preview"
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-200 border border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur transition-colors"
            >
              See what you’ll unlock
            </a>
          </div>

          {/* Authority strip */}
          <div className="pt-2 text-xs leading-relaxed text-slate-300/70">
            <div>Powered by Follicle Intelligence™</div>
            <div>Multi-Layer Visual Pattern Recognition Engine</div>
            <div>Vision Model: GPT-5.2</div>
          </div>
        </div>
      </section>

      {/* Intelligence gateway surface */}
      <section className="relative mt-8 overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Completion module */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">Case Completion</h2>
                  <p className="mt-1 text-xs text-slate-300/80">
                    Based on photos + procedure + handling + healing inputs.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-white tabular-nums">{nextCase?.id ? `${completionPct}%` : "—"}</div>
                  <div className="text-xs text-slate-300/70">{nextCase?.id ? (hasAnyCaseData ? "Live" : "Not started") : "No case yet"}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300"
                    style={{ width: `${nextCase?.id ? clamp01(completionPct / 100) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {([
                  {
                    label: "Photos",
                    done: patientPhotoCount >= 6,
                    detail: nextCase?.id ? `${patientPhotoCount}/${PHOTOS_TARGET}` : "—",
                  },
                  {
                    label: "Procedure",
                    done: required.pct >= 0.95,
                    detail: nextCase?.id ? `${required.answered}/${required.total}` : "—",
                  },
                  {
                    label: "Graft Handling",
                    done: modules.graftHandling.pct >= 0.6,
                    detail: nextCase?.id ? `${modules.graftHandling.answered}/${modules.graftHandling.total}` : "—",
                  },
                  {
                    label: "Healing Course",
                    done: modules.healingCourse.pct >= 0.6,
                    detail: nextCase?.id ? `${modules.healingCourse.answered}/${modules.healingCourse.total}` : "—",
                  },
                  {
                    label: "Current Status",
                    done: modules.currentStatus.pct >= 0.6,
                    detail: nextCase?.id ? `${modules.currentStatus.answered}/${modules.currentStatus.total}` : "—",
                  },
                ] as const).map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-lg border ${
                          nextCase?.id && item.done
                            ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                            : "border-white/10 bg-white/5 text-slate-300/70"
                        }`}
                        aria-hidden="true"
                      >
                        {nextCase?.id && item.done ? (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-white">{item.label}</div>
                        <div className="text-xs text-slate-300/70">{item.detail}</div>
                      </div>
                    </div>
                    {nextCase?.id && !item.done && (
                      <span className="text-xs font-medium text-cyan-200/80">In progress</span>
                    )}
                  </div>
                ))}
              </div>

              {nextCase?.id && (
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Link
                    href={`/cases/${nextCase.id}/patient/questions`}
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 transition-colors"
                  >
                    Complete Intelligence Questions
                  </Link>
                  <Link
                    href={`/cases/${nextCase.id}/patient/photos`}
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 border border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur transition-colors"
                  >
                    Add photos
                  </Link>
                </div>
              )}
            </section>

            {graftIntegrityInitial ? (
              <GraftIntegrityCard
                caseId={latestSubmittedCase?.id ?? null}
                initialEstimate={(graftIntegrityInitial ?? null) as any}
              />
            ) : graftIntegrityRolloutPending ? (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-sm font-semibold text-white">Graft Integrity Index</h2>
                <p className="mt-2 text-xs text-slate-300/80">
                  Coming soon: this feature is still rolling out in your environment.
                </p>
              </section>
            ) : null}
          </div>

        {/* Unlock preview */}
        <section id="unlock-preview" className="lg:col-span-7 scroll-mt-24">
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Preview: what you’ll unlock</h2>
              <p className="mt-1 text-xs text-slate-200/70">
                Your inputs activate deeper models—each layer increases audit precision.
              </p>
            </div>
            {nextCase?.id && (
              <div className="text-xs font-medium text-slate-200/70">
                Current unlock level: <span className="text-white">{completionPct}%</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {unlockCards.map((card) => {
              const unlocked = nextCase?.id ? completionPct >= card.unlockAt : false;
              return (
                <div
                  key={card.title}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
                >
                  <div className={`relative ${unlocked ? "" : "filter blur-[1.5px]"}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white shadow-sm border border-white/10">
                        {card.icon}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{card.title}</div>
                        <div className="mt-1 text-xs text-slate-200/70">{card.desc}</div>
                      </div>
                    </div>
                  </div>

                  {!unlocked && (
                    <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]">
                      <div className="absolute inset-x-5 bottom-4 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-white">Locked</span>
                        <span className="text-xs font-medium text-slate-200/80">Unlock at {card.unlockAt}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        </div>

        {/* Why this matters */}
        <section className="relative mt-6">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Why this matters</h2>
              <p className="mt-1 text-sm text-slate-200/70">Better inputs mean higher-confidence conclusions.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                title: "Donor Risk Calibration",
                desc: "Improves donor safety inference and extraction-pattern interpretation.",
              },
              {
                title: "Graft Survival Modeling",
                desc: "Transforms handling details into a viability confidence profile.",
              },
              {
                title: "Long-Term Projection",
                desc: "Sharpens growth-stage interpretation and forecasted outcome stability.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
              >
                <div className="text-sm font-semibold text-white">{c.title}</div>
                <div className="mt-1 text-xs text-slate-200/70">{c.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </section>

      {/* Case history (match premium surface) */}
      <section className="relative mt-10 overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">My audit requests</h2>
            <p className="text-sm text-slate-200/70 mt-1">Your cases and audit status history.</p>
          </div>
          <CreateCaseButton variant="premium" />
        </div>

        {(!cases || cases.length === 0) ? (
          <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
            <p className="text-slate-200/80 mb-4">No cases yet. Create your first one to activate the dashboard.</p>
            <div className="inline-flex">
              <CreateCaseButton variant="premium" />
            </div>
          </div>
        ) : (
          <ul className="relative mt-5 space-y-3">
            {cases.map((c) => {
              const status = String(c.status ?? "draft");
              const canDeleteDraft = status === "draft" && !c.submitted_at;
              const pill =
                status === "complete"
                  ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                  : status === "submitted"
                    ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
                    : status === "audit_failed"
                      ? "border-rose-300/20 bg-rose-300/10 text-rose-200"
                      : "border-white/10 bg-white/5 text-slate-200/80";

              return (
                <li key={c.id}>
                  <div className="group relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur hover:bg-white/8 hover:border-white/15 transition-all shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
                    <Link href={`/cases/${c.id}`} className="block p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm sm:text-base font-semibold text-white">
                            {c.title ?? "Patient Audit"}
                          </div>
                          <div className="mt-1 text-xs text-slate-200/70">
                            Created: {new Date(c.created_at).toLocaleString()}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${pill}`}>
                          {status}
                        </span>
                      </div>
                    </Link>

                    {canDeleteDraft && (
                      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                        <DeleteDraftCaseButton caseId={c.id} caseTitle={c.title} />
                      </div>
                    )}
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
