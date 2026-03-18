import Link from "next/link";
import CreateCaseButton from "../../create-case-button";
import ClinicSectionHeader from "@/components/clinic-portal/ClinicSectionHeader";
import ClinicConversionPanel from "@/components/clinic-portal/ClinicConversionPanel";

export default function ClinicSubmitCasePage() {
  return (
    <div className="max-w-4xl">
      <ClinicSectionHeader
        title="Submitted Cases"
        subtitle="Create cases your clinic owns and submits (Submitted Cases). Strengthen internal QA, public credibility, and benchmarking."
        actions={[
          { href: "/dashboard/clinic/workspaces", label: "Invited Contributions", variant: "primary" },
          { href: "/dashboard/clinic", label: "Overview" },
        ]}
      />

      <div className="mb-6">
        <ClinicConversionPanel
          title="Case submission conversion path"
          subtitle="Consistent Submitted Cases transform clinical operations into attributable trust and performance intelligence."
          nextActions={[
            { label: "Submit your first case (Submitted Case)", href: "/dashboard/clinic/submit-case" },
            { label: "Respond to Invited Contributions", href: "/dashboard/clinic/workspaces" },
            { label: "Prepare your public profile", href: "/dashboard/clinic/profile" },
          ]}
          readinessStates={[
            { label: "Basic Profile Complete", ready: true },
            { label: "Enhanced Trust Profile", ready: true },
            { label: "Benchmark Ready", ready: false },
            { label: "Public Listing In Progress", ready: true },
            { label: "Training Ready", ready: false },
          ]}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Flow overview</h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          <li>1. Create a Submitted Case (clinic-owned) with clear attribution.</li>
          <li>2. Complete structured clinical details: methods, operative context, and evidence framing.</li>
          <li>3. Upload quality documentation assets and submit for audit processing.</li>
          <li>4. Set visibility strategy: internal QA intelligence or public trust asset.</li>
        </ol>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <CreateCaseButton variant="premium" />
          <Link
            href="/dashboard/clinic/workspaces"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View Invited Contributions
          </Link>
        </div>
      </section>
    </div>
  );
}
