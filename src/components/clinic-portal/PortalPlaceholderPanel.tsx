import Link from "next/link";
import ClinicSectionHeader from "./ClinicSectionHeader";

export default function PortalPlaceholderPanel({
  title,
  subtitle,
  recommendation,
}: {
  title: string;
  subtitle: string;
  recommendation: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <ClinicSectionHeader
        title={title}
        subtitle={subtitle}
        badge="Coming Soon"
        actions={[{ href: "/dashboard/clinic", label: "Back to Overview" }]}
      />
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm text-slate-700">{recommendation}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/clinic/profile"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Manage Clinic Profile
          </Link>
          <Link
            href="/dashboard/clinic/workspaces"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Invited Contributions
          </Link>
        </div>
      </div>
    </div>
  );
}
