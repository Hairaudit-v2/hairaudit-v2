"use client";

import {
  DEVELOPMENTAL_LEVEL_LABELS,
  DEVELOPMENTAL_LEVELS,
  type TrainingCaseReviewSectionRow,
} from "@/lib/academy/trainingCaseReviews";

type Props = {
  sections: TrainingCaseReviewSectionRow[];
  readOnly?: boolean;
  values?: Record<string, Partial<TrainingCaseReviewSectionRow>>;
  onChange?: (sectionKey: string, field: string, value: string) => void;
};

function levelLabel(level: string | null | undefined) {
  if (!level) return null;
  if (level in DEVELOPMENTAL_LEVEL_LABELS) {
    return DEVELOPMENTAL_LEVEL_LABELS[level as keyof typeof DEVELOPMENTAL_LEVEL_LABELS];
  }
  return level;
}

export default function TrainingCaseReviewSections({ sections, readOnly, values, onChange }: Props) {
  return (
    <div className="space-y-4">
      {sections.map((s) => {
        const v = values?.[s.section_key] ?? s;
        const hasContent =
          v.developmental_level ||
          v.what_went_well ||
          v.needs_improvement ||
          v.clinical_importance ||
          v.next_case_focus ||
          v.faculty_note;

        if (readOnly && !hasContent) return null;

        return (
          <details
            key={s.section_key}
            className="rounded-lg border border-slate-200 bg-white open:shadow-sm"
            open={!readOnly || Boolean(v.developmental_level || v.needs_improvement)}
          >
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 flex flex-wrap items-center justify-between gap-2">
              <span>{s.section_title}</span>
              {v.developmental_level ? (
                <span className="text-xs font-medium text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full">
                  {levelLabel(v.developmental_level)}
                </span>
              ) : null}
            </summary>
            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
              {readOnly ? (
                <>
                  {v.what_went_well ? (
                    <Field label="What went well" value={v.what_went_well} tone="ok" />
                  ) : null}
                  {v.needs_improvement ? (
                    <Field label="What needs improvement" value={v.needs_improvement} tone="warn" />
                  ) : null}
                  {v.clinical_importance ? <Field label="Why it matters clinically" value={v.clinical_importance} /> : null}
                  {v.next_case_focus ? <Field label="Next case focus" value={v.next_case_focus} /> : null}
                  {v.faculty_note ? <Field label="Faculty note" value={v.faculty_note} /> : null}
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">Developmental level</label>
                    <select
                      value={v.developmental_level ?? ""}
                      onChange={(e) => onChange?.(s.section_key, "developmental_level", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">—</option>
                      {DEVELOPMENTAL_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {DEVELOPMENTAL_LEVEL_LABELS[l]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <TextArea
                    label="What went well"
                    value={v.what_went_well ?? ""}
                    onChange={(val) => onChange?.(s.section_key, "what_went_well", val)}
                  />
                  <TextArea
                    label="What needs improvement"
                    value={v.needs_improvement ?? ""}
                    onChange={(val) => onChange?.(s.section_key, "needs_improvement", val)}
                  />
                  <TextArea
                    label="Why it matters clinically"
                    value={v.clinical_importance ?? ""}
                    onChange={(val) => onChange?.(s.section_key, "clinical_importance", val)}
                  />
                  <TextArea
                    label="Practical next step for the next case"
                    value={v.next_case_focus ?? ""}
                    onChange={(val) => onChange?.(s.section_key, "next_case_focus", val)}
                  />
                  <TextArea
                    label="Faculty note"
                    value={v.faculty_note ?? ""}
                    onChange={(val) => onChange?.(s.section_key, "faculty_note", val)}
                  />
                </>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50/60 border-emerald-100"
      : tone === "warn"
        ? "bg-amber-50/60 border-amber-100"
        : "bg-slate-50/80 border-slate-100";
  return (
    <div className={`rounded-md border px-3 py-2 ${cls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}
