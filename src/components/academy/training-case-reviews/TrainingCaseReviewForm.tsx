"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TrainingCaseReviewSections, { type ReviewSectionFieldKey } from "./TrainingCaseReviewSections";
import type { AiReviewSectionSuggestion } from "@/lib/academy/trainingCaseReviews/aiDraftTypes";
import {
  AI_INSERT_SOURCE_LABEL,
  appendAiInsertText,
  type AiInsertAuditEntry,
  stripAiInsertLabels,
  wrapAiInsertText,
} from "@/lib/academy/trainingCaseReviews/aiInsertHelpers";
import {
  CASE_DIFFICULTY_LABELS,
  CASE_DIFFICULTY_OPTIONS,
  DEVELOPMENTAL_LEVEL_LABELS,
  DEVELOPMENTAL_LEVELS,
  IMAGE_QUALITY_LABELS,
  IMAGE_QUALITY_LEVELS,
  REVIEW_DISCLAIMER,
  REVIEW_IMAGE_CATEGORIES,
  type TrainingCaseReviewBundle,
  type TrainingCaseReviewImageInput,
  type TrainingCaseReviewSectionInput,
} from "@/lib/academy/trainingCaseReviews";
import type { TrainingCaseUploadRow } from "@/lib/academy/types";
import { parseTrainingPhotoType } from "@/lib/academy/photoCategories";
import { isActiveTrainingCaseUpload } from "@/lib/academy/trainingCaseUploads";
import AcademySignedThumb from "@/components/academy/AcademySignedThumb";
import TrainingCaseAiDraftPanel from "./TrainingCaseAiDraftPanel";

type Props = {
  caseId: string;
  reviewId: string;
  initial: TrainingCaseReviewBundle;
  uploads: TrainingCaseUploadRow[];
};

type SectionState = Record<string, TrainingCaseReviewSectionInput & { section_key: string }>;

export default function TrainingCaseReviewForm({ caseId, reviewId, initial, uploads }: Props) {
  const router = useRouter();
  const activeUploads = uploads.filter(isActiveTrainingCaseUpload);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [overallLevel, setOverallLevel] = useState(initial.review.overall_level ?? "");
  const [caseDifficulty, setCaseDifficulty] = useState(initial.review.case_difficulty ?? "");
  const [traineeStage, setTraineeStage] = useState(initial.review.trainee_stage ?? "");
  const [summary, setSummary] = useState(initial.review.summary ?? "");
  const [mainStrengths, setMainStrengths] = useState((initial.review.main_strengths ?? []).join("\n"));
  const [improvementPriorities, setImprovementPriorities] = useState(
    (initial.review.improvement_priorities ?? []).join("\n"),
  );
  const [recommendedNextFocus, setRecommendedNextFocus] = useState(initial.review.recommended_next_focus ?? "");
  const [facultyRecommendation, setFacultyRecommendation] = useState(initial.review.faculty_recommendation ?? "");

  const auditStorageKey = `training-review-ai-audit:${reviewId}`;
  const [aiInsertAudit, setAiInsertAudit] = useState<AiInsertAuditEntry[]>([]);
  const [aiMarkedSections, setAiMarkedSections] = useState<
    Record<string, Partial<Record<ReviewSectionFieldKey, boolean>>>
  >({});
  const [aiMarkedSummary, setAiMarkedSummary] = useState({
    summary: false,
    mainStrengths: false,
    improvementPriorities: false,
    recommendedNextFocus: false,
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(auditStorageKey);
      if (raw) setAiInsertAudit(JSON.parse(raw) as AiInsertAuditEntry[]);
    } catch {
      /* ignore */
    }
  }, [auditStorageKey]);

  const recordAiInsert = useCallback(
    (entry: AiInsertAuditEntry) => {
      setAiInsertAudit((prev) => {
        const next = [...prev, entry];
        try {
          sessionStorage.setItem(auditStorageKey, JSON.stringify(next.slice(-40)));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [auditStorageKey],
  );

  const [sections, setSections] = useState<SectionState>(() => {
    const m: SectionState = {};
    for (const s of initial.sections) {
      m[s.section_key] = {
        section_key: s.section_key,
        developmental_level: s.developmental_level,
        what_went_well: s.what_went_well,
        needs_improvement: s.needs_improvement,
        clinical_importance: s.clinical_importance,
        next_case_focus: s.next_case_focus,
        faculty_note: s.faculty_note,
      };
    }
    return m;
  });

  const uploadsByCategory = useMemo(() => {
    const m = new Map<string, TrainingCaseUploadRow[]>();
    for (const u of activeUploads) {
      const cat = parseTrainingPhotoType(u.type);
      if (!cat) continue;
      const list = m.get(cat) ?? [];
      list.push(u);
      m.set(cat, list);
    }
    return m;
  }, [activeUploads]);

  const [imageComments, setImageComments] = useState<Record<string, { comment: string; quality: string; uploadId: string }>>(
    () => {
      const m: Record<string, { comment: string; quality: string; uploadId: string }> = {};
      for (const img of initial.images) {
        m[img.image_category] = {
          comment: img.reviewer_comment ?? "",
          quality: img.image_quality_level ?? "",
          uploadId: img.image_id ?? "",
        };
      }
      for (const cat of REVIEW_IMAGE_CATEGORIES) {
        if (m[cat.key]) continue;
        const linked = cat.linkedUploadCategory ? uploadsByCategory.get(cat.linkedUploadCategory)?.[0] : undefined;
        m[cat.key] = { comment: "", quality: "", uploadId: linked?.id ?? "" };
      }
      return m;
    },
  );

  const onSectionChange = useCallback((sectionKey: string, field: string, value: string) => {
    setSections((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey]!, [field]: value || null },
    }));
  }, []);

  const markSectionField = useCallback((sectionKey: string, field: ReviewSectionFieldKey) => {
    setAiMarkedSections((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], [field]: true },
    }));
  }, []);

  const applyText = useCallback((existing: string, incoming: string, mode: "append" | "replace") => {
    const wrapped = wrapAiInsertText(incoming);
    if (mode === "replace") return wrapped;
    return appendAiInsertText(existing, incoming);
  }, []);

  const onApplyAiSummary = useCallback(
    (
      patch: {
        summary?: string;
        mainStrengths?: string[];
        improvementPriorities?: string[];
        recommendedNextFocus?: string;
      },
      mode: "append" | "replace",
    ) => {
      if (patch.summary) {
        setSummary((prev) => applyText(prev, patch.summary!, mode));
        setAiMarkedSummary((m) => ({ ...m, summary: true }));
      }
      if (patch.mainStrengths?.length) {
        const block = patch.mainStrengths.join("\n");
        setMainStrengths((prev) => applyText(prev, block, mode));
        setAiMarkedSummary((m) => ({ ...m, mainStrengths: true }));
      }
      if (patch.improvementPriorities?.length) {
        const block = patch.improvementPriorities.join("\n");
        setImprovementPriorities((prev) => applyText(prev, block, mode));
        setAiMarkedSummary((m) => ({ ...m, improvementPriorities: true }));
      }
      if (patch.recommendedNextFocus) {
        setRecommendedNextFocus((prev) => applyText(prev, patch.recommendedNextFocus!, mode));
        setAiMarkedSummary((m) => ({ ...m, recommendedNextFocus: true }));
      }
      setMsg("AI suggestion inserted — review, edit, then save draft. Labels are removed on save.");
    },
    [applyText],
  );

  const onApplyAiSection = useCallback(
    (
      sectionKey: string,
      field: ReviewSectionFieldKey,
      text: string,
      mode: "append" | "replace",
    ) => {
      setSections((prev) => {
        const cur = prev[sectionKey] ?? { section_key: sectionKey };
        const existing = (cur[field] as string | null | undefined) ?? "";
        const next = mode === "replace" ? wrapAiInsertText(text) : appendAiInsertText(existing, text);
        return {
          ...prev,
          [sectionKey]: { ...cur, section_key: sectionKey, [field]: next },
        };
      });
      markSectionField(sectionKey, field);
      setMsg("AI suggestion inserted — review, edit, then save draft.");
    },
    [markSectionField],
  );

  const onApplyFullSection = useCallback(
    (sectionKey: string, suggestion: AiReviewSectionSuggestion, mode: "append" | "replace") => {
      const fields: { key: ReviewSectionFieldKey; text?: string | null }[] = [
        { key: "what_went_well", text: suggestion.whatWentWell },
        { key: "needs_improvement", text: suggestion.needsImprovement },
        { key: "clinical_importance", text: suggestion.clinicalImportance },
        { key: "next_case_focus", text: suggestion.nextCaseFocus },
      ];
      for (const f of fields) {
        if (f.text?.trim()) onApplyAiSection(sectionKey, f.key, f.text, mode);
      }
      if (suggestion.imageLimitations?.trim()) {
        onApplyAiSection(sectionKey, "faculty_note", suggestion.imageLimitations, "append");
      }
    },
    [onApplyAiSection],
  );

  const hasSectionFieldText = useCallback(
    (sectionKey: string, field: ReviewSectionFieldKey) => {
      const v = sections[sectionKey]?.[field];
      return Boolean(v && String(v).trim());
    },
    [sections],
  );

  const hasSectionAnyText = useCallback(
    (sectionKey: string) => {
      const keys: ReviewSectionFieldKey[] = [
        "what_went_well",
        "needs_improvement",
        "clinical_importance",
        "next_case_focus",
        "faculty_note",
      ];
      return keys.some((f) => hasSectionFieldText(sectionKey, f));
    },
    [hasSectionFieldText],
  );

  function buildPayload() {
    const sectionList = Object.values(sections).map((s) => ({
      section_key: s.section_key,
      developmental_level: s.developmental_level || null,
      what_went_well: s.what_went_well || null,
      needs_improvement: s.needs_improvement || null,
      clinical_importance: s.clinical_importance || null,
      next_case_focus: s.next_case_focus || null,
      faculty_note: s.faculty_note || null,
    }));

    const images: TrainingCaseReviewImageInput[] = REVIEW_IMAGE_CATEGORIES.map((cat, i) => {
      const st = imageComments[cat.key];
      if (!st?.uploadId && !st?.comment?.trim()) return null;
      const existing = initial.images.find((im) => im.image_category === cat.key);
      return {
        id: existing?.id,
        image_id: st?.uploadId || null,
        image_category: cat.key,
        reviewer_comment: st?.comment?.trim() || null,
        image_quality_level: st?.quality?.trim() || null,
        sort_order: i,
      };
    }).filter(Boolean) as TrainingCaseReviewImageInput[];

    return {
      overall_level: overallLevel || null,
      case_difficulty: caseDifficulty || null,
      trainee_stage: traineeStage || null,
      summary: stripAiInsertLabels(summary),
      main_strengths: (stripAiInsertLabels(mainStrengths) ?? "")
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      improvement_priorities: (stripAiInsertLabels(improvementPriorities) ?? "")
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      recommended_next_focus: stripAiInsertLabels(recommendedNextFocus),
      faculty_recommendation: stripAiInsertLabels(facultyRecommendation),
      sections: sectionList.map((s) => ({
        ...s,
        what_went_well: stripAiInsertLabels(s.what_went_well),
        needs_improvement: stripAiInsertLabels(s.needs_improvement),
        clinical_importance: stripAiInsertLabels(s.clinical_importance),
        next_case_focus: stripAiInsertLabels(s.next_case_focus),
        faculty_note: stripAiInsertLabels(s.faculty_note),
      })),
      images,
    };
  }

  function clearAiMarksAfterSave() {
    setAiMarkedSections({});
    setAiMarkedSummary({
      summary: false,
      mainStrengths: false,
      improvementPriorities: false,
      recommendedNextFocus: false,
    });
  }

  async function saveDraft() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/academy/training-case-reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      clearAiMarksAfterSave();
      setMsg("Draft saved. AI source labels were removed from stored text.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    setBusy(true);
    setMsg(null);
    try {
      const saveRes = await fetch(`/api/academy/training-case-reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const saveJ = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveJ.error || "Save failed");

      const res = await fetch(`/api/academy/training-case-reviews/${reviewId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Submit failed");
      setMsg("Review submitted. The trainee can now view this feedback.");
      router.push(`/academy/training-cases/${caseId}?reviewId=${reviewId}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-600 leading-relaxed rounded-lg bg-sky-50 border border-sky-100 px-3 py-2">
        {REVIEW_DISCLAIMER}
      </p>

      <TrainingCaseAiDraftPanel
        caseId={caseId}
        reviewId={reviewId}
        activeImageCount={activeUploads.length}
        onApplySummary={onApplyAiSummary}
        onApplySection={onApplyAiSection}
        onApplyFullSection={onApplyFullSection}
        onRecordAudit={recordAiInsert}
        hasSectionFieldText={hasSectionFieldText}
        hasSectionAnyText={hasSectionAnyText}
        hasSummaryText={Boolean(summary.trim())}
        hasStrengthsText={Boolean(mainStrengths.trim())}
        hasImprovementText={Boolean(improvementPriorities.trim())}
        hasNextFocusText={Boolean(recommendedNextFocus.trim())}
      />

      {aiInsertAudit.length ? (
        <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">AI insert activity (this session)</summary>
          <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {aiInsertAudit
              .slice()
              .reverse()
              .map((e, i) => (
                <li key={`${e.at}-${i}`}>
                  {new Date(e.at).toLocaleTimeString()} · {e.action}
                  {e.sectionKey ? ` · ${e.sectionKey}` : ""}
                  {e.field ? ` · ${e.field}` : ""}
                  <span className="text-slate-400"> · draft {e.aiDraftId.slice(0, 8)}</span>
                </li>
              ))}
          </ul>
        </details>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Overall review summary</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Trainee stage">
            <input
              value={traineeStage}
              onChange={(e) => setTraineeStage(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Case difficulty">
            <select
              value={caseDifficulty}
              onChange={(e) => setCaseDifficulty(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {CASE_DIFFICULTY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {CASE_DIFFICULTY_LABELS[o]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Overall developmental level">
            <select
              value={overallLevel}
              onChange={(e) => setOverallLevel(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {DEVELOPMENTAL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {DEVELOPMENTAL_LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <SummaryField
          label="Summary"
          value={summary}
          showAiMark={aiMarkedSummary.summary || summary.includes(AI_INSERT_SOURCE_LABEL)}
          onChange={setSummary}
          rows={3}
          placeholder="Supportive overview of the case and learning trajectory…"
        />
        <SummaryField
          label="Main strengths (one per line)"
          value={mainStrengths}
          showAiMark={aiMarkedSummary.mainStrengths || mainStrengths.includes(AI_INSERT_SOURCE_LABEL)}
          onChange={setMainStrengths}
          rows={2}
        />
        <SummaryField
          label="Main improvement areas (one per line)"
          value={improvementPriorities}
          showAiMark={
            aiMarkedSummary.improvementPriorities || improvementPriorities.includes(AI_INSERT_SOURCE_LABEL)
          }
          onChange={setImprovementPriorities}
          rows={2}
        />
        <SummaryField
          label="Priority skill to work on next"
          value={recommendedNextFocus}
          showAiMark={
            aiMarkedSummary.recommendedNextFocus || recommendedNextFocus.includes(AI_INSERT_SOURCE_LABEL)
          }
          onChange={setRecommendedNextFocus}
          rows={1}
          singleLine
        />
        <Field label="Faculty recommendation">
          <textarea
            value={facultyRecommendation}
            onChange={(e) => setFacultyRecommendation(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Category feedback</h2>
        <TrainingCaseReviewSections
          sections={initial.sections}
          values={sections as Record<string, (typeof initial.sections)[0]>}
          onChange={onSectionChange}
          aiMarkedFields={aiMarkedSections}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Image review</h2>
        <p className="text-xs text-slate-500">Link case photos and add coaching comments. Follow-up slots may be empty if not yet uploaded.</p>
        <div className="space-y-4">
          {REVIEW_IMAGE_CATEGORIES.map((cat) => {
            const st = imageComments[cat.key] ?? { comment: "", quality: "", uploadId: "" };
            const options = cat.linkedUploadCategory ? (uploadsByCategory.get(cat.linkedUploadCategory) ?? []) : activeUploads;
            const selected = activeUploads.find((u) => u.id === st.uploadId);
            return (
              <div key={cat.key} className="rounded-lg border border-slate-100 p-3 space-y-2">
                <div className="text-sm font-medium text-slate-800">{cat.title}</div>
                {options.length ? (
                  <select
                    value={st.uploadId}
                    onChange={(e) =>
                      setImageComments((prev) => ({
                        ...prev,
                        [cat.key]: { ...st, uploadId: e.target.value },
                      }))
                    }
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">No image linked</option>
                    {options.map((u) => (
                      <option key={u.id} value={u.id}>
                        {parseTrainingPhotoType(u.type) ?? u.type} · {new Date(u.created_at).toLocaleString()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-slate-400">No matching uploads for this slot yet.</p>
                )}
                {selected ? (
                  <div className="max-w-[200px]">
                    <AcademySignedThumb storagePath={selected.storage_path} label={cat.title} />
                  </div>
                ) : null}
                <select
                  value={st.quality}
                  onChange={(e) =>
                    setImageComments((prev) => ({
                      ...prev,
                      [cat.key]: { ...st, quality: e.target.value },
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Image quality —</option>
                  {IMAGE_QUALITY_LEVELS.map((q) => (
                    <option key={q} value={q}>
                      {IMAGE_QUALITY_LABELS[q]}
                    </option>
                  ))}
                </select>
                <textarea
                  value={st.comment}
                  onChange={(e) =>
                    setImageComments((prev) => ({
                      ...prev,
                      [cat.key]: { ...st, comment: e.target.value },
                    }))
                  }
                  rows={2}
                  placeholder="Faculty comment on this image…"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={saveDraft}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={submitReview}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit review to trainee"}
        </button>
      </div>
      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SummaryField({
  label,
  value,
  onChange,
  showAiMark,
  rows = 2,
  placeholder,
  singleLine,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  showAiMark?: boolean;
  rows?: number;
  placeholder?: string;
  singleLine?: boolean;
}) {
  const cls = `w-full rounded-md border px-2 py-1.5 text-sm ${
    showAiMark ? "border-violet-200 bg-violet-50/30" : "border-slate-300"
  }`;
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      {showAiMark ? (
        <p className="mt-0.5 text-[10px] text-violet-700 bg-violet-50 border border-violet-100 rounded px-1.5 py-0.5 inline-block">
          {AI_INSERT_SOURCE_LABEL}
        </p>
      ) : null}
      {singleLine ? (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}
