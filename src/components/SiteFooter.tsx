import Link from "next/link";
import TrackedLink from "@/components/analytics/TrackedLink";

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-700 bg-slate-900 text-slate-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-1">
            <h4 className="font-semibold text-white mb-3">HairAudit</h4>
            <p className="text-sm leading-relaxed">
              Independent, evidence-based forensic audits of hair transplant procedures.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3">Patients</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/how-it-works" className="inline-flex py-2.5 hover:text-amber-400 transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <TrackedLink
                  href="/request-review"
                  eventName="cta_request_review_footer"
                  className="inline-flex py-2.5 hover:text-amber-400 transition-colors"
                >
                  Request Review
                </TrackedLink>
              </li>
              <li>
                <Link href="/sample-report" className="inline-flex py-2.5 hover:text-amber-400 transition-colors">
                  Example Report
                </Link>
              </li>
              <li>
                <Link href="/faq" className="inline-flex py-2.5 hover:text-amber-400 transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3">Professionals</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/professionals" className="inline-flex py-2.5 hover:text-amber-400 transition-colors">
                  For Professionals
                </Link>
              </li>
              <li>
                <Link href="/verified-surgeon-program" className="inline-flex py-2.5 hover:text-amber-400 transition-colors">
                  Verified Surgeon Program
                </Link>
              </li>
              <li>
                <Link href="/professionals/apply" className="inline-flex py-2.5 hover:text-amber-400 transition-colors">
                  Apply for Participation
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3">Company</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/about" className="inline-flex py-2.5 hover:text-amber-400 transition-colors">
                  About
                </Link>
              </li>
              <li>
                <a href="mailto:auditor@hairaudit.com" className="inline-flex py-2.5 hover:text-amber-400 transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3">Legal</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/privacy" className="inline-flex py-2.5 hover:text-amber-400 transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="inline-flex py-2.5 hover:text-amber-400 transition-colors">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="inline-flex py-2.5 hover:text-amber-400 transition-colors">
                  Disclaimer
                </Link>
              </li>
            </ul>
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
