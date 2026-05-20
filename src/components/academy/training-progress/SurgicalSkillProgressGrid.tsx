import type { SkillProgressEntry, SkillTrendLabel } from "@/lib/academy/trainingCaseReviews";

type Props = {
  skills: SkillProgressEntry[];
};

function trendLabel(trend: SkillTrendLabel): string {
  switch (trend) {
    case "improving":
      return "Improving";
    case "stable":
      return "Stable";
    case "needs_attention":
      return "Needs continued focus";
    case "new_skill_area":
      return "New skill area";
    default:
      return "Not enough data yet";
  }
}

function trendTone(trend: SkillTrendLabel): string {
  switch (trend) {
    case "improving":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "stable":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "needs_attention":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    case "new_skill_area":
      return "bg-sky-100 text-sky-800 ring-sky-200";
    default:
      return "bg-slate-50 text-slate-500 ring-slate-200";
  }
}

function classificationLabel(c: SkillProgressEntry["classification"]): string {
  switch (c) {
    case "strength":
      return "Strength";
    case "focus_area":
      return "Focus area";
    default:
      return "Stable area";
  }
}

function classificationTone(c: SkillProgressEntry["classification"]): string {
  switch (c) {
    case "strength":
      return "text-emerald-700";
    case "focus_area":
      return "text-amber-800";
    default:
      return "text-slate-600";
  }
}

export default function SurgicalSkillProgressGrid({ skills }: Props) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Surgical skill progress</p>
        <h2 className="text-xl font-semibold text-slate-900">Skill progress grid</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Developmental levels from faculty Training Case Reviews. Trends compare your latest review to previous reviews.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((skill) => (
          <div
            key={skill.key}
            className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{skill.title}</h3>
              <span className={`shrink-0 text-[10px] font-semibold uppercase ${classificationTone(skill.classification)}`}>
                {classificationLabel(skill.classification)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {skill.currentLevelLabel ? (
                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                  {skill.currentLevelLabel}
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">Awaiting review data</span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${trendTone(skill.trend)}`}>
                {trendLabel(skill.trend)}
              </span>
            </div>
            {skill.latestNextCaseFocus ? (
              <p className="mt-3 text-xs text-slate-700">
                <span className="font-semibold text-slate-800">Next-case focus · </span>
                <span className="line-clamp-2">{skill.latestNextCaseFocus}</span>
              </p>
            ) : null}
            {skill.latestFacultyNotePreview ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-500 line-clamp-2">
                <span className="font-medium text-slate-600">Faculty note · </span>
                {skill.latestFacultyNotePreview}
              </p>
            ) : !skill.latestNextCaseFocus ? (
              <p className="mt-3 text-xs text-slate-400">Faculty notes will appear after case reviews are submitted.</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
