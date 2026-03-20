"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuestionField from "./QuestionField";
import { useI18n } from "@/components/i18n/I18nProvider";
import { isAdvancedAuditSection, localizeAuditQuestion, resolveAuditSectionTitle } from "@/lib/audit/auditDisplayI18n";
import { DOCTOR_AUDIT_SECTIONS } from "@/lib/doctorAuditForm";
import { validateDoctorAnswers } from "@/lib/doctorAuditSchema";
import { caseStableFields, doctorDefaultFields } from "@/config/auditSchema";
import { AUDIT_PROTOCOL_GROUPS } from "@/config/auditProtocolGroups";

type FormQuestion = {
  id: string;
  prompt: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  dependsOn?:
    | { questionId: string; value?: string; hasValue?: string }
    | { questionId: string; oneOf: string[] }
    | { or: Array<{ questionId: string; value: string }> };
  defaultable?: boolean;
  defaultSource?: "clinic" | "doctor";
};

type SectionDef = {
  id: string;
  title: string;
  questions: FormQuestion[];
  showWhen?: { questionId: string; oneOf: string[] };
};

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify([...value].sort());
  return JSON.stringify(value ?? null);
}

function pickFields(source: Record<string, unknown>, fieldKeys: readonly string[]) {
  const picked: Record<string, unknown> = {};
  for (const key of fieldKeys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") picked[key] = value;
  }
  return picked;
}

function getOptionLabel(options: { value: string; label: string }[] | undefined, value: unknown): string {
  if (!options || value === null || value === undefined) return String(value ?? "—");
  const opt = options.find((o) => o.value === String(value));
  return opt?.label ?? String(value);
}

function formatAnswer(q: FormQuestion, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return String(value);
  if (q.type === "select" && q.options) return getOptionLabel(q.options, value);
  return String(value);
}

export default function DoctorAuditFormClient({
  caseId,
  caseStatus,
  submittedAt,
  loadUrl,
  saveUrl,
  backHref,
  photosNav,
  primaryCtaHref,
  primaryCtaLabel,
  isFollowupAudit = false,
}: {
  caseId: string;
  caseStatus: string;
  submittedAt?: string | null;
  loadUrl: string;
  saveUrl: string;
  backHref: string;
  photosNav?: { href: string; label: string; description?: string };
  primaryCtaHref?: string;
  primaryCtaLabel?: string;
  isFollowupAudit?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [fieldProvenance, setFieldProvenance] = useState<Record<string, string>>({});
  const [workflowNotice, setWorkflowNotice] = useState<string | null>(null);
  const [onlyEditChanged, setOnlyEditChanged] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState<Record<string, boolean>>({});
  const [useSavedDefaultForFields, setUseSavedDefaultForFields] = useState<Record<string, boolean>>({});
  const [showReview, setShowReview] = useState(false);
  const hasEditedRef = useRef(false);
  const baselineRef = useRef<Record<string, unknown> | null>(null);
  const originalAnswersRef = useRef<Record<string, unknown> | null>(null);
  const caseStableSet = new Set<string>(caseStableFields as readonly string[]);
  const defaultFieldSet = new Set<string>(doctorDefaultFields as readonly string[]);
  const defaultsStorageKey = "hairaudit:doctor:defaults:v1";
  const lastCaseStorageKey = "hairaudit:doctor:last-case:v1";
  const locked = caseStatus === "submitted" || !!submittedAt;
  const router = useRouter();
  const { t, locale } = useI18n();

  const translateOrFallback = useCallback(
    (key: string, fallback: string) => {
      const out = t(key);
      return out === key ? fallback : out;
    },
    [t]
  );

  const localizedIntroHint = translateOrFallback(
    "dashboard.doctor.forms.caseAudit.page.introHint",
    "Target 6–8 min. Prefer selects/checkboxes."
  );
  const localizedLockedMessage = translateOrFallback(
    "dashboard.doctor.forms.caseAudit.page.lockedMessage",
    "Case submitted. Answers are locked."
  );
  const localizedPrimaryCtaLabel = primaryCtaLabel
    ? translateOrFallback("dashboard.doctor.forms.caseAudit.page.primaryCtaLabel", primaryCtaLabel)
    : primaryCtaLabel;
  const localizedPhotosDescription = translateOrFallback(
    "dashboard.doctor.forms.caseAudit.page.photosNavDescription",
    photosNav?.description ?? t("dashboard.shared.auditForms.uploadImagesNextStep")
  );
  const localizedBackLabel = translateOrFallback("dashboard.doctor.forms.caseAudit.page.backToCase", "Back to case");

  const withProvenance = (base: Record<string, unknown>) => ({
    ...base,
    field_provenance: fieldProvenance,
  });

  const load = useCallback(async () => {
    const res = await fetch(loadUrl);
    const json = await res.json().catch(() => ({}));
    const data = (json.doctorAnswers ?? null) as Record<string, unknown> | null;
    originalAnswersRef.current = data;
    baselineRef.current = data;
    if (data && Object.keys(data).length > 0) {
      setAnswers(data);
      const loadedProvenance = data.field_provenance;
      if (loadedProvenance && typeof loadedProvenance === "object" && !Array.isArray(loadedProvenance)) {
        setFieldProvenance(loadedProvenance as Record<string, string>);
      }
    } else if (typeof window !== "undefined") {
      const rawDefaults = window.localStorage.getItem(defaultsStorageKey);
      if (rawDefaults) {
        const defaults = JSON.parse(rawDefaults) as Record<string, unknown>;
        const prefill = pickFields(defaults, doctorDefaultFields as readonly string[]);
        if (Object.keys(prefill).length > 0) {
          setAnswers(prefill);
          baselineRef.current = prefill;
          setFieldProvenance((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(prefill)) next[key] = "prefilled_from_doctor_default";
            return next;
          });
          setUseSavedDefaultForFields((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(prefill)) next[key] = true;
            return next;
          });
          setWorkflowNotice(t("dashboard.shared.auditForms.prefilledFromSavedDefaults"));
        }
      }
    }
    setLoading(false);
  }, [loadUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (id: string, value: string | number | string[] | boolean | null) => {
    hasEditedRef.current = true;
    setFieldProvenance((prev) => {
      const prevTag = prev[id];
      const nextTag =
        prevTag === "prefilled_from_doctor_default" ||
        prevTag === "prefilled_from_clinic_default" ||
        prevTag === "inherited_from_original_case"
          ? "edited_after_prefill"
          : "entered_manually";
      return { ...prev, [id]: nextTag };
    });
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const readSavedDefaults = useCallback((): Record<string, unknown> | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(defaultsStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }, []);

  const handleUseSavedDefaultChange = useCallback(
    (qId: string, useDefault: boolean) => {
      if (useDefault) {
        const savedDefaults = readSavedDefaults();
        if (!savedDefaults || !Object.prototype.hasOwnProperty.call(savedDefaults, qId)) return;
        const defaultVal = savedDefaults[qId];
        hasEditedRef.current = true;
        setAnswers((prev) => ({ ...prev, [qId]: defaultVal }));
        setFieldProvenance((prev) => ({ ...prev, [qId]: "prefilled_from_doctor_default" }));
        setUseSavedDefaultForFields((prev) => ({ ...prev, [qId]: true }));
      } else {
        setUseSavedDefaultForFields((prev) => ({ ...prev, [qId]: false }));
      }
    },
    [readSavedDefaults]
  );

  const formatDefaultValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "number") return String(value);
    return String(value);
  }, []);

  const save = async (payload?: Record<string, unknown>) => {
    const toSave = payload ?? answers;
    setMessage(null);
    setSaving(true);
    try {
      const payloadWithProvenance = withProvenance(toSave);
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ doctorAnswers: payloadWithProvenance }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? t("forms.shared.saveFailedGeneric"));
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          lastCaseStorageKey,
          JSON.stringify({ caseId, savedAt: new Date().toISOString(), answers: payloadWithProvenance })
        );
      }
      setMessage({ type: "ok", text: t("forms.shared.saved") });
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error)?.message ?? t("forms.shared.saveFailedGeneric") });
    } finally {
      setSaving(false);
    }
  };

  const goToPhotos = async (href: string) => {
    setMessage(null);
    const err = validateDoctorAnswers(answers as Record<string, unknown>);
    if (err) {
      setMessage({ type: "err", text: err });
      return;
    }
    setSaving(true);
    try {
      const payloadWithProvenance = withProvenance(answers);
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ doctorAnswers: payloadWithProvenance }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? t("forms.shared.saveFailedGeneric"));
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          lastCaseStorageKey,
          JSON.stringify({ caseId, savedAt: new Date().toISOString(), answers: payloadWithProvenance })
        );
      }
      router.push(href);
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error)?.message ?? t("forms.shared.saveFailedGeneric") });
    } finally {
      setSaving(false);
    }
  };

  const applySavedDefaults = () => {
    if (typeof window === "undefined") return;
    const rawDefaults = window.localStorage.getItem(defaultsStorageKey);
    if (!rawDefaults) {
      setWorkflowNotice(t("dashboard.shared.auditForms.noSavedDefaultsFound"));
      return;
    }
    const defaults = JSON.parse(rawDefaults) as Record<string, unknown>;
    const prefill = pickFields(defaults, doctorDefaultFields as readonly string[]);
    if (Object.keys(prefill).length === 0) {
      setWorkflowNotice(t("dashboard.shared.auditForms.noDefaultableFields"));
      return;
    }
    hasEditedRef.current = true;
    baselineRef.current = prefill;
    setFieldProvenance((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(prefill)) next[key] = "prefilled_from_doctor_default";
      return next;
    });
    setAnswers((prev) => ({ ...prev, ...prefill }));
    setUseSavedDefaultForFields((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(prefill)) next[key] = true;
      return next;
    });
    setWorkflowNotice(t("dashboard.shared.auditForms.appliedSavedDefaults"));
  };

  const applyProtocolGroup = useCallback(
    (groupLabel: string, fieldIds: readonly string[]) => {
      const defaults = readSavedDefaults();
      if (!defaults) {
        setWorkflowNotice(t("dashboard.shared.auditForms.noSavedDefaultsFound"));
        return;
      }
      const allowed = fieldIds.filter((id) => defaultFieldSet.has(id));
      const prefill = pickFields(defaults, allowed);
      if (Object.keys(prefill).length === 0) {
        setWorkflowNotice(`${t("dashboard.shared.auditForms.noSavedValuesForGroupPrefix")} ${groupLabel}.`);
        return;
      }
      hasEditedRef.current = true;
      setFieldProvenance((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(prefill)) next[key] = "prefilled_from_doctor_default";
        return next;
      });
      setAnswers((prev) => ({ ...prev, ...prefill }));
      setUseSavedDefaultForFields((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(prefill)) next[key] = true;
        return next;
      });
      setWorkflowNotice(
        `${t("dashboard.shared.auditForms.appliedSavedGroupPrefix")} ${groupLabel}. ${t("dashboard.shared.auditForms.appliedSavedGroupSuffix")}`
      );
    },
    [readSavedDefaults]
  );

  const copyFromPreviousCase = () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(lastCaseStorageKey);
    if (!raw) {
      setWorkflowNotice(t("dashboard.shared.auditForms.noPreviousCaseSnapshot"));
      return;
    }
    const parsed = JSON.parse(raw) as { caseId?: string; answers?: Record<string, unknown> };
    if (!parsed.answers || parsed.caseId === caseId) {
      setWorkflowNotice(t("dashboard.shared.auditForms.noEligiblePreviousCaseSnapshot"));
      return;
    }
    const copyKeys = Array.from(new Set<string>([...(caseStableFields as readonly string[]), ...(doctorDefaultFields as readonly string[])]));
    const prefill = pickFields(parsed.answers, copyKeys);
    if (Object.keys(prefill).length === 0) {
      setWorkflowNotice(t("dashboard.shared.auditForms.previousCaseNoReusableFields"));
      return;
    }
    hasEditedRef.current = true;
    baselineRef.current = prefill;
    setFieldProvenance((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(prefill)) next[key] = "inherited_from_original_case";
      return next;
    });
    setAnswers((prev) => ({ ...prev, ...prefill }));
    setWorkflowNotice(t("dashboard.shared.auditForms.copiedReusableDataFromPreviousCase"));
  };

  const saveCurrentAsDefaults = () => {
    if (typeof window === "undefined") return;
    const defaultsPayload = pickFields(answers, doctorDefaultFields as readonly string[]);
    if (Object.keys(defaultsPayload).length === 0) {
      setWorkflowNotice(t("dashboard.shared.auditForms.addDefaultableFieldBeforeSaving"));
      return;
    }
    window.localStorage.setItem(defaultsStorageKey, JSON.stringify(defaultsPayload));
    setWorkflowNotice(t("dashboard.shared.auditForms.savedCurrentAnswersAsDefaults"));
  };

  useEffect(() => {
    if (!hasEditedRef.current || locked) return;
    const t = setTimeout(() => save(undefined), 2000);
    return () => clearTimeout(t);
  }, [answers, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  const localizedSections = DOCTOR_AUDIT_SECTIONS.map((section) => ({
    ...section,
    title: resolveAuditSectionTitle("doctor", locale, section),
    questions: section.questions.map((question) => localizeAuditQuestion("doctor", locale, question)),
  }));

  const visibleSections = localizedSections.filter((sec) => {
    if (!sec.showWhen) return true;
    const val = answers[sec.showWhen.questionId];
    return sec.showWhen.oneOf.includes(String(val ?? ""));
  })
    .map((section) => ({
      ...section,
      questions: section.questions.filter((q) => {
        if (!onlyEditChanged || !baselineRef.current) return true;
        if (!defaultFieldSet.has(q.id) && !caseStableSet.has(q.id)) return true;
        return stableSerialize(answers[q.id]) !== stableSerialize(baselineRef.current[q.id]);
      }),
    }))
    .filter((section) => section.questions.length > 0);

  const savedDefaults = readSavedDefaults();

  const renderQuestion = (q: FormQuestion) => {
    const isDefaultable = !locked && q.defaultable && q.defaultSource === "doctor";
    const hasDefault =
      isDefaultable && savedDefaults != null && Object.prototype.hasOwnProperty.call(savedDefaults, q.id);
    const useDefault = !!hasDefault && !!useSavedDefaultForFields[q.id];

    if (hasDefault) {
      return (
        <div key={q.id} className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={useDefault}
              onChange={(e) => handleUseSavedDefaultChange(q.id, e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            {t("dashboard.shared.auditForms.useSavedDefault")}
          </label>
          {useDefault ? (
            <p className="text-sm text-slate-600 py-1.5 pl-6">
              {t("dashboard.shared.auditForms.usingSavedDefaultPrefix")} {formatDefaultValue(answers[q.id] ?? savedDefaults?.[q.id])}
            </p>
          ) : (
            <QuestionField
              question={q}
              value={answers[q.id]}
              onChange={(v) => update(q.id, v)}
              allAnswers={answers}
              locked={locked}
              readOnly={isFollowupAudit && caseStableSet.has(q.id)}
            />
          )}
        </div>
      );
    }
    return (
      <QuestionField
        key={q.id}
        question={q}
        value={answers[q.id]}
        onChange={(v) => update(q.id, v)}
        allAnswers={answers}
        locked={locked}
        readOnly={isFollowupAudit && caseStableSet.has(q.id)}
      />
    );
  };

  const questionLabelById = new Map<string, string>();
  for (const section of localizedSections) {
    for (const question of section.questions) questionLabelById.set(question.id, question.prompt);
  }
  const inheritedStableEntries =
    isFollowupAudit && originalAnswersRef.current
      ? (caseStableFields as readonly string[])
          .filter((key) => {
            const value = originalAnswersRef.current?.[key];
            return value !== undefined && value !== null && value !== "";
          })
          .map((key) => ({
            key,
            label: questionLabelById.get(key) ?? key,
            value: originalAnswersRef.current?.[key],
          }))
      : [];

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border p-6">
        <div className="h-6 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-full mt-4 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <p className="text-sm text-gray-600">{localizedIntroHint}</p>
        {!locked && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t("dashboard.shared.auditForms.exceptionEntry")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applySavedDefaults}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {t("dashboard.shared.auditForms.useSavedDefaults")}
              </button>
              <button
                type="button"
                onClick={copyFromPreviousCase}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {t("dashboard.shared.auditForms.copyFromPreviousCase")}
              </button>
              <button
                type="button"
                onClick={() => setOnlyEditChanged((prev) => !prev)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                  onlyEditChanged
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {t("dashboard.shared.auditForms.onlyUpdateWhatChanged")}
              </button>
              <button
                type="button"
                onClick={saveCurrentAsDefaults}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {t("dashboard.shared.auditForms.saveCurrentAsDefaults")}
              </button>
            </div>
            {savedDefaults && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                  {t("dashboard.shared.auditForms.useSavedProtocol")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {AUDIT_PROTOCOL_GROUPS.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() =>
                        applyProtocolGroup(
                          t(`dashboard.shared.auditForms.protocolGroups.${group.id}`),
                          group.fieldIds
                        )
                      }
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {t(`dashboard.shared.auditForms.protocolGroups.${group.id}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {workflowNotice && <p className="mt-2 text-xs text-slate-600">{workflowNotice}</p>}
          </div>
        )}
        {isFollowupAudit && inheritedStableEntries.length > 0 && (
          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-800">
              {t("dashboard.shared.auditForms.inheritedFromOriginalSurgeryRecord")}
            </summary>
            <div className="mt-3 space-y-2 text-sm">
              {inheritedStableEntries.map((entry) => (
                <div key={entry.key} className="flex justify-between gap-3 border-b border-slate-200 pb-1">
                  <span className="text-slate-600">{entry.label}</span>
                  <span className="text-right font-medium text-slate-900">{String(entry.value)}</span>
                </div>
              ))}
            </div>
          </details>
        )}
        {locked && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            {localizedLockedMessage}
          </div>
        )}
      </header>

      {!showReview ? (
        <>
          {visibleSections.map((section) => (
            <section
              key={section.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              {isAdvancedAuditSection(section) ? (
                <details
                  open={!!advancedOpen[section.id]}
                  onToggle={(event) => {
                    const target = event.currentTarget;
                    setAdvancedOpen((prev) => ({ ...prev, [section.id]: target.open }));
                  }}
                >
                  <summary className="cursor-pointer text-lg font-semibold text-gray-900">
                    {section.title}
                  </summary>
                  <p className="mt-2 text-sm text-gray-600">
                    {t("dashboard.shared.auditForms.advancedSectionHint")}
                  </p>
                  <div className="mt-4 space-y-5">
                    {section.questions.map((q) => renderQuestion(q))}
                  </div>
                </details>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">{section.title}</h2>
                  <div className="space-y-5">
                    {section.questions.map((q) => renderQuestion(q))}
                  </div>
                </>
              )}
            </section>
          ))}

          {photosNav && (
            <section className="rounded-xl border border-gray-200 bg-gray-50 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                {isFollowupAudit ? t("dashboard.shared.auditForms.addFollowupEvidenceTitle") : t("dashboard.shared.auditForms.addPhotosTitle")}
              </h2>
              <p className="text-sm text-gray-600">{localizedPhotosDescription}</p>
            </section>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowReview(true)}
              className="rounded-lg px-5 py-2.5 text-sm font-medium bg-slate-800 text-white hover:bg-slate-700"
            >
              {t("dashboard.shared.auditForms.reviewSummaryCta")}
            </button>
          </div>
        </>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("dashboard.shared.auditForms.reviewSummaryTitle")}</h2>
          <p className="text-sm text-gray-600 mb-6">
            {t("dashboard.shared.auditForms.reviewSummaryBody")}
          </p>
          <div className="space-y-6">
            {visibleSections.map((sec) => (
              <div key={sec.id}>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">{sec.title}</h3>
                <dl className="grid gap-2 text-sm">
                  {sec.questions.map((q) => {
                    const v = answers[q.id];
                    if (v === undefined && !q.required) return null;
                    return (
                      <div key={q.id} className="flex justify-between gap-4 py-1 border-b border-gray-100">
                        <dt className="text-gray-600">{q.prompt}</dt>
                        <dd className="text-right font-medium text-slate-900 min-w-[140px]">
                          {formatAnswer(q, v)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setShowReview(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium border border-gray-300 hover:bg-gray-50"
            >
              {t("dashboard.shared.auditForms.backToForm")}
            </button>
          </div>
        </section>
      )}

      <footer className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-gray-600">
          {message && (
            <span className={message.type === "ok" ? "text-amber-600" : "text-red-600"}>
              {message.text}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <Link
            href={backHref}
            className="rounded-lg px-4 py-2 text-sm font-medium border border-gray-300 hover:bg-gray-50"
          >
            {localizedBackLabel}
          </Link>
              {!locked && (
            <>
              <button
                onClick={() => save()}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium border border-amber-500 text-amber-700 hover:bg-amber-50"
              >
                {saving ? t("dashboard.shared.auditForms.saving") : t("forms.shared.saveAnswers")}
              </button>
              {primaryCtaHref && localizedPrimaryCtaLabel ? (
                <button
                  type="button"
                  onClick={() => goToPhotos(primaryCtaHref)}
                  disabled={saving}
                  className="rounded-lg px-4 py-2 text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400"
                >
                  {saving ? t("dashboard.shared.auditForms.saving") : localizedPrimaryCtaLabel}
                </button>
              ) : (
                <Link
                  href={backHref}
                  className="rounded-lg px-4 py-2 text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400"
                >
                  {t("dashboard.shared.auditForms.continue")}
                </Link>
              )}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
