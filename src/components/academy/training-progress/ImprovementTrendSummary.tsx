import type { ImprovementTrendSummary } from "@/lib/academy/trainingCaseReviews";

type Props = {
  trend: ImprovementTrendSummary;
};

function ListBlock({ title, items, emptyText, tone }: { title: string; items: string[]; emptyText: string; tone: "emerald" | "slate" | "amber" }) {
  const bg =
    tone === "emerald" ? "bg-emerald-50/80 border-emerald-100" : tone === "amber" ? "bg-amber-50/80 border-amber-100" : "bg-slate-50/80 border-slate-100";
  return (
    <div className={`rounded-xl border px-4 py-3 ${bg}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{title}</p>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-800">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-slate-400">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-500">{emptyText}</p>
      )}
    </div>
  );
}

export default function ImprovementTrendSummary({ trend }: Props) {
  if (!trend.hasEnoughData) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/80 px-6 py-8">
        <p className="text-sm font-medium text-slate-700">Improvement trends</p>
        <p className="mt-1 text-xs text-slate-500">
          After at least two submitted case reviews, this section will compare your latest review to previous reviews and
          highlight skills that are improving, staying consistent, or needing repeated focus.
        </p>
        {trend.facultyRecommendedNextStep ? (
          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/80 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase text-amber-800">Faculty-recommended next step</p>
            <p className="mt-1 text-sm text-amber-950">{trend.facultyRecommendedNextStep}</p>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Progress comparison</p>
        <h2 className="text-xl font-semibold text-slate-900">Improvement trend summary</h2>
        <p className="mt-1 text-sm text-slate-600">Comparing your latest submitted review to previous reviews.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ListBlock
          title="Skills improving"
          items={trend.improvedSkills}
          emptyText="No upward movement detected yet — keep building supervised repetition."
          tone="emerald"
        />
        <ListBlock
          title="Consistent skills"
          items={trend.consistentSkills}
          emptyText="Consistency patterns will appear as more reviews are submitted."
          tone="slate"
        />
        <ListBlock
          title="Repeated focus areas"
          items={trend.repeatedFocusSkills}
          emptyText="No recurring focus flags — faculty guidance is tracking well."
          tone="amber"
        />
      </div>
      {trend.biggestPositiveMovement ? (
        <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 to-white p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Biggest positive movement</p>
          <p className="mt-1 text-sm text-emerald-950">
            <span className="font-semibold">{trend.biggestPositiveMovement.skill}</span>:{" "}
            {trend.biggestPositiveMovement.from} → {trend.biggestPositiveMovement.to}
          </p>
        </div>
      ) : null}
      {trend.facultyRecommendedNextStep ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">Faculty-recommended next step</p>
          <p className="mt-1 text-sm text-amber-950">{trend.facultyRecommendedNextStep}</p>
        </div>
      ) : null}
    </section>
  );
}
