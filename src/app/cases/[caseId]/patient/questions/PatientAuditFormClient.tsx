"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { formatTemplate } from "@/lib/i18n/formatTemplate";
import type { TranslateFn } from "@/lib/i18n/getTranslation";
import { PATIENT_AUDIT_SECTIONS } from "@/lib/patientAuditForm";
import type { PatientFormQuestion } from "@/lib/patientAuditForm";
import {
  type IntakeFormData,
  normalizeIntakeFormData,
  toNestedForApi,
  getAdvancedSectionsCompletion,
} from "@/lib/intake/normalizeIntakeFormData";
import { validatePatientAuditV2, normalizePatientV2ForValidation } from "@/lib/patientAuditSchema";

function isNonEmptyObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v as Record<string, unknown>).length > 0;
}

function localizedSectionTitle(t: TranslateFn, section: { id: string; title: string }) {
  const key = `dashboard.patient.forms.sections.${section.id}.title`;
  const tr = t(key);
  return tr === key ? section.title : tr;
}

function localizedSectionDescription(t: TranslateFn, section: { id: string; description?: string }) {
  if (!section.description) return undefined;
  const key = `dashboard.patient.forms.sections.${section.id}.description`;
  const tr = t(key);
  return tr === key ? section.description : tr;
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
    "rounded-2xl border border-slate-300 bg-white shadow-sm";
  const [formData, setFormData] = useState<IntakeFormData>({});
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasEditedRef = useRef(false);
  const locked = caseStatus === "submitted" || !!submittedAt;
  const router = useRouter();
  const { t } = useI18n();

  const visibleSections = useMemo(
    () => PATIENT_AUDIT_SECTIONS.filter((s) => !s.advanced || showAdvanced),
    [showAdvanced]
  );
  const STEPS = useMemo(
    () => [
      ...visibleSections.map((s) => ({
        id: s.id,
        title: localizedSectionTitle(t, s),
      })),
      { id: "review", title: t("dashboard.patient.forms.intake.reviewSubmitStep") },
    ],
    [visibleSections, t]
  );

  const updateField = useCallback((fieldKey: string, value: string | number | string[] | boolean | null) => {
    hasEditedRef.current = true;
    setFormData((prev) => ({ ...prev, [fieldKey]: value }));
  }, []);

  const load = useCallback(async () => {
    setLoadingError(null);
    const res = await fetch(`/api/patient-answers?caseId=${caseId}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadingError(json?.error ?? t("dashboard.patient.forms.intake.failedToLoadAnswers"));
      setFormData({});
    } else if (json.patientAnswers) {
      const canonical = normalizeIntakeFormData(json.patientAnswers as Record<string, unknown>);
      setFormData(canonical);
      if (json.patientAnswers?.enhanced_patient_answers && isNonEmptyObject(json.patientAnswers.enhanced_patient_answers)) {
        setShowAdvanced(true);
      }
    }
    setLoading(false);
  }, [caseId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async () => {
    const payload = toNestedForApi(formData);
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/patient-answers?caseId=${caseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientAnswers: payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          json?.error ??
            formatTemplate(t("dashboard.patient.forms.intake.saveFailedStatus"), { status: res.status })
        );
      setMessage({ type: "ok", text: t("forms.shared.saved") });
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? t("forms.shared.saveFailedGeneric");
      setMessage({ type: "err", text: msg });
      console.error("[patient-answers save]", msg);
    } finally {
      setSaving(false);
    }
  }, [caseId, formData, t]);

  useEffect(() => {
    if (!hasEditedRef.current || locked) return;
    const t = setTimeout(() => save(), 2000);
    return () => clearTimeout(t);
  }, [formData, locked, save]);

  const goToPhotos = async () => {
    const payload = toNestedForApi(formData) as Record<string, unknown>;
    const normalized = normalizePatientV2ForValidation(payload);
    if (normalized.pain_level === undefined || normalized.pain_level === null) {
      (payload as Record<string, unknown>).pain_level = 1;
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
      if (!res.ok) throw new Error(json?.error ?? t("forms.shared.saveFailedGeneric"));
      router.push(`/cases/${caseId}/patient/photos`);
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error)?.message ?? t("forms.shared.saveFailedGeneric") });
    } finally {
      setSaving(false);
    }
  };

  const advancedCompletion = getAdvancedSectionsCompletion(formData);

  const handleStepNext = () => {
    if (activeStep < STEPS.length - 1) setActiveStep((s) => s + 1);
  };

  const handleStepPrev = () => {
    if (activeStep > 0) setActiveStep((s) => s - 1);
  };

  if (loading) {
    return (
      <div className={`animate-pulse p-6 ${glassCard}`} aria-busy="true" aria-label={t("forms.shared.loading")}>
        <div className="h-6 w-48 bg-slate-200 rounded" />
        <div className="h-4 w-full mt-4 bg-slate-100 rounded" />
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-6">
        <p className="text-sm font-semibold text-rose-100">{t("dashboard.patient.forms.intake.loadErrorTitle")}</p>
        <p className="mt-2 text-sm text-rose-100/80">{loadingError}</p>
        <Link
          href={`/cases/${caseId}`}
          className="mt-4 inline-block text-sm font-semibold text-rose-100 underline underline-offset-4 hover:opacity-90"
        >
          {t("dashboard.patient.forms.questionsPage.backToCase")}
        </Link>
      </div>
    );
  }

  const isReviewStep = STEPS[activeStep]?.id === "review";

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <p className="text-sm text-slate-900">{t("dashboard.patient.forms.intake.introLine")}</p>
        <div className={`mt-3 p-4 ${glassCard}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">{t("dashboard.patient.forms.intake.advancedTitle")}</p>
              <p className="mt-1 text-sm text-slate-800">{t("dashboard.patient.forms.intake.advancedBody")}</p>
              {showAdvanced && Object.keys(advancedCompletion).length > 0 && (
                <p className="mt-2 text-xs text-slate-600">
                  {Object.entries(advancedCompletion)
                    .map(([, s]) => `${s.complete}/${s.total}`)
                    .join(t("dashboard.patient.forms.intake.advancedProgressJoin"))}{" "}
                  {t("forms.shared.completed")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (locked) return;
                setShowAdvanced((v) => !v);
                setActiveStep(0);
              }}
              disabled={locked}
              className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              {showAdvanced ? t("dashboard.patient.forms.intake.hideAdvanced") : t("dashboard.patient.forms.intake.addAdvanced")}
            </button>
          </div>
        </div>
        {locked && (
          <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-50 p-4 text-sm text-amber-900">
            {t("dashboard.patient.forms.intake.lockedBanner")}
          </div>
        )}
      </header>

      {/* Stepper */}
      <nav
        className="flex items-center gap-1 overflow-x-auto pb-2"
        aria-label={t("dashboard.patient.forms.intake.stepperAria")}
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
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border border-slate-300 bg-white text-slate-800"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      {/* Content */}
      {isReviewStep ? (
        <PatientReviewSummary
          values={formData}
          sections={visibleSections}
          onEdit={() => setActiveStep(0)}
          t={t}
        />
      ) : (
        (() => {
          const section = visibleSections[activeStep];
          if (!section) return null;
          return (
            <section className={`p-6 ${glassCard}`}>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">{localizedSectionTitle(t, section)}</h2>
              {section.description && (
                <p className="text-sm text-slate-800 mb-4">{localizedSectionDescription(t, section)}</p>
              )}
              <div className="space-y-5">
                {section.questions.map((q) => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    value={formData[q.id]}
                    onChange={(v) => updateField(q.id, v)}
                    values={formData}
                    locked={locked}
                    t={t}
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
            className="rounded-xl px-4 py-2 text-sm font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {t("forms.shared.previous")}
          </button>
          <button
            type="button"
            onClick={handleStepNext}
            disabled={locked}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 transition-colors"
          >
            {activeStep === STEPS.length - 2 ? t("forms.shared.review") : t("forms.shared.next")}
          </button>
        </div>
      )}

      {/* Review step CTA — Add photos */}
      {isReviewStep && (
        <section className={`p-6 ${glassCard}`}>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            {t("dashboard.patient.forms.intake.photosSectionTitle")}
          </h2>
          <p className="text-sm text-slate-800 mb-4">{t("dashboard.patient.forms.intake.photosSectionBody")}</p>
          <button
            type="button"
            onClick={goToPhotos}
            disabled={saving || locked}
            className="rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? t("forms.shared.saving") : t("dashboard.patient.forms.intake.addPhotosCta")}
          </button>
        </section>
      )}

      <footer className="flex items-center justify-between pt-4 border-t border-slate-200">
        <div className="text-sm text-slate-800 flex items-center gap-3">
          {message && (
            <>
              <span className={message.type === "ok" ? "text-emerald-700" : "text-rose-700"}>
                {message.text}
              </span>
              {message.type === "err" && (
                <button
                  type="button"
                  onClick={() => save()}
                  className="text-sm font-semibold text-cyan-700 underline underline-offset-4 hover:text-cyan-800"
                >
                  {t("forms.shared.retry")}
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex gap-3">
          <Link
            href={`/cases/${caseId}`}
            className="rounded-xl px-4 py-2 text-sm font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 transition-colors"
          >
            {t("dashboard.patient.forms.questionsPage.backToCase")}
          </Link>
          {!locked && !isReviewStep && (
            <button
              onClick={() => save()}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-semibold border border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 transition-colors"
            >
              {saving ? t("forms.shared.saving") : t("forms.shared.saveAnswers")}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function PatientReviewSummary({
  values,
  sections,
  onEdit,
  t,
}: {
  values: IntakeFormData;
  sections: { id: string; title: string; questions: PatientFormQuestion[] }[];
  onEdit: () => void;
  t: TranslateFn;
}) {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.log("[PatientReviewSummary] canonical intake:", JSON.stringify(values).slice(0, 600) + (JSON.stringify(values).length > 600 ? "…" : ""));
  }

  const reviewEnumIds = new Set([
    "clinic_country",
    "procedure_type",
    "donor_shaving",
    "surgery_duration",
    "post_op_swelling",
    "bleeding_issue",
    "recovery_time",
    "shock_loss",
    "months_since",
    "would_repeat",
  ]);

  const fmt = (qId: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return t("forms.shared.emDash");
    if (Array.isArray(v)) return v.join(", ");
    if ((qId === "complications" || qId === "would_recommend") && typeof v === "string") {
      if (v === "yes") return t("forms.shared.yes");
      if (v === "no") return t("forms.shared.no");
    }
    if (reviewEnumIds.has(qId) && typeof v === "string") {
      const path = `dashboard.patient.forms.reviewEnums.${qId}.${v}`;
      const tr = t(path);
      if (tr !== path) return tr;
    }
    return String(v);
  };

  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">{t("dashboard.patient.forms.reviewSummary.title")}</h2>
      <p className="text-sm text-slate-800 mb-4">{t("dashboard.patient.forms.reviewSummary.hint")}</p>
      <div className="space-y-4">
        {sections.map((sec) => (
          <div key={sec.id}>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">{localizedSectionTitle(t, sec)}</h3>
            <dl className="space-y-1 text-sm">
              {sec.questions.map((q) => {
                const ov = values[q.id];
                if (q.dependsOn && ov === undefined) return null;
                return (
                  <div key={q.id} className="flex justify-between gap-2">
                    <dt className="text-slate-800">{q.prompt}</dt>
                    <dd className="font-semibold text-slate-900">{fmt(q.id, ov)}</dd>
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
        className="mt-4 text-sm font-semibold text-cyan-700 underline underline-offset-4 hover:text-cyan-800"
      >
        {t("dashboard.patient.forms.reviewSummary.editAnswers")}
      </button>
    </section>
  );
}

function QuestionField({
  question,
  value,
  onChange,
  values,
  locked,
  t,
}: {
  question: PatientFormQuestion & { dependsOn?: { questionId: string; value?: string; hasValue?: string } };
  value: unknown;
  onChange: (v: string | number | string[] | boolean | null) => void;
  values: IntakeFormData;
  locked: boolean;
  t: TranslateFn;
}) {
  const dep = question.dependsOn;
  const getDepVal = (id: string) => values[id];
  const show =
    !dep ||
    (dep.value !== undefined && getDepVal(dep.questionId) === dep.value) ||
    (dep.hasValue !== undefined &&
      Array.isArray(getDepVal(dep.questionId)) &&
      (getDepVal(dep.questionId) as string[]).includes(dep.hasValue));

  if (!show) return null;

  const fieldId = `patient-${question.id}`;
  const baseClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 " +
    "focus:outline-none focus:ring-2 focus:ring-cyan-300/40 focus:border-cyan-400 " +
    "disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed";
  const labelClass = "block text-sm font-semibold text-slate-900 mb-1";

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
              className="w-full h-2 rounded-full appearance-none bg-slate-200 accent-emerald-600"
            />
            <p className="text-xs text-slate-800">{num} / {max}</p>
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
                  num === n ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
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
            <option value="">{t("forms.shared.selectPlaceholder")}</option>
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
                  className="rounded-full accent-emerald-600"
                />
                <span className="text-sm text-slate-900">{v === "yes" ? t("forms.shared.yes") : t("forms.shared.no")}</span>
              </label>
            ))}
          </div>
        );
      case "boolean": {
        const cur = typeof value === "boolean" ? value : value === null || value === undefined || value === "" ? null : Boolean(value);
        return (
          <div role="radiogroup" aria-labelledby={`${fieldId}-label`} className="flex gap-4">
            {[
              { label: t("forms.shared.yes"), v: true as const },
              { label: t("forms.shared.no"), v: false as const },
            ].map((opt) => (
              <label key={String(opt.v)} htmlFor={`${fieldId}-${String(opt.v)}`} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  id={`${fieldId}-${String(opt.v)}`}
                  name={question.id}
                  checked={cur === opt.v}
                  onChange={() => onChange(opt.v)}
                  disabled={locked}
                  className="rounded-full accent-emerald-600"
                />
                <span className="text-sm text-slate-900">{opt.label}</span>
              </label>
            ))}
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={locked || cur === null}
              className="text-sm text-slate-700 underline underline-offset-4 disabled:opacity-60"
            >
              {t("forms.shared.clear")}
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
                  className="rounded accent-emerald-600"
                />
                <span className="text-sm text-slate-900">{o.label}</span>
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
        {question.required && <span className="text-emerald-700 ml-1">*</span>}
      </label>
      {question.help && <p className="text-xs text-slate-700 mb-2">{question.help}</p>}
      {render()}
    </div>
  );
}
