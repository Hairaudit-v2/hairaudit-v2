import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function BetaAccessMessagePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader variant="minimal" />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">Patient Beta Access</h1>
          <p className="mt-6 text-slate-700">
            HairAudit is currently operating in a controlled patient beta phase.
          </p>
          <p className="mt-3 text-slate-700">
            During beta, individuals can submit transplant cases for independent forensic review while the full clinic and doctor participation layers are being finalised.
          </p>
          <p className="mt-3 text-slate-700">
            Clinic and doctor access will open in later stages of the transparency platform rollout.
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
