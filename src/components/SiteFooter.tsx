import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-400">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h4 className="font-semibold text-white mb-3">HairAudit</h4>
            <p className="text-sm">
              Independent, evidence-based forensic audits of hair transplant procedures.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3">Quick links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-amber-400 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-amber-400 transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/request-review" className="hover:text-amber-400 transition-colors">
                  Request Review
                </Link>
              </li>
              <li>
                <Link href="/sample-report" className="hover:text-amber-400 transition-colors">
                  Example Report
                </Link>
              </li>
              <li>
                <Link href="/audit-examples" className="hover:text-amber-400 transition-colors">
                  Audit Examples
                </Link>
              </li>
              <li>
                <Link href="/hair-transplant-problems" className="hover:text-amber-400 transition-colors">
                  Hair Transplant Problems
                </Link>
              </li>
              <li>
                <Link href="/rate-my-hair-transplant" className="hover:text-amber-400 transition-colors">
                  Rate My Hair Transplant
                </Link>
              </li>
              <li>
                <Link href="/community-results" className="hover:text-amber-400 transition-colors">
                  Community Results
                </Link>
              </li>
              <li>
                <Link href="/clinics" className="hover:text-amber-400 transition-colors">
                  Clinics
                </Link>
              </li>
              <li>
                <Link href="/professionals" className="hover:text-amber-400 transition-colors">
                  For Professionals
                </Link>
              </li>
              <li>
                <Link href="/benchmark-vision" className="hover:text-amber-400 transition-colors">
                  Benchmark Vision
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-amber-400 transition-colors">
                  Services
                </Link>
              </li>
              <li>
                <Link href="/methodology" className="hover:text-amber-400 transition-colors">
                  How We Review Your Surgery
                </Link>
              </li>
              <li>
                <Link href="/request-review" className="hover:text-amber-400 transition-colors">
                  Request a Hair Transplant Review
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="hover:text-amber-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-amber-400 transition-colors">
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="hover:text-amber-400 transition-colors">
                  Disclaimer
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3">Contact</h4>
            <p className="text-sm font-medium text-slate-300">HairAudit Global Operations</p>
            <p className="text-sm">Brisbane, Queensland</p>
            <p className="text-sm">Australia</p>
            <a
              href="mailto:auditor@hairaudit.com"
              className="text-sm hover:text-amber-400 transition-colors block mt-2"
            >
              auditor@hairaudit.com
            </a>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-700 text-center text-sm space-y-1">
          <p>HairAudit — Audit and feedback for hair transplant procedures</p>
          <p className="text-slate-500">
            Analysis assisted by{" "}
            <Link href="/follicle-intelligence" className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
              Follicle Intelligence
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
