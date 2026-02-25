"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuestionField from "./QuestionField";
import { DOCTOR_AUDIT_SECTIONS } from "@/lib/doctorAuditForm";
import { validateDoctorAnswers } from "@/lib/doctorAuditSchema";

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
};

type SectionDef = {
  id: string;
  title: string;
  questions: FormQuestion[];
  showWhen?: { questionId: string; oneOf: string[] };
};

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
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showReview, setShowReview] = useState(false);
  const hasEditedRef = useRef(false);
  const locked = caseStatus === "submitted" || !!submittedAt;
  const router = useRouter();

  const load = useCallback(async () => {
    const res = await fetch(loadUrl);
    const json = await res.json().catch(() => ({}));
    const data = json.doctorAnswers;
    if (data) setAnswers(data);
    setLoading(false);
  }, [loadUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (id: string, value: string | number | string[] | boolean | null) => {
    hasEditedRef.current = true;
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const save = async (payload?: Record<string, unknown>) => {
    const toSave = payload ?? answers;
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ doctorAnswers: toSave }),
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

  const goToPhotos = async (href: string) => {
    setMessage(null);
    const err = validateDoctorAnswers(answers as Record<string, unknown>);
    if (err) {
      setMessage({ type: "err", text: err });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ doctorAnswers: answers }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Save failed");
      router.push(href);
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error)?.message ?? "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!hasEditedRef.current || locked) return;
    const t = setTimeout(() => save(undefined), 2000);
    return () => clearTimeout(t);
  }, [answers, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleSections = DOCTOR_AUDIT_SECTIONS.filter((sec) => {
    if (!sec.showWhen) return true;
    const val = answers[sec.showWhen.questionId];
    return sec.showWhen.oneOf.includes(String(val ?? ""));
  });

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
        <p className="text-sm text-gray-600">Target 6–8 min. Prefer selects/checkboxes.</p>
        {locked && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            Case submitted. Answers are locked.
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

          {photosNav && (
            <section className="rounded-xl border border-gray-200 bg-gray-50 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Add your photos</h2>
              <p className="text-sm text-gray-600">{photosNav.description ?? "Upload images in the next step."}</p>
            </section>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowReview(true)}
              className="rounded-lg px-5 py-2.5 text-sm font-medium bg-slate-800 text-white hover:bg-slate-700"
            >
              Review summary →
            </button>
          </div>
        </>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Review Summary</h2>
          <p className="text-sm text-gray-600 mb-6">
            Review your answers before saving and continuing to photos.
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
              ← Back to form
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
            Back to case
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
