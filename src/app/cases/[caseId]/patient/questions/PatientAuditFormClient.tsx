"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PATIENT_AUDIT_SECTIONS } from "@/lib/patientAuditForm";
import type { PatientAuditAnswers, PatientFormQuestion } from "@/lib/patientAuditForm";
import { validatePatientAuditV2, normalizePatientV2ForValidation } from "@/lib/patientAuditSchema";

function isNonEmptyObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v as Record<string, unknown>).length > 0;
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  if (!path.includes(".")) return obj[path];
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  if (!path.includes(".")) return { ...obj, [path]: value };
  const parts = path.split(".").filter(Boolean);
  const out: Record<string, unknown> = { ...obj };
  let cur: Record<string, unknown> = out;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i]!;
    const last = i === parts.length - 1;
    if (last) {
      cur[key] = value;
    } else {
      const next = cur[key];
      if (!next || typeof next !== "object" || Array.isArray(next)) {
        cur[key] = {};
      } else {
        cur[key] = { ...(next as Record<string, unknown>) };
      }
      cur = cur[key] as Record<string, unknown>;
    }
  }
  return out;
}

export default function PatientAuditFormClient({
  caseId,
  caseStatus,
  submittedAt,
}: {
  caseId: string;
  caseStatus: string;
  submittedAt?: string | null;
}) {
  const glassCard =
    "rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-[0_0_0_1px_rgba(255,255,255,0.03)]";
  const [answers, setAnswers] = useState<PatientAuditAnswers>({});
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasEditedRef = useRef(false);
  const locked = caseStatus === "submitted" || !!submittedAt;
  const router = useRouter();

  const visibleSections = PATIENT_AUDIT_SECTIONS.filter((s) => !s.advanced || showAdvanced);
  const STEPS = [
    ...visibleSections.map((s) => ({ id: s.id, title: s.title })),
    { id: "review", title: "Review & Submit" },
  ];

  const load = useCallback(async () => {
    setLoadingError(null);
    const res = await fetch(`/api/patient-answers?caseId=${caseId}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadingError(json?.error ?? "Failed to load answers");
      setAnswers({});
    } else if (json.patientAnswers) {
      setAnswers(json.patientAnswers);
      const adv = (json.patientAnswers as Record<string, unknown>)?.enhanced_patient_answers;
      if (isNonEmptyObject(adv)) setShowAdvanced(true);
    }
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (id: string, value: string | number | string[] | boolean | null) => {
    hasEditedRef.current = true;
    setAnswers((prev) => setByPath(prev as Record<string, unknown>, id, value) as PatientAuditAnswers);
  };

  const sanitizePayload = (raw: PatientAuditAnswers): PatientAuditAnswers => {
    const payload: PatientAuditAnswers = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === undefined) continue;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
        payload[k] = v;
      } else if (Array.isArray(v)) {
        payload[k] = v.map((x) => (typeof x === "string" ? x : String(x)));
      } else {
        payload[k] = v;
      }
    }
    return payload;
  };

  const save = async (answersToSave?: PatientAuditAnswers) => {
    const raw = answersToSave ?? answers;
    const payload = sanitizePayload(raw);
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/patient-answers?caseId=${caseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientAnswers: payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Save failed (${res.status})`);
      setMessage({ type: "ok", text: "Saved" });
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "Save failed";
      setMessage({ type: "err", text: msg });
      console.error("[patient-answers save]", msg);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!hasEditedRef.current || locked) return;
    const t = setTimeout(() => save(undefined), 2000);
    return () => clearTimeout(t);
  }, [answers, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  const goToPhotos = async () => {
    let payload = sanitizePayload(answers) as Record<string, unknown>;
    const normalized = normalizePatientV2ForValidation(payload);
    if (normalized.pain_level === undefined || normalized.pain_level === null) {
      normalized.pain_level = 1;
      payload = { ...payload, pain_level: 1 };
    }
    const err = validatePatientAuditV2(normalized);
    if (err) {
      setMessage({ type: "err", text: err });
      return;
    }
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/patient-answers?caseId=${caseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientAnswers: payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Save failed");
      router.push(`/cases/${caseId}/patient/photos`);
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error)?.message ?? "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleStepNext = () => {
    if (activeStep < STEPS.length - 1) setActiveStep((s) => s + 1);
  };

  const handleStepPrev = () => {
    if (activeStep > 0) setActiveStep((s) => s - 1);
  };

  if (loading) {
    return (
      <div className={`animate-pulse p-6 ${glassCard}`}>
        <div className="h-6 w-48 bg-white/10 rounded" />
        <div className="h-4 w-full mt-4 bg-white/10 rounded" />
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-6">
        <p className="text-sm font-semibold text-rose-100">Could not load form</p>
        <p className="mt-2 text-sm text-rose-100/80">{loadingError}</p>
        <Link
          href={`/cases/${caseId}`}
          className="mt-4 inline-block text-sm font-semibold text-rose-100 underline underline-offset-4 hover:opacity-90"
        >
          Back to case
        </Link>
      </div>
    );
  }

  const isReviewStep = STEPS[activeStep]?.id === "review";

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <p className="text-sm text-slate-200/70">
          About 5–6 minutes. Complete your intelligence inputs to unlock deeper forensic analysis.
        </p>
        <div className={`mt-3 p-4 ${glassCard}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Advanced forensic questions (optional)</p>
              <p className="mt-1 text-sm text-slate-200/70">
                Adds deeper inputs for graft viability, donor risk, healing stage, and aesthetic consistency. You can skip anytime.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (locked) return;
                setShowAdvanced((v) => !v);
                setActiveStep(0);
              }}
              disabled={locked}
              className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 disabled:opacity-60 transition-colors"
            >
              {showAdvanced ? "Hide advanced" : "Add advanced"}
            </button>
          </div>
        </div>
        {locked && (
          <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
            Case submitted. Intelligence inputs are locked.
          </div>
        )}
      </header>

      {/* Stepper */}
      <nav
        className="flex items-center gap-1 overflow-x-auto pb-2"
        aria-label="Form progress"
      >
        {STEPS.map((step, i) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setActiveStep(i)}
            disabled={locked}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              i === activeStep
                ? "bg-gradient-to-r from-cyan-300 to-emerald-300 text-slate-950"
                : i < activeStep
                  ? "border border-emerald-300/20 bg-white/5 text-emerald-200"
                  : "border border-white/10 bg-white/5 text-slate-200/70"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      {/* Content */}
      {isReviewStep ? (
        <PatientReviewSummary
          answers={answers}
          sections={visibleSections}
          onEdit={() => setActiveStep(0)}
        />
      ) : (
        (() => {
          const section = visibleSections[activeStep];
          if (!section) return null;
          return (
            <section className={`p-6 ${glassCard}`}>
              <h2 className="text-lg font-semibold text-white mb-2">{section.title}</h2>
              {section.description && <p className="text-sm text-slate-200/70 mb-4">{section.description}</p>}
              <div className="space-y-5">
                {section.questions.map((q) => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    value={getByPath(answers as Record<string, unknown>, q.id)}
                    onChange={(v) => update(q.id, v)}
                    allAnswers={answers}
                    locked={locked}
                  />
                ))}
              </div>
            </section>
          );
        })()
      )}

      {/* Step nav (except review uses different CTA) */}
      {!isReviewStep && (
        <div className="flex justify-between">
          <button
            type="button"
            onClick={handleStepPrev}
            disabled={activeStep === 0 || locked}
            className="rounded-xl px-4 py-2 text-sm font-semibold border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={handleStepNext}
            disabled={locked}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 transition-colors"
          >
            {activeStep === STEPS.length - 2 ? "Review" : "Next"}
          </button>
        </div>
      )}

      {/* Review step CTA — Add photos */}
      {isReviewStep && (
        <section className={`p-6 ${glassCard}`}>
          <h2 className="text-lg font-semibold text-white mb-2">2. Add your photos</h2>
          <p className="text-sm text-slate-200/70 mb-4">
            Pre-procedure, surgery, and post-procedure images go in the next step.
          </p>
          <button
            type="button"
            onClick={goToPhotos}
            disabled={saving || locked}
            className="rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "Add your photos →"}
          </button>
        </section>
      )}

      <footer className="flex items-center justify-between pt-4 border-t border-white/10">
        <div className="text-sm text-slate-200/70 flex items-center gap-3">
          {message && (
            <>
              <span className={message.type === "ok" ? "text-emerald-200" : "text-rose-200"}>
                {message.text}
              </span>
              {message.type === "err" && (
                <button
                  type="button"
                  onClick={() => save()}
                  className="text-sm font-semibold text-cyan-200 underline underline-offset-4 hover:opacity-90"
                >
                  Retry
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex gap-3">
          <Link
            href={`/cases/${caseId}`}
            className="rounded-xl px-4 py-2 text-sm font-semibold border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors"
          >
            Back to case
          </Link>
          {!locked && !isReviewStep && (
            <button
              onClick={() => save()}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-semibold border border-cyan-300/30 bg-white/5 text-cyan-200 hover:bg-white/10 transition-colors"
            >
              {saving ? "Saving…" : "Save answers"}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function PatientReviewSummary({
  answers,
  sections,
  onEdit,
}: {
  answers: PatientAuditAnswers;
  sections: { id: string; title: string; questions: PatientFormQuestion[] }[];
  onEdit: () => void;
}) {
  const labels: Record<string, Record<string, string>> = {
    clinic_country: { turkey: "Turkey", spain: "Spain", india: "India", thailand: "Thailand", mexico: "Mexico", brazil: "Brazil", argentina: "Argentina", colombia: "Colombia", australia: "Australia", uk: "UK", usa: "USA", canada: "Canada", uae: "UAE", belgium: "Belgium", germany: "Germany", poland: "Poland", greece: "Greece", other: "Other" },
    procedure_type: { fue: "FUE", fut: "FUT", dhi: "DHI", robotic: "Robotic", not_sure: "Not Sure", other: "Other" },
    donor_shaving: { full_shave: "Full shave", partial_shave: "Partial shave", no: "No" },
    surgery_duration: { under_4h: "<4h", "4_6h": "4–6h", "6_8h": "6–8h", "8_plus": "8+ hrs" },
    post_op_swelling: { none: "None", mild: "Mild", moderate: "Moderate", severe: "Severe" },
    bleeding_issue: { yes: "Yes", no: "No", not_sure: "Not Sure" },
    recovery_time: { under_1_week: "<1 wk", "1_2_weeks": "1–2 wks", "2_4_weeks": "2–4 wks", "4_plus_weeks": "4+ wks" },
    shock_loss: { yes: "Yes", no: "No", not_sure: "Not Sure" },
    months_since: { under_3: "<3 mo", "3_6": "3–6 mo", "6_9": "6–9 mo", "9_12": "9–12 mo", "12_plus": "12+ mo" },
    would_repeat: { yes: "Yes", no: "No", not_sure: "Not Sure" },
  };
  const fmt = (qId: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (Array.isArray(v)) return v.join(", ");
    const m = labels[qId];
    if (m && typeof v === "string") return m[v] ?? v;
    return String(v);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <h2 className="text-lg font-semibold text-white mb-4">Review Summary</h2>
      <p className="text-sm text-slate-200/70 mb-4">Review your answers below. Use the step dots above to edit.</p>
      <div className="space-y-4">
        {sections.map((sec) => (
          <div key={sec.id}>
            <h3 className="text-sm font-semibold text-slate-200/80 mb-2">{sec.title}</h3>
            <dl className="space-y-1 text-sm">
              {sec.questions.map((q) => {
                const v = answers[q.id];
                if (q.dependsOn && v === undefined) return null;
                return (
                  <div key={q.id} className="flex justify-between gap-2">
                    <dt className="text-slate-200/70">{q.prompt}</dt>
                    <dd className="font-semibold text-white">{fmt(q.id, v)}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="mt-4 text-sm font-semibold text-cyan-200 underline underline-offset-4 hover:opacity-90"
      >
        Edit answers
      </button>
    </section>
  );
}

function QuestionField({
  question,
  value,
  onChange,
  allAnswers,
  locked,
}: {
  question: PatientFormQuestion & { dependsOn?: { questionId: string; value?: string; hasValue?: string } };
  value: unknown;
  onChange: (v: string | number | string[] | boolean | null) => void;
  allAnswers: PatientAuditAnswers;
  locked: boolean;
}) {
  const dep = question.dependsOn;
  const getDepVal = (id: string) => getByPath(allAnswers as Record<string, unknown>, id);
  const show =
    !dep ||
    (dep.value !== undefined && getDepVal(dep.questionId) === dep.value) ||
    (dep.hasValue !== undefined &&
      Array.isArray(getDepVal(dep.questionId)) &&
      (getDepVal(dep.questionId) as string[]).includes(dep.hasValue));

  if (!show) return null;

  const fieldId = `patient-${question.id}`;
  const baseClass =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/80 " +
    "focus:outline-none focus:ring-2 focus:ring-cyan-300/30 focus:border-cyan-200/40 " +
    "disabled:opacity-60 disabled:cursor-not-allowed";
  const labelClass = "block text-sm font-semibold text-slate-200 mb-1";

  const render = () => {
    switch (question.type) {
      case "text":
        return (
          <input
            id={fieldId}
            name={question.id}
            type="text"
            className={baseClass}
            placeholder={question.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={locked}
            autoComplete="off"
          />
        );
      case "textarea":
        return (
          <textarea
            id={fieldId}
            name={question.id}
            className={`${baseClass} min-h-[80px]`}
            placeholder={question.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={locked}
          />
        );
      case "date":
        return (
          <input
            id={fieldId}
            name={question.id}
            type="date"
            className={baseClass}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={locked}
          />
        );
      case "number":
        return (
          <input
            id={fieldId}
            name={question.id}
            type="number"
            className={baseClass}
            min={question.min}
            max={question.max}
            placeholder={question.placeholder}
            value={(value as number) ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") onChange(null);
              else onChange(Number(v));
            }}
            disabled={locked}
          />
        );
      case "slider": {
        const min = question.min ?? 1;
        const max = question.max ?? 10;
        const num = typeof value === "number" ? value : value ? Number(value) : min;
        return (
          <div role="group" aria-labelledby={`${fieldId}-label`} className="space-y-2">
            <input
              id={fieldId}
              name={question.id}
              type="range"
              min={min}
              max={max}
              value={num}
              onChange={(e) => onChange(Number(e.target.value))}
              disabled={locked}
              className="w-full h-2 rounded-full appearance-none bg-white/10 accent-emerald-300"
            />
            <p className="text-xs text-slate-200/70">{num} / {max}</p>
          </div>
        );
      }
      case "rating": {
        const min = question.min ?? 1;
        const max = question.max ?? 5;
        const num = typeof value === "number" ? value : value ? Number(value) : null;
        return (
          <div role="group" aria-labelledby={`${fieldId}-label`} className="flex items-center gap-2 flex-wrap">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
              <button
                key={n}
                type="button"
                id={n === min ? fieldId : undefined}
                name={question.id}
                disabled={locked}
                onClick={() => onChange(n)}
                className={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors ${
                  num === n ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        );
      }
      case "select":
        return (
          <select
            id={fieldId}
            name={question.id}
            className={baseClass}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={locked}
          >
            <option value="">— Select —</option>
            {(question.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      case "yesno":
        return (
          <div role="radiogroup" aria-labelledby={`${fieldId}-label`} className="flex gap-4">
            {(["yes", "no"] as const).map((v) => (
              <label key={v} htmlFor={v === "yes" ? fieldId : `${fieldId}-${v}`} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  id={v === "yes" ? fieldId : `${fieldId}-${v}`}
                  name={question.id}
                  value={v}
                  checked={(value as string) === v}
                  onChange={() => onChange(v)}
                  disabled={locked}
                  className="rounded-full accent-emerald-300"
                />
                <span className="text-sm capitalize text-slate-200">{v}</span>
              </label>
            ))}
          </div>
        );
      case "boolean": {
        const cur = typeof value === "boolean" ? value : value === null || value === undefined || value === "" ? null : Boolean(value);
        return (
          <div role="radiogroup" aria-labelledby={`${fieldId}-label`} className="flex gap-4">
            {([
              { label: "Yes", v: true },
              { label: "No", v: false },
            ] as const).map((opt) => (
              <label key={opt.label} htmlFor={`${fieldId}-${String(opt.v)}`} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  id={`${fieldId}-${String(opt.v)}`}
                  name={question.id}
                  checked={cur === opt.v}
                  onChange={() => onChange(opt.v)}
                  disabled={locked}
                  className="rounded-full accent-emerald-300"
                />
                <span className="text-sm text-slate-200">{opt.label}</span>
              </label>
            ))}
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={locked || cur === null}
              className="text-sm text-slate-200/60 underline underline-offset-4 disabled:opacity-60"
            >
              Clear
            </button>
          </div>
        );
      }
      case "checkbox": {
        const selected = Array.isArray(value) ? value : value ? [String(value)] : [];
        const opts = question.options ?? [];
        return (
          <div role="group" aria-labelledby={`${fieldId}-label`} className="space-y-2">
            {opts.map((o) => (
              <label key={o.value} htmlFor={`${fieldId}-${o.value}`} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id={`${fieldId}-${o.value}`}
                  name={question.id}
                  value={o.value}
                  checked={selected.includes(o.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selected, o.value]
                      : selected.filter((x) => x !== o.value);
                    onChange(next.length ? next : null);
                  }}
                  disabled={locked}
                  className="rounded accent-emerald-300"
                />
                <span className="text-sm text-slate-200">{o.label}</span>
              </label>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  const primaryControlId = question.type === "checkbox" ? `${fieldId}-${question.options?.[0]?.value ?? "0"}` : fieldId;
  return (
    <div>
      <label id={`${fieldId}-label`} htmlFor={primaryControlId} className={labelClass}>
        {question.prompt}
        {question.required && <span className="text-emerald-200 ml-1">*</span>}
      </label>
      {question.help && <p className="text-xs text-slate-200/60 mb-2">{question.help}</p>}
      {render()}
    </div>
  );
}
