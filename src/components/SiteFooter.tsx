import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-400">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h4 className="font-semibold text-white mb-3">HairAudit</h4>
            <p className="text-sm">
              Independent, evidence-based audits of hair transplant procedures.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3">Quick links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/faq" className="hover:text-amber-400 transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-amber-400 transition-colors">
                  Submit Audit
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-amber-400 transition-colors">
                  How it Works
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-amber-400 transition-colors">
                  Services
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
            <p className="text-sm">1 Main Street</p>
            <p className="text-sm">New York, NY 11111</p>
            <a
              href="mailto:tlbpmg@gmail.com"
              className="text-sm hover:text-amber-400 transition-colors block mt-2"
            >
              tlbpmg@gmail.com
            </a>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-700 text-center text-sm">
          HairAudit — Audit and feedback for hair transplant procedures
        </div>
      </div>
    </footer>
  );
}
