"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuestionField from "./QuestionField";
import {
  AUDIT_WORKFLOW_UX_COPY,
  caseStableFields,
  clinicDefaultFields,
  doctorDefaultFields,
} from "@/config/auditSchema";
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

type Section = { id: string; title: string; questions: FormQuestion[] };

type WorkflowActor = "doctor" | "clinic";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isEmptyAnswers(value: Record<string, unknown> | null | undefined): boolean {
  return !value || Object.keys(value).length === 0;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify([...value].sort());
  return JSON.stringify(value ?? null);
}

export default function AuditFormClient({
  caseId,
  caseStatus,
  submittedAt,
  sections,
  loadUrl,
  saveUrl,
  payloadKey,
  title,
  description,
  lockedMessage = "Case submitted. Answers are locked.",
  backHref,
  backLabel = "Back to case",
  visualRecordsSection,
  photosNav,
  primaryCtaHref,
  primaryCtaLabel,
  validate,
  workflowActor,
  isFollowupAudit = false,
}: {
  caseId: string;
  caseStatus: string;
  submittedAt?: string | null;
  sections: Section[];
  loadUrl: string;
  saveUrl: string;
  payloadKey: string;
  title: string;
  description: string;
  lockedMessage?: string;
  backHref: string;
  backLabel?: string;
  visualRecordsSection?: React.ReactNode;
  /** When provided, renders a save-then-navigate button instead of a link for the photos section */
  photosNav?: { href: string; label: string; title?: string; description?: string };
  /** When provided (e.g. photos page), the main footer CTA saves and navigates here instead of backHref */
  primaryCtaHref?: string;
  primaryCtaLabel?: string;
  validate?: (answers: Record<string, unknown>) => string | null;
  workflowActor?: WorkflowActor;
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
  const hasEditedRef = useRef(false);
  const baselineRef = useRef<Record<string, unknown> | null>(null);
  const originalAnswersRef = useRef<Record<string, unknown> | null>(null);
  const locked = caseStatus === "submitted" || !!submittedAt;
  const router = useRouter();
  const caseStableSet = useMemo(() => new Set<string>(caseStableFields as readonly string[]), []);
  const defaultFieldKeys = useMemo(
    () => (workflowActor === "doctor" ? doctorDefaultFields : clinicDefaultFields) as readonly string[],
    [workflowActor]
  );
  const defaultSet = useMemo(() => new Set<string>(defaultFieldKeys), [defaultFieldKeys]);
  const defaultsStorageKey = workflowActor ? `hairaudit:${workflowActor}:defaults:v1` : null;
  const lastCaseStorageKey = workflowActor ? `hairaudit:${workflowActor}:last-case:v1` : null;

  const pickFields = useCallback((source: Record<string, unknown>, fieldKeys: readonly string[]) => {
    const picked: Record<string, unknown> = {};
    for (const key of fieldKeys) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== "") picked[key] = value;
    }
    return picked;
  }, []);

  const readStorageObject = useCallback((key: string | null): Record<string, unknown> | null => {
    if (!key || typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      return isObjectRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }, []);

  const withProvenance = useCallback(
    (base: Record<string, unknown>) => ({
      ...base,
      field_provenance: fieldProvenance,
    }),
    [fieldProvenance]
  );

  const load = useCallback(async () => {
    const res = await fetch(loadUrl);
    const json = await res.json().catch(() => ({}));
    const loaded = isObjectRecord(json[payloadKey]) ? (json[payloadKey] as Record<string, unknown>) : null;
    const hasLoadedAnswers = !isEmptyAnswers(loaded);
    originalAnswersRef.current = loaded;
    baselineRef.current = loaded;

    if (hasLoadedAnswers) {
      setAnswers(loaded as Record<string, unknown>);
      const loadedProvenance = loaded?.field_provenance;
      if (loadedProvenance && typeof loadedProvenance === "object" && !Array.isArray(loadedProvenance)) {
        setFieldProvenance(loadedProvenance as Record<string, string>);
      }
    } else if (workflowActor) {
      const defaults = readStorageObject(defaultsStorageKey);
      if (defaults) {
        const prefill = pickFields(defaults, defaultFieldKeys);
        if (!isEmptyAnswers(prefill)) {
          setAnswers(prefill);
          baselineRef.current = prefill;
          const provenanceValue =
            workflowActor === "doctor" ? "prefilled_from_doctor_default" : "prefilled_from_clinic_default";
          setFieldProvenance((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(prefill)) next[key] = provenanceValue;
            return next;
          });
          setUseSavedDefaultForFields((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(prefill)) next[key] = true;
            return next;
          });
          setWorkflowNotice("Prefilled from saved defaults. Only edit what changed.");
        }
      }
    }
    setLoading(false);
  }, [defaultFieldKeys, defaultsStorageKey, loadUrl, payloadKey, pickFields, readStorageObject, workflowActor]);

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

  const handleUseSavedDefaultChange = useCallback(
    (qId: string, useDefault: boolean) => {
      if (!defaultsStorageKey) return;
      if (useDefault) {
        const savedDefaults = readStorageObject(defaultsStorageKey);
        if (!savedDefaults || !Object.prototype.hasOwnProperty.call(savedDefaults, qId)) return;
        const defaultVal = savedDefaults[qId];
        hasEditedRef.current = true;
        setAnswers((prev) => ({ ...prev, [qId]: defaultVal }));
        setFieldProvenance((prev) => ({
          ...prev,
          [qId]:
            workflowActor === "doctor" ? "prefilled_from_doctor_default" : "prefilled_from_clinic_default",
        }));
        setUseSavedDefaultForFields((prev) => ({ ...prev, [qId]: true }));
      } else {
        setUseSavedDefaultForFields((prev) => ({ ...prev, [qId]: false }));
      }
    },
    [defaultsStorageKey, readStorageObject, workflowActor]
  );

  const formatDefaultValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "number") return String(value);
    return String(value);
  }, []);

  const save = async (answersToSave?: Record<string, unknown>) => {
    const payload = answersToSave ?? answers;
    setMessage(null);
    setSaving(true);
    try {
      const payloadWithProvenance = withProvenance(payload);
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [payloadKey]: payloadWithProvenance }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Save failed");
      if (lastCaseStorageKey && typeof window !== "undefined") {
        window.localStorage.setItem(
          lastCaseStorageKey,
          JSON.stringify({ caseId, savedAt: new Date().toISOString(), answers: payloadWithProvenance })
        );
      }
      setMessage({ type: "ok", text: "Saved" });
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error)?.message ?? "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const goToPhotos = async (href: string) => {
    setMessage(null);
    if (validate) {
      const err = validate(answers);
      if (err) {
        setMessage({ type: "err", text: err });
        return;
      }
    }
    setSaving(true);
    try {
      const payloadWithProvenance = withProvenance(answers);
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [payloadKey]: payloadWithProvenance }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Save failed");
      if (lastCaseStorageKey && typeof window !== "undefined") {
        window.localStorage.setItem(
          lastCaseStorageKey,
          JSON.stringify({ caseId, savedAt: new Date().toISOString(), answers: payloadWithProvenance })
        );
      }
      router.push(href);
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error)?.message ?? "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const applySavedDefaults = () => {
    if (!defaultsStorageKey) return;
    const defaults = readStorageObject(defaultsStorageKey);
    if (!defaults) {
      setWorkflowNotice("No saved defaults found yet.");
      return;
    }
    const prefill = pickFields(defaults, defaultFieldKeys);
    if (isEmptyAnswers(prefill)) {
      setWorkflowNotice("No matching default fields available to prefill.");
      return;
    }
    hasEditedRef.current = true;
    baselineRef.current = prefill;
    setFieldProvenance((prev) => {
      const next = { ...prev };
      const tag = workflowActor === "doctor" ? "prefilled_from_doctor_default" : "prefilled_from_clinic_default";
      for (const key of Object.keys(prefill)) next[key] = tag;
      return next;
    });
    setAnswers((prev) => ({ ...prev, ...prefill }));
    setUseSavedDefaultForFields((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(prefill)) next[key] = true;
      return next;
    });
    setWorkflowNotice("Applied saved defaults. Only edit what changed.");
  };

  const applyProtocolGroup = useCallback(
    (groupLabel: string, fieldIds: readonly string[]) => {
      if (!defaultsStorageKey) return;
      const defaults = readStorageObject(defaultsStorageKey);
      if (!defaults) {
        setWorkflowNotice("No saved defaults found yet.");
        return;
      }
      const allowed = fieldIds.filter((id) => defaultSet.has(id));
      const prefill = pickFields(defaults, allowed);
      if (isEmptyAnswers(prefill)) {
        setWorkflowNotice(`No saved values for ${groupLabel}.`);
        return;
      }
      hasEditedRef.current = true;
      const tag = workflowActor === "doctor" ? "prefilled_from_doctor_default" : "prefilled_from_clinic_default";
      setFieldProvenance((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(prefill)) next[key] = tag;
        return next;
      });
      setAnswers((prev) => ({ ...prev, ...prefill }));
      setUseSavedDefaultForFields((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(prefill)) next[key] = true;
        return next;
      });
      setWorkflowNotice(`Applied saved ${groupLabel}. You can override any field.`);
    },
    [defaultSet, defaultsStorageKey, pickFields, readStorageObject, workflowActor]
  );

  const copyFromPreviousCase = () => {
    if (!lastCaseStorageKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(lastCaseStorageKey);
      if (!raw) {
        setWorkflowNotice("No previous case snapshot found.");
        return;
      }
      const parsed = JSON.parse(raw) as { caseId?: string; answers?: Record<string, unknown> };
      if (!parsed?.answers || parsed.caseId === caseId) {
        setWorkflowNotice("No eligible previous case snapshot found.");
        return;
      }
      const source = parsed.answers;
      const copyKeys = Array.from(new Set<string>([...(caseStableFields as readonly string[]), ...defaultFieldKeys]));
      const prefill = pickFields(source, copyKeys);
      if (isEmptyAnswers(prefill)) {
        setWorkflowNotice("Previous case snapshot does not include reusable fields.");
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
      setWorkflowNotice("Copied reusable data from previous case. Only edit what changed.");
    } catch {
      setWorkflowNotice("Unable to read previous case snapshot.");
    }
  };

  const saveCurrentAsDefaults = () => {
    if (!defaultsStorageKey || typeof window === "undefined") return;
    const defaultsPayload = pickFields(answers, defaultFieldKeys);
    if (isEmptyAnswers(defaultsPayload)) {
      setWorkflowNotice("Add at least one defaultable field before saving defaults.");
      return;
    }
    window.localStorage.setItem(defaultsStorageKey, JSON.stringify(defaultsPayload));
    setWorkflowNotice("Saved current answers as your defaults.");
  };

  // Auto-save 2 seconds after last change
  useEffect(() => {
    if (!hasEditedRef.current || locked) return;
    const t = setTimeout(() => save(undefined), 2000);
    return () => clearTimeout(t);
  }, [answers, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  const questionLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    for (const section of sections) {
      for (const question of section.questions) labels.set(question.id, question.prompt);
    }
    return labels;
  }, [sections]);

  const inheritedStableEntries = useMemo(() => {
    if (!isFollowupAudit || !originalAnswersRef.current) return [] as Array<{ key: string; label: string; value: unknown }>;
    const source = originalAnswersRef.current;
    return (caseStableFields as readonly string[])
      .filter((key) => source[key] !== undefined && source[key] !== null && source[key] !== "")
      .map((key) => ({ key, label: questionLabelById.get(key) ?? key, value: source[key] }));
  }, [isFollowupAudit, questionLabelById]);

  const renderedSections = useMemo(() => {
    return sections
      .map((section) => {
        const filteredQuestions = section.questions.filter((q) => {
          if (!onlyEditChanged || !baselineRef.current) return true;
          if (!defaultSet.has(q.id) && !caseStableSet.has(q.id)) return true;
          return stableSerialize(answers[q.id]) !== stableSerialize(baselineRef.current[q.id]);
        });
        return { ...section, questions: filteredQuestions };
      })
      .filter((section) => section.questions.length > 0);
  }, [answers, caseStableSet, defaultSet, onlyEditChanged, sections]);

  const savedDefaults = workflowActor ? readStorageObject(defaultsStorageKey) : null;

  const renderQuestion = (q: FormQuestion) => {
    const isDefaultable =
      !locked && workflowActor && q.defaultable && q.defaultSource === workflowActor;
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
            Use saved default
          </label>
          {useDefault ? (
            <p className="text-sm text-slate-600 py-1.5 pl-6">
              Using saved default: {formatDefaultValue(answers[q.id] ?? savedDefaults?.[q.id])}
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
        <p className="text-sm text-gray-600">{description}</p>
        {!locked && workflowActor && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Exception-based entry</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applySavedDefaults}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {AUDIT_WORKFLOW_UX_COPY.useSavedDefaults}
              </button>
              <button
                type="button"
                onClick={copyFromPreviousCase}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {AUDIT_WORKFLOW_UX_COPY.copyFromPreviousCase}
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
                {AUDIT_WORKFLOW_UX_COPY.onlyUpdateWhatChanged}
              </button>
              <button
                type="button"
                onClick={saveCurrentAsDefaults}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Save current as defaults
              </button>
            </div>
            {savedDefaults && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                  Use saved protocol
                </p>
                <div className="flex flex-wrap gap-2">
                  {AUDIT_PROTOCOL_GROUPS.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => applyProtocolGroup(group.label, group.fieldIds)}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {group.label}
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
              {AUDIT_WORKFLOW_UX_COPY.inheritedFromOriginalSurgeryRecord}
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
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">{lockedMessage}</div>
        )}
      </header>

      {renderedSections.map((section) => (
        <section key={section.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {section.title.includes("Advanced / Forensic") ? (
            <details
              open={!!advancedOpen[section.id]}
              onToggle={(event) => {
                const target = event.currentTarget;
                setAdvancedOpen((prev) => ({ ...prev, [section.id]: target.open }));
              }}
            >
              <summary className="cursor-pointer text-lg font-semibold text-gray-900">
                {section.title as string}
              </summary>
              <p className="mt-2 text-sm text-gray-600">
                {AUDIT_WORKFLOW_UX_COPY.addAdvancedDataToImproveConfidenceAndBenchmarking}
              </p>
              <div className="mt-4 space-y-5">
                {section.questions.map((q) => renderQuestion(q))}
              </div>
            </details>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{section.title as string}</h2>
              <div className="space-y-5">
                {section.questions.map((q) => renderQuestion(q))}
              </div>
            </>
          )}
        </section>
      ))}

      {photosNav ? (
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            {isFollowupAudit ? "2. Add new follow-up evidence" : "2. Add your photos"}
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            {photosNav.description ?? "Upload images in the next step."}
          </p>
        </section>
      ) : (
        visualRecordsSection
      )}

      <footer className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-gray-600">
          {message && (
            <span className={message.type === "ok" ? "text-amber-600" : "text-red-600"}>{message.text}</span>
          )}
        </div>
        <div className="flex gap-3">
          <Link href={backHref} className="rounded-lg px-4 py-2 text-sm font-medium border border-gray-300 hover:bg-gray-50">
            {backLabel}
          </Link>
          {!locked && (
            <>
              <button
                onClick={() => save()}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium border border-amber-500 text-amber-700 hover:bg-amber-50"
              >
                {saving ? "Saving…" : "Save answers"}
              </button>
              {primaryCtaHref && primaryCtaLabel ? (
                <button
                  type="button"
                  onClick={() => goToPhotos(primaryCtaHref)}
                  disabled={saving}
                  className="rounded-lg px-4 py-2 text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400"
                >
                  {saving ? "Saving…" : primaryCtaLabel}
                </button>
              ) : (
                <Link
                  href={backHref}
                  className="rounded-lg px-4 py-2 text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400"
                >
                  Continue →
                </Link>
              )}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
