import Link from "next/link";

export default function BulkUploadDashboardCard() {
  return (
    <section className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50/90 to-slate-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-slate-900">Bulk Case Upload</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload multiple doctor-supplied cases in one batch using shared surgical details, draft case records, and
            drag-and-drop images.
          </p>
        </div>
        <Link
          href="/admin/hair-audit/bulk-upload"
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-500 bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          Start bulk upload →
        </Link>
      </div>
    </section>
  );
}
