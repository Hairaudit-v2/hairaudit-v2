"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AI_REVIEW_IMAGE_LIMITATION_COPY,
  type AiReviewSectionSuggestion,
  type MappedAiSectionSuggestion,
  type TrainingCaseAiReviewDraftRow,
} from "@/lib/academy/trainingCaseReviews/aiDraftTypes";
import {
  createAiInsertAuditEntry,
  resolveAiDraftDisplayState,
  type AiInsertAuditEntry,
} from "@/lib/academy/trainingCaseReviews/aiInsertHelpers";
import {
  ConfidenceBadge,
  DraftStateBanner,
  InsertLinkButton,
  MissingPhotoWarning,
  confirmReplaceIfNeeded,
} from "./aiDraftUx";

type SectionField =
  | "what_went_well"
  | "needs_improvement"
  | "clinical_importance"
  | "next_case_focus"
  | "faculty_note";

type Props = {
  caseId: string;
  reviewId: string;
  activeImageCount: number;
  onApplySummary: (
    patch: {
      summary?: string;
      mainStrengths?: string[];
      improvementPriorities?: string[];
      recommendedNextFocus?: string;
    },
    mode: "append" | "replace",
  ) => void;
  onApplySection: (sectionKey: string, field: SectionField, text: string, mode: "append" | "replace") => void;
  onApplyFullSection: (sectionKey: string, suggestion: AiReviewSectionSuggestion, mode: "append" | "replace") => void;
  onRecordAudit: (entry: AiInsertAuditEntry) => void;
  hasSectionFieldText: (sectionKey: string, field: SectionField) => boolean;
  hasSectionAnyText: (sectionKey: string) => boolean;
  hasSummaryText: boolean;
  hasStrengthsText: boolean;
  hasImprovementText: boolean;
  hasNextFocusText: boolean;
};

export default function TrainingCaseAiDraftPanel({
  caseId,
  reviewId,
  activeImageCount,
  onApplySummary,
  onApplySection,
  onApplyFullSection,
  onRecordAudit,
  hasSectionFieldText,
  hasSectionAnyText,
  hasSummaryText,
  hasStrengthsText,
  hasImprovementText,
  hasNextFocusText,
}: Props) {
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

  function record(draftId: string, action: string, opts?: { sectionKey?: string; field?: string }) {
    onRecordAudit(createAiInsertAuditEntry(draftId, action, opts));
  }

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
            ? "AI draft could not be generated safely. See guidance below."
            : "AI draft generated. Insert suggestions individually — nothing is submitted automatically.",
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

  async function insertSummaryField(
    field: "summary" | "mainStrengths" | "improvementPriorities" | "recommendedNextFocus",
    value: string | string[],
    hasExisting: boolean,
  ) {
    if (!draft) return;
    const label =
      field === "summary"
        ? "Summary"
        : field === "mainStrengths"
          ? "Main strengths"
          : field === "improvementPriorities"
            ? "Improvement areas"
            : "Next focus";
    const mode = await confirmReplaceIfNeeded(label, hasExisting);
    if (mode === "cancel") return;

    if (field === "summary") onApplySummary({ summary: String(value) }, mode);
    else if (field === "mainStrengths") onApplySummary({ mainStrengths: value as string[] }, mode);
    else if (field === "improvementPriorities") onApplySummary({ improvementPriorities: value as string[] }, mode);
    else onApplySummary({ recommendedNextFocus: String(value) }, mode);

    record(draft.id, `insert_summary_${field}`, { field });
    setMsg(`Inserted into ${label}. Edit as needed, then save draft.`);
  }

  async function insertSectionField(s: MappedAiSectionSuggestion, field: SectionField, text: string) {
    if (!draft || !text.trim()) return;
    const labels: Record<SectionField, string> = {
      what_went_well: "What went well",
      needs_improvement: "Needs improvement",
      clinical_importance: "Why it matters clinically",
      next_case_focus: "Next case focus",
      faculty_note: "Faculty note",
    };
    const mode = await confirmReplaceIfNeeded(
      `${s.sectionTitle} — ${labels[field]}`,
      hasSectionFieldText(s.sectionKey, field),
    );
    if (mode === "cancel") return;
    onApplySection(s.sectionKey, field, text, mode);
    record(draft.id, "insert_section_field", { sectionKey: s.sectionKey, field });
    setMsg(`Inserted into ${s.sectionTitle}.`);
  }

  async function insertFullSection(s: MappedAiSectionSuggestion) {
    if (!draft) return;
    const mode = await confirmReplaceIfNeeded(s.sectionTitle, hasSectionAnyText(s.sectionKey));
    if (mode === "cancel") return;
    onApplyFullSection(s.sectionKey, s.suggestion, "append");
    record(draft.id, "insert_full_section", { sectionKey: s.sectionKey });
    setMsg(`Full suggestion inserted into ${s.sectionTitle}. Review each field before submitting.`);
  }

  const structured = draft?.structured_feedback as Record<string, unknown> | null | undefined;
  const imageQualityNotes = Array.isArray(structured?.imageQualityNotes)
    ? (structured.imageQualityNotes as string[])
    : [];
  const displayState = resolveAiDraftDisplayState(draft);
  const isFailed = displayState === "failed";
  const isNotConfigured = displayState === "not_configured";
  const isNoImages = displayState === "no_images" || (activeImageCount === 0 && draft && !isFailed);
  const canInsert = displayState === "ready" && !isFailed && !isNotConfigured;

  const missingCategories = draft?.missing_categories ?? [];

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-violet-950">AI-assisted draft feedback</h2>
        <p className="mt-1 text-xs text-violet-900/80 leading-relaxed">
          Generate draft observations from training images, then insert suggestions into the review form one at a time.
          Faculty must edit and submit — nothing is sent to the trainee automatically.
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
            {draft.image_count != null ? ` · ${draft.image_count} image(s) in draft` : ""}
            {activeImageCount !== draft.image_count ? ` · ${activeImageCount} active now` : ""}
          </p>

          {isFailed ? (
            <DraftStateBanner state="failed" errorMessage={draft.error_message} />
          ) : isNotConfigured ? (
            <DraftStateBanner state="not_configured" />
          ) : isNoImages ? (
            <DraftStateBanner state="no_images" imageCount={activeImageCount} />
          ) : null}

          <MissingPhotoWarning categories={missingCategories} />

          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
            {AI_REVIEW_IMAGE_LIMITATION_COPY}
          </p>

          {canInsert && (draft.strengths?.length || draft.improvement_areas?.length || draft.suggested_next_focus) ? (
            <div className="rounded-md border border-violet-100 bg-violet-50/50 p-3 space-y-3">
              <h3 className="text-xs font-semibold text-violet-950 uppercase tracking-wide">Apply summary suggestions</h3>
              <p className="text-xs text-slate-600">
                Inserts add an in-form AI label (removed when you save). Existing text is kept unless you choose replace.
              </p>
              <div className="flex flex-wrap gap-3">
                {draft.strengths?.length ? (
                  <InsertLinkButton
                    onClick={() => insertSummaryField("mainStrengths", draft.strengths!, hasStrengthsText)}
                  >
                    Insert strengths
                  </InsertLinkButton>
                ) : null}
                {draft.improvement_areas?.length ? (
                  <InsertLinkButton
                    onClick={() =>
                      insertSummaryField("improvementPriorities", draft.improvement_areas!, hasImprovementText)
                    }
                  >
                    Insert improvement areas
                  </InsertLinkButton>
                ) : null}
                {draft.suggested_next_focus ? (
                  <InsertLinkButton
                    onClick={() =>
                      insertSummaryField("recommendedNextFocus", draft.suggested_next_focus!, hasNextFocusText)
                    }
                  >
                    Insert next focus
                  </InsertLinkButton>
                ) : null}
                {draft.strengths?.length && draft.improvement_areas?.length && draft.suggested_next_focus ? (
                  <InsertLinkButton
                    onClick={async () => {
                      await insertSummaryField("mainStrengths", draft.strengths!, hasStrengthsText);
                      await insertSummaryField("improvementPriorities", draft.improvement_areas!, hasImprovementText);
                      await insertSummaryField("recommendedNextFocus", draft.suggested_next_focus!, hasNextFocusText);
                    }}
                  >
                    Insert all summary fields
                  </InsertLinkButton>
                ) : null}
              </div>
            </div>
          ) : null}

          {draft.overall_summary && canInsert ? (
            <DraftBlock title="Overall summary (optional)">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{draft.overall_summary}</p>
              <div className="flex flex-wrap gap-3 pt-1">
                <InsertLinkButton onClick={() => insertSummaryField("summary", draft.overall_summary!, hasSummaryText)}>
                  Insert into summary
                </InsertLinkButton>
                <InsertLinkButton onClick={() => copyText(draft.overall_summary!)}>Copy</InsertLinkButton>
                <InsertLinkButton onClick={() => dismissKey("overall_summary")}>Ignore</InsertLinkButton>
              </div>
            </DraftBlock>
          ) : null}

          {imageQualityNotes.length ? (
            <DraftBlock title="Image quality notes">
              <BulletList items={imageQualityNotes} />
            </DraftBlock>
          ) : null}

          {canInsert && draft.strengths?.length && !dismissed.has("strengths") ? (
            <DraftBlock title="Suggested strengths">
              <BulletList items={draft.strengths} />
              <SummaryActions
                onInsert={() => insertSummaryField("mainStrengths", draft.strengths!, hasStrengthsText)}
                onCopy={() => copyText(draft.strengths!.join("\n"))}
                onIgnore={() => dismissKey("strengths")}
              />
            </DraftBlock>
          ) : null}

          {canInsert && draft.improvement_areas?.length && !dismissed.has("improvement_areas") ? (
            <DraftBlock title="Suggested improvement areas">
              <BulletList items={draft.improvement_areas} />
              <SummaryActions
                onInsert={() => insertSummaryField("improvementPriorities", draft.improvement_areas!, hasImprovementText)}
                onCopy={() => copyText(draft.improvement_areas!.join("\n"))}
                onIgnore={() => dismissKey("improvement_areas")}
              />
            </DraftBlock>
          ) : null}

          {canInsert && draft.suggested_next_focus && !dismissed.has("suggested_next_focus") ? (
            <DraftBlock title="Suggested next training focus">
              <p className="text-sm text-slate-700">{draft.suggested_next_focus}</p>
              <SummaryActions
                onInsert={() =>
                  insertSummaryField("recommendedNextFocus", draft.suggested_next_focus!, hasNextFocusText)
                }
                onCopy={() => copyText(draft.suggested_next_focus!)}
                onIgnore={() => dismissKey("suggested_next_focus")}
              />
            </DraftBlock>
          ) : null}

          {draft.safety_notes?.length ? (
            <DraftBlock title="Cautions">
              <BulletList items={draft.safety_notes} />
            </DraftBlock>
          ) : null}

          {canInsert && sectionSuggestions.length ? (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">Section suggestions</h3>
              {sectionSuggestions.map((s) => {
                const key = `section:${s.sectionKey}`;
                if (dismissed.has(key)) return null;
                const sug = s.suggestion;
                return (
                  <div key={s.sectionKey} className="rounded-md border border-slate-100 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-800">{s.sectionTitle}</div>
                      <InsertLinkButton onClick={() => insertFullSection(s)}>
                        Insert full suggestion
                      </InsertLinkButton>
                    </div>
                    <ConfidenceBadge confidence={sug.confidence} />
                    {sug.whatWentWell ? <SuggestionField label="What went well" value={sug.whatWentWell} /> : null}
                    {sug.needsImprovement ? (
                      <SuggestionField label="Needs improvement" value={sug.needsImprovement} />
                    ) : null}
                    {sug.clinicalImportance ? (
                      <SuggestionField label="Why it matters clinically" value={sug.clinicalImportance} />
                    ) : null}
                    {sug.nextCaseFocus ? <SuggestionField label="Next case focus" value={sug.nextCaseFocus} /> : null}
                    {sug.imageLimitations ? (
                      <SuggestionField label="Image limitations" value={sug.imageLimitations} />
                    ) : null}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-slate-50">
                      {sug.whatWentWell ? (
                        <InsertLinkButton
                          onClick={() => insertSectionField(s, "what_went_well", sug.whatWentWell!)}
                        >
                          Insert “what went well”
                        </InsertLinkButton>
                      ) : null}
                      {sug.needsImprovement ? (
                        <InsertLinkButton
                          onClick={() => insertSectionField(s, "needs_improvement", sug.needsImprovement!)}
                        >
                          Insert “needs improvement”
                        </InsertLinkButton>
                      ) : null}
                      {sug.clinicalImportance ? (
                        <InsertLinkButton
                          onClick={() => insertSectionField(s, "clinical_importance", sug.clinicalImportance!)}
                        >
                          Insert “why it matters clinically”
                        </InsertLinkButton>
                      ) : null}
                      {sug.nextCaseFocus ? (
                        <InsertLinkButton
                          onClick={() => insertSectionField(s, "next_case_focus", sug.nextCaseFocus!)}
                        >
                          Insert “next case focus”
                        </InsertLinkButton>
                      ) : null}
                      <InsertLinkButton
                        onClick={() => {
                          const note = [sug.whatWentWell, sug.needsImprovement, sug.imageLimitations]
                            .filter(Boolean)
                            .join("\n\n");
                          if (note) void insertSectionField(s, "faculty_note", note);
                        }}
                      >
                        Insert “faculty note”
                      </InsertLinkButton>
                      <InsertLinkButton onClick={() => dismissKey(key)}>Ignore section</InsertLinkButton>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          No AI draft yet. Generate one to see suggestions — faculty control what gets inserted into the review.
        </p>
      )}
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

function SummaryActions({
  onInsert,
  onCopy,
  onIgnore,
}: {
  onInsert: () => void;
  onCopy: () => void;
  onIgnore: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 pt-1">
      <InsertLinkButton onClick={onInsert}>Insert into review</InsertLinkButton>
      <InsertLinkButton onClick={onCopy}>Copy</InsertLinkButton>
      <InsertLinkButton onClick={onIgnore}>Ignore</InsertLinkButton>
    </div>
  );
}
