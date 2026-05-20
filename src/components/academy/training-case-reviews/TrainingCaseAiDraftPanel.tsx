"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AI_REVIEW_IMAGE_LIMITATION_COPY,
  type MappedAiSectionSuggestion,
  type TrainingCaseAiReviewDraftRow,
} from "@/lib/academy/trainingCaseReviews/aiDraftTypes";
type Props = {
  caseId: string;
  reviewId: string;
  onApplySummary: (patch: {
    summary?: string;
    mainStrengths?: string[];
    improvementPriorities?: string[];
    recommendedNextFocus?: string;
  }) => void;
  onApplySection: (
    sectionKey: string,
    field: "what_went_well" | "needs_improvement" | "clinical_importance" | "next_case_focus" | "faculty_note",
    text: string,
    mode: "replace" | "append",
  ) => void;
};

export default function TrainingCaseAiDraftPanel({ caseId, reviewId, onApplySummary, onApplySection }: Props) {
  const [draft, setDraft] = useState<TrainingCaseAiReviewDraftRow | null>(null);
  const [sectionSuggestions, setSectionSuggestions] = useState<MappedAiSectionSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const loadLatest = useCallback(async () => {
    const res = await fetch(
      `/api/academy/training-cases/${caseId}/ai-review-draft?latest=1&reviewId=${encodeURIComponent(reviewId)}`,
    );
    const j = await res.json();
    if (res.ok && j.draft) {
      setDraft(j.draft);
      setSectionSuggestions(j.sectionSuggestions ?? []);
    }
  }, [caseId, reviewId]);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  async function generateDraft() {
    setBusy(true);
    setMsg(null);
    setDismissed(new Set());
    try {
      const res = await fetch(`/api/academy/training-cases/${caseId}/ai-review-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Generation failed");
      setDraft(j.draft);
      setSectionSuggestions(j.sectionSuggestions ?? []);
      setMsg(
        typeof j.staffMessage === "string"
          ? j.staffMessage
          : j.draft?.status === "failed"
            ? "AI draft could not be generated safely. Enter feedback manually or try again."
            : "AI draft generated. Review and edit all suggestions before submitting.",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  function dismissKey(key: string) {
    setDismissed((prev) => new Set(prev).add(key));
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Copied to clipboard.");
    } catch {
      setMsg("Could not copy — select text manually.");
    }
  }

  const structured = draft?.structured_feedback as Record<string, unknown> | null | undefined;
  const imageQualityNotes = Array.isArray(structured?.imageQualityNotes)
    ? (structured.imageQualityNotes as string[])
    : [];
  const isPlaceholder = Boolean(structured?.placeholder);
  const isFailed = draft?.status === "failed";

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-violet-950">AI-assisted draft feedback</h2>
        <p className="mt-1 text-xs text-violet-900/80 leading-relaxed">
          Use this to generate draft observations from the uploaded training case images. Faculty must review and edit
          all suggestions before feedback is submitted.
        </p>
        <p className="mt-2 text-xs font-medium text-violet-800 rounded-md bg-violet-100/80 border border-violet-200 px-2 py-1.5">
          AI-generated · unverified · internal faculty tool only
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={generateDraft}
        className="rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
      >
        {busy ? "Generating…" : "Generate AI draft feedback"}
      </button>

      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}

      {draft ? (
        <div className="space-y-4 rounded-lg border border-violet-100 bg-white p-3">
          <p className="text-xs text-slate-500">
            Generated {new Date(draft.created_at).toLocaleString()}
            {draft.ai_model ? ` · ${draft.ai_model}` : ""}
            {isPlaceholder ? " · placeholder (AI not configured)" : ""}
            {isFailed ? " · generation failed" : ""}
          </p>

          {isFailed && draft.error_message ? (
            <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-md px-2 py-1.5">
              {draft.error_message}
            </p>
          ) : null}

          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
            {AI_REVIEW_IMAGE_LIMITATION_COPY}
          </p>

          {draft.overall_summary ? (
            <DraftBlock title="Overall summary">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{draft.overall_summary}</p>
              {!isFailed && !isPlaceholder ? (
                <ActionRow
                  onCopy={() => copyText(draft.overall_summary!)}
                  onInsert={() => onApplySummary({ summary: draft.overall_summary! })}
                  onIgnore={() => dismissKey("overall_summary")}
                  hidden={dismissed.has("overall_summary")}
                />
              ) : null}
            </DraftBlock>
          ) : null}

          {draft.missing_categories?.length ? (
            <DraftBlock title="Missing photo categories">
              <ul className="text-sm text-slate-700 list-disc pl-4">
                {draft.missing_categories.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </DraftBlock>
          ) : null}

          {imageQualityNotes.length ? (
            <DraftBlock title="Image quality notes">
              <ul className="text-sm text-slate-700 list-disc pl-4">
                {imageQualityNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </DraftBlock>
          ) : null}

          {!isFailed && draft.strengths?.length ? (
            <DraftBlock title="Suggested strengths">
              <BulletList items={draft.strengths} />
              <ActionRow
                onCopy={() => copyText(draft.strengths!.join("\n"))}
                onInsert={() => onApplySummary({ mainStrengths: draft.strengths! })}
                onIgnore={() => dismissKey("strengths")}
                hidden={dismissed.has("strengths")}
              />
            </DraftBlock>
          ) : null}

          {!isFailed && draft.improvement_areas?.length ? (
            <DraftBlock title="Suggested improvement areas">
              <BulletList items={draft.improvement_areas} />
              <ActionRow
                onCopy={() => copyText(draft.improvement_areas!.join("\n"))}
                onInsert={() => onApplySummary({ improvementPriorities: draft.improvement_areas! })}
                onIgnore={() => dismissKey("improvement_areas")}
                hidden={dismissed.has("improvement_areas")}
              />
            </DraftBlock>
          ) : null}

          {!isFailed && draft.suggested_next_focus ? (
            <DraftBlock title="Suggested next training focus">
              <p className="text-sm text-slate-700">{draft.suggested_next_focus}</p>
              <ActionRow
                onCopy={() => copyText(draft.suggested_next_focus!)}
                onInsert={() => onApplySummary({ recommendedNextFocus: draft.suggested_next_focus! })}
                onIgnore={() => dismissKey("suggested_next_focus")}
                hidden={dismissed.has("suggested_next_focus")}
              />
            </DraftBlock>
          ) : null}

          {draft.safety_notes?.length ? (
            <DraftBlock title="Cautions">
              <BulletList items={draft.safety_notes} />
            </DraftBlock>
          ) : null}

          {!isFailed && sectionSuggestions.length ? (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">Section suggestions</h3>
              {sectionSuggestions.map((s) => {
                const key = `section:${s.sectionKey}`;
                if (dismissed.has(key)) return null;
                return (
                  <div key={s.sectionKey} className="rounded-md border border-slate-100 p-3 space-y-2">
                    <div className="text-sm font-medium text-slate-800">{s.sectionTitle}</div>
                    {s.suggestion.confidence ? (
                      <span className="text-xs text-slate-500">Confidence: {s.suggestion.confidence}</span>
                    ) : null}
                    {s.suggestion.whatWentWell ? (
                      <SuggestionField label="What went well" value={s.suggestion.whatWentWell} />
                    ) : null}
                    {s.suggestion.needsImprovement ? (
                      <SuggestionField label="Needs improvement" value={s.suggestion.needsImprovement} />
                    ) : null}
                    {s.suggestion.clinicalImportance ? (
                      <SuggestionField label="Clinical importance" value={s.suggestion.clinicalImportance} />
                    ) : null}
                    {s.suggestion.nextCaseFocus ? (
                      <SuggestionField label="Next case focus" value={s.suggestion.nextCaseFocus} />
                    ) : null}
                    {s.suggestion.imageLimitations ? (
                      <SuggestionField label="Image limitations" value={s.suggestion.imageLimitations} />
                    ) : null}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {s.suggestion.whatWentWell ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-violet-800 hover:underline"
                          onClick={() =>
                            onApplySection(s.sectionKey, "what_went_well", s.suggestion.whatWentWell!, "append")
                          }
                        >
                          Insert “what went well”
                        </button>
                      ) : null}
                      {s.suggestion.needsImprovement ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-violet-800 hover:underline"
                          onClick={() =>
                            onApplySection(s.sectionKey, "needs_improvement", s.suggestion.needsImprovement!, "append")
                          }
                        >
                          Insert “needs improvement”
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs font-medium text-slate-600 hover:underline"
                        onClick={() => {
                          const note = [
                            s.suggestion.whatWentWell,
                            s.suggestion.needsImprovement,
                            s.suggestion.imageLimitations,
                          ]
                            .filter(Boolean)
                            .join("\n\n");
                          if (note) onApplySection(s.sectionKey, "faculty_note", note, "append");
                        }}
                      >
                        Insert into faculty note
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-slate-500 hover:underline"
                        onClick={() => dismissKey(key)}
                      >
                        Ignore
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DraftBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="text-sm text-slate-700 list-disc pl-4">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function SuggestionField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function ActionRow({
  onCopy,
  onInsert,
  onIgnore,
  hidden,
}: {
  onCopy: () => void;
  onInsert: () => void;
  onIgnore: () => void;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <div className="flex flex-wrap gap-3 pt-1">
      <button type="button" onClick={onInsert} className="text-xs font-medium text-violet-800 hover:underline">
        Insert into review
      </button>
      <button type="button" onClick={onCopy} className="text-xs font-medium text-slate-600 hover:underline">
        Copy
      </button>
      <button type="button" onClick={onIgnore} className="text-xs font-medium text-slate-500 hover:underline">
        Ignore
      </button>
    </div>
  );
}
