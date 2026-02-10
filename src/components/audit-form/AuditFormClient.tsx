"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QuestionField from "./QuestionField";

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
  dependsOn?: { questionId: string; value?: string; hasValue?: string };
};

type Section = { id: string; title: string; questions: FormQuestion[] };

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
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const locked = caseStatus === "submitted" || !!submittedAt;

  const load = useCallback(async () => {
    const res = await fetch(loadUrl);
    const json = await res.json().catch(() => ({}));
    const data = json[payloadKey];
    if (data) setAnswers(data);
    setLoading(false);
  }, [loadUrl, payloadKey]);

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
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [payloadKey]: answers }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Save failed");
      setMessage({ type: "ok", text: "Saved" });
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error)?.message ?? "Save failed" });
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
        <p className="text-sm text-gray-600">{description}</p>
        {locked && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">{lockedMessage}</div>
        )}
      </header>

      {sections.map((section) => (
        <section key={section.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{section.title as string}</h2>
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

      {visualRecordsSection}

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
                onClick={save}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium border border-amber-500 text-amber-700 hover:bg-amber-50"
              >
                {saving ? "Saving…" : "Save answers"}
              </button>
              <Link
                href={backHref}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400"
              >
                Continue →
              </Link>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
