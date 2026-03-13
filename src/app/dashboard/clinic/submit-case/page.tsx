import Link from "next/link";
import CreateCaseButton from "../../create-case-button";
import ClinicSectionHeader from "@/components/clinic-portal/ClinicSectionHeader";

export default function ClinicSubmitCasePage() {
  return (
    <div className="max-w-4xl">
      <ClinicSectionHeader
        title="Clinic-submitted Case Flow"
        subtitle="Launch a new clinic case, attach clinical evidence, and route it into your intelligence workspace."
        actions={[
          { href: "/dashboard/clinic/workspaces", label: "Manage Workspaces", variant: "primary" },
          { href: "/dashboard/clinic", label: "Overview" },
        ]}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Flow overview</h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          <li>1. Create case workspace (clinic ownership + channel tagging).</li>
          <li>2. Complete clinic audit form with methods, process data, and operational context.</li>
          <li>3. Upload documentation assets and submit for audit processing.</li>
          <li>4. Decide whether resulting case intelligence is public or internal-only.</li>
        </ol>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <CreateCaseButton variant="premium" />
          <Link
            href="/dashboard/clinic/workspaces"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Manage existing workspaces
          </Link>
        </div>
      </section>
    </div>
  );
}
