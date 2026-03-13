import Link from "next/link";
import CreateCaseButton from "../../create-case-button";

export default function ClinicSubmitCasePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clinic-submitted case flow</h1>
          <p className="mt-1 text-sm text-slate-600">
            Launch a new clinic case, attach clinical evidence, and route it into your intelligence workspace.
          </p>
        </div>
        <Link
          href="/dashboard/clinic"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to portal
        </Link>
      </div>

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
