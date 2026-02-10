import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import { B12_SITE_URL } from "@/lib/constants";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mx-auto mb-8 flex justify-center rounded-2xl bg-slate-900 px-6 py-4">
            <Image
              src="/hair-audit-logo-white.svg"
              alt="Hair Audit"
              width={200}
              height={80}
              className="h-16 sm:h-20 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight sr-only">
            HairAudit
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Professional audit and feedback for hair transplant procedures. 
            Patients, doctors, and clinics collaborate to evaluate results and improve outcomes.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors shadow-sm"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-semibold hover:border-amber-400 hover:bg-amber-50/50 transition-colors"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm mb-3">
                1
              </div>
              <h3 className="font-semibold text-slate-900">Patients</h3>
              <p className="mt-1 text-sm text-slate-600">
                Upload photos and answer questions about your procedure. Get AI-powered feedback on your results.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm mb-3">
                2
              </div>
              <h3 className="font-semibold text-slate-900">Doctors & Clinics</h3>
              <p className="mt-1 text-sm text-slate-600">
                Submit cases with procedure details and images. Review audit feedback and improve your practice.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm mb-3">
                3
              </div>
              <h3 className="font-semibold text-slate-900">Audit Report</h3>
              <p className="mt-1 text-sm text-slate-600">
                Receive a comprehensive report with scores, donor quality assessment, and actionable findings.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 bg-slate-900 py-6 text-center text-sm text-slate-400">
        <a href={B12_SITE_URL} className="hover:text-amber-400 transition-colors">
          HairAudit
        </a>
        {" — Audit and feedback for hair transplant procedures"}
      </footer>
    </div>
  );
}
