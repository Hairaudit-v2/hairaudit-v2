import Link from "next/link";

export default function NextBestStepPanel({
  action,
}: {
  action: { label: string; href: string };
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Next best step</h3>
      <Link
        href={action.href}
        className="mt-2 inline-flex items-center rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
      >
        {action.label}
      </Link>
    </div>
  );
}
