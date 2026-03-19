import Link from "next/link";

export type NextAction = { label: string; href: string };

export default function ProfileCompletenessCard({
  title = "Profile completeness",
  percentage,
  doneCount,
  totalChecks,
  nextActions,
}: {
  title?: string;
  percentage: number;
  doneCount: number;
  totalChecks: number;
  nextActions: NextAction[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-2xl font-bold text-slate-900">{percentage}%</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {doneCount} of {totalChecks} complete
          </p>
        </div>
      </div>
      {nextActions.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {nextActions.slice(0, 3).map((action, i) => (
            <li key={i}>
              <Link
                href={action.href}
                className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline"
              >
                {action.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
