import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function BetaAccessMessagePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader variant="minimal" />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">HairAudit Beta Program</h1>
          <p className="mt-6 text-slate-700">
            This platform is currently in patient beta testing.
          </p>
          <p className="mt-3 text-slate-700">
            HairAudit is currently in a limited beta testing phase focused on patient case audits.
          </p>
          <p className="mt-3 text-slate-700">
            Clinic and practitioner access will be introduced in a later release.
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
