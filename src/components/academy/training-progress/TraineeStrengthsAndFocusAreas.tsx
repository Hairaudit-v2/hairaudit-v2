type Props = {
  strengths: string[];
  nextFocus: string[];
  repeatedFocusAreas?: string[];
};

function Panel({
  title,
  subtitle,
  items,
  emptyText,
  tone,
}: {
  title: string;
  subtitle: string;
  items: string[];
  emptyText: string;
  tone: "emerald" | "amber";
}) {
  const shell =
    tone === "emerald"
      ? "border-emerald-200/90 bg-gradient-to-br from-emerald-50/80 via-white to-white ring-emerald-100"
      : "border-amber-200/90 bg-gradient-to-br from-amber-50/80 via-white to-white ring-amber-100";
  const dot = tone === "emerald" ? "bg-emerald-500" : "bg-amber-500";

  return (
    <div className={`rounded-2xl border p-6 shadow-sm ring-1 ${shell}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">{subtitle}</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
      {items.length ? (
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-slate-800">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{emptyText}</p>
      )}
    </div>
  );
}

export default function TraineeStrengthsAndFocusAreas({ strengths, nextFocus, repeatedFocusAreas = [] }: Props) {
  const focusItems = [
    ...nextFocus,
    ...repeatedFocusAreas.filter((item) => !nextFocus.some((f) => f.toLowerCase() === item.toLowerCase())),
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Panel
        subtitle="Developing well"
        title="Current strengths"
        items={strengths}
        emptyText="Strengths will appear from faculty case reviews as you build your review history."
        tone="emerald"
      />
      <Panel
        subtitle="Faculty guidance"
        title="Next training focus"
        items={focusItems}
        emptyText="Your faculty team will recommend next focus areas after case reviews are submitted."
        tone="amber"
      />
    </section>
  );
}
