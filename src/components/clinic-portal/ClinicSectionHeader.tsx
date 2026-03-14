import Link from "next/link";

type Action = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

export default function ClinicSectionHeader({
  title,
  subtitle,
  badge,
  actions = [],
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: Action[];
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {badge ? (
            <span className="inline-flex items-center rounded-full border border-cyan-300 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-800">
              {badge}
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {actions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) => (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className={
                action.variant === "primary"
                  ? "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  : "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              }
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
