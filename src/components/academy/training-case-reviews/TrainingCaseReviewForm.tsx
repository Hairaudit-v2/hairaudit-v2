"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TrainingCaseReviewSections from "./TrainingCaseReviewSections";
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
      summary: summary || null,
      main_strengths: mainStrengths
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      improvement_priorities: improvementPriorities
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      recommended_next_focus: recommendedNextFocus || null,
      faculty_recommendation: facultyRecommendation || null,
      sections: sectionList,
      images,
    };
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
      setMsg("Draft saved.");
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
        <Field label="Summary">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Supportive overview of the case and learning trajectory…"
          />
        </Field>
        <Field label="Main strengths (one per line)">
          <textarea
            value={mainStrengths}
            onChange={(e) => setMainStrengths(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Main improvement areas (one per line)">
          <textarea
            value={improvementPriorities}
            onChange={(e) => setImprovementPriorities(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Priority skill to work on next">
          <input
            value={recommendedNextFocus}
            onChange={(e) => setRecommendedNextFocus(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
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
