"use client";

import { useMemo, useState } from "react";

type Props = {
  initialCompletedSteps: string[];
  initialCurrentStep: string;
  initialPortalMode: string;
};

const STEPS = [
  {
    id: "foundation",
    title: "Foundation",
    detail: "Set your clinic identity and operating model.",
  },
  {
    id: "clinical_stack",
    title: "Clinical Stack",
    detail: "Document methods, tools, devices, machines, and protocols.",
  },
  {
    id: "audit_workspaces",
    title: "Audit Workspaces",
    detail: "Configure patient-submitted and clinic-submitted case workflows.",
  },
  {
    id: "visibility_controls",
    title: "Visibility Controls",
    detail: "Decide what is public versus internal QA.",
  },
  {
    id: "activation",
    title: "Activation",
    detail: "Enable future modules for training, benchmarking, and white-label.",
  },
] as const;

const PORTAL_MODES = [
  { value: "hairaudit_public", label: "HairAudit Public Audits" },
  { value: "clinic_internal", label: "Internal-Only Clinic Audits" },
  { value: "training", label: "Training Tooling" },
  { value: "doctor_benchmarking", label: "Doctor Benchmarking" },
  { value: "clinic_benchmarking", label: "Clinic Benchmarking" },
  { value: "follicle_whitelabel", label: "Follicle Intelligence White-label" },
];

export default function ClinicOnboardingFlow({
  initialCompletedSteps,
  initialCurrentStep,
  initialPortalMode,
}: Props) {
  const [completedSteps, setCompletedSteps] = useState<string[]>(initialCompletedSteps ?? []);
  const [currentStep, setCurrentStep] = useState<string>(initialCurrentStep || "foundation");
  const [portalMode, setPortalMode] = useState<string>(initialPortalMode || "hairaudit_public");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");

  const completionPct = useMemo(
    () => Math.round((completedSteps.length / STEPS.length) * 100),
    [completedSteps.length]
  );
  const nextPrompt =
    !completedSteps.includes("foundation")
      ? "Complete your clinic identity"
      : !completedSteps.includes("clinical_stack")
        ? "Add your surgical methods"
        : !completedSteps.includes("audit_workspaces")
          ? "Respond to patient-submitted cases"
          : !completedSteps.includes("visibility_controls")
            ? "Prepare your public profile"
            : "Submit your first internal case";

  async function persist(nextSteps: string[], nextStep: string, nextMode: string) {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/clinic-portal/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          completedSteps: nextSteps,
          currentStep: nextStep,
          portalMode: nextMode,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to save onboarding state.");
      setMessage("Onboarding progress saved.");
    } catch (error: unknown) {
      setMessage((error as Error)?.message ?? "Failed to save onboarding state.");
    } finally {
      setSaving(false);
    }
  }

  function toggleStep(stepId: string) {
    const nextSteps = completedSteps.includes(stepId)
      ? completedSteps.filter((s) => s !== stepId)
      : [...completedSteps, stepId];
    setCompletedSteps(nextSteps);
    void persist(nextSteps, currentStep, portalMode);
  }

  function setStep(stepId: string) {
    setCurrentStep(stepId);
    void persist(completedSteps, stepId, portalMode);
  }

  function setMode(mode: string) {
    setPortalMode(mode);
    void persist(completedSteps, currentStep, mode);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Clinic onboarding roadmap</h2>
          <p className="mt-1 text-sm text-slate-600">
            Build your portal in phases to increase clinical trust, operational clarity, and future benchmark readiness.
          </p>
        </div>
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-900">
          {completionPct}% complete
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next best action</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{nextPrompt}</p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: `${completionPct}%` }} />
      </div>

      <div className="mt-5 grid gap-3">
        {STEPS.map((step) => {
          const done = completedSteps.includes(step.id);
          return (
            <label
              key={step.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                done ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"
              }`}
            >
              <input type="checkbox" checked={done} onChange={() => toggleStep(step.id)} className="mt-1" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                  <button
                    type="button"
                    onClick={() => setStep(step.id)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                  >
                    Set active
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-600">{step.detail}</p>
              </div>
            </label>
          );
        })}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              completedSteps.includes("foundation")
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            Basic Profile Complete
          </span>
          <span
            className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              completedSteps.includes("clinical_stack")
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            Enhanced Trust Profile
          </span>
          <span
            className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              completedSteps.includes("activation")
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            Benchmark Ready
          </span>
          <span
            className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              completedSteps.includes("visibility_controls")
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            Public Listing In Progress
          </span>
          <span
            className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              completedSteps.includes("activation")
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            Training Ready
          </span>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary operating mode</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PORTAL_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setMode(mode.value)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                portalMode === mode.value
                  ? "border-cyan-400 bg-cyan-50 text-cyan-900"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">{saving ? "Saving trust progression..." : message}</p>
      <p className="mt-1 text-xs text-slate-400">Current step: {currentStep.replaceAll("_", " ")}</p>
    </section>
  );
}
