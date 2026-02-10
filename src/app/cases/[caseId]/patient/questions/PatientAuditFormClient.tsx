"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PATIENT_AUDIT_SECTIONS } from "@/lib/patientAuditForm";
import type { PatientAuditAnswers, PatientFormQuestion } from "@/lib/patientAuditForm";

export default function PatientAuditFormClient({
  caseId,
  caseStatus,
  submittedAt,
}: {
  caseId: string;
  caseStatus: string;
  submittedAt?: string | null;
}) {
  const [answers, setAnswers] = useState<PatientAuditAnswers>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const locked = caseStatus === "submitted" || !!submittedAt;

  const load = useCallback(async () => {
    const res = await fetch(`/api/patient-answers?caseId=${caseId}`);
    const json = await res.json().catch(() => ({}));
    if (json.patientAnswers) setAnswers(json.patientAnswers);
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (id: string, value: string | number | string[] | boolean | null) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const save = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/patient-answers?caseId=${caseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientAnswers: answers }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Save failed");
      setMessage({ type: "ok", text: "Saved" });
    } catch (e: any) {
      setMessage({ type: "err", text: e?.message ?? "Save failed" });
    } finally {
      setSaving(false);
    }
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
        <p className="text-sm text-gray-600">
          About 5–10 minutes. This form collects your hair transplant experience for the audit.
        </p>
        {locked && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            Case submitted. Answers are locked.
          </div>
        )}
      </header>

      {PATIENT_AUDIT_SECTIONS.map((section) => (
        <section key={section.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{section.title}</h2>
          <div className="space-y-5">
            {section.questions.map((q) => (
              <QuestionField
                key={q.id}
                question={q}
                value={answers[q.id]}
                onChange={(v) => update(q.id, v)}
                allAnswers={answers}
                locked={locked}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Visual Records: link to photo upload */}
      <section className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Visual Records</h2>
        <p className="text-sm text-gray-600 mb-3">
          Pre-procedure, surgery, and post-procedure images are uploaded in the previous step.
        </p>
        <Link
          href={`/cases/${caseId}/patient/photos`}
          className="text-amber-600 hover:underline font-medium"
        >
          → Upload or view photos
        </Link>
      </section>

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
            href={`/cases/${caseId}`}
            className="rounded-lg px-4 py-2 text-sm font-medium border border-gray-300 hover:bg-gray-50"
          >
            Back to case
          </Link>
          {!locked && (
            <>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium border border-amber-500 text-amber-700 hover:bg-amber-50"
              >
                {saving ? "Saving…" : "Save answers"}
              </button>
              <Link
                href={`/cases/${caseId}`}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400"
              >
                Continue to submit →
              </Link>
            </>
          )}
        </div>
      </footer>
    </div>
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
  const show =
    !dep ||
    (dep.value !== undefined && allAnswers[dep.questionId] === dep.value) ||
    (dep.hasValue !== undefined &&
      Array.isArray(allAnswers[dep.questionId]) &&
      (allAnswers[dep.questionId] as string[]).includes(dep.hasValue));

  if (!show) return null;

  const baseClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60 disabled:bg-gray-100";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  const render = () => {
    switch (question.type) {
      case "text":
        return (
          <input
            type="text"
            className={baseClass}
            placeholder={question.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={locked}
          />
        );
      case "textarea":
        return (
          <textarea
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
            type="date"
            className={baseClass}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={locked}
          />
        );
      case "rating": {
        const min = question.min ?? 1;
        const max = question.max ?? 5;
        const num = typeof value === "number" ? value : value ? Number(value) : null;
        return (
          <div className="flex items-center gap-2 flex-wrap">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
              <button
                key={n}
                type="button"
                disabled={locked}
                onClick={() => onChange(n)}
                className={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors ${
                  num === n ? "border-amber-500 bg-amber-50 text-amber-800" : "border-gray-300 hover:bg-gray-50"
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
          <div className="flex gap-4">
            {(["yes", "no"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  checked={(value as string) === v}
                  onChange={() => onChange(v)}
                  disabled={locked}
                  className="rounded-full"
                />
                <span className="text-sm capitalize">{v}</span>
              </label>
            ))}
          </div>
        );
      case "checkbox": {
        const selected = Array.isArray(value) ? value : value ? [String(value)] : [];
        const opts = question.options ?? [];
        return (
          <div className="space-y-2">
            {opts.map((o) => (
              <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selected, o.value]
                      : selected.filter((x) => x !== o.value);
                    onChange(next.length ? next : null);
                  }}
                  disabled={locked}
                  className="rounded"
                />
                <span className="text-sm">{o.label}</span>
              </label>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div>
      <label className={labelClass}>
        {question.prompt}
        {question.required && <span className="text-amber-600 ml-1">*</span>}
      </label>
      {question.help && <p className="text-xs text-gray-500 mb-2">{question.help}</p>}
      {render()}
    </div>
  );
}
