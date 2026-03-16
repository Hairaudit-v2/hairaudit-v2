import Link from "next/link";
import TrackedLink from "@/components/analytics/TrackedLink";
import { FI_HOME } from "@/config/platform-links";
import CrossPlatformLink from "@/components/platform/CrossPlatformLink";
import SurgicalEcosystemFooterBand from "@/components/SurgicalEcosystemFooterBand";
import { PLATFORM_ECOSYSTEM } from "@/lib/constants/platform";

type SiteFooterProps = {
  theme?: "default" | "light";
};

export default function SiteFooter({ theme = "default" }: SiteFooterProps) {
  const isLight = theme === "light";
  const footerClass = isLight
    ? "border-t border-slate-200 bg-white text-slate-600"
    : "border-t border-slate-700 bg-slate-900 text-slate-400";
  const headingClass = isLight ? "font-semibold text-slate-900 mb-3" : "font-semibold text-white mb-3";
  const linkClass = isLight
    ? "inline-flex py-2.5 hover:text-amber-700 transition-colors"
    : "inline-flex py-2.5 hover:text-amber-400 transition-colors";
  const platformLinkClass = isLight
    ? "inline-flex flex-col py-1 hover:text-amber-700 transition-colors"
    : "inline-flex flex-col py-1 hover:text-amber-400 transition-colors";
  const platformNameClass = isLight ? "font-medium text-slate-700" : "font-medium text-slate-200";
  const platformSubClass = isLight ? "text-xs text-slate-500" : "text-xs text-slate-500";
  const borderClass = isLight ? "border-slate-200" : "border-slate-700";
  const fiLinkClass = isLight
    ? "text-amber-700 hover:text-amber-800 transition-colors font-medium"
    : "text-amber-400 hover:text-amber-300 transition-colors font-medium";

  return (
    <footer className={footerClass}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8">
          <div className="lg:col-span-1">
            <h4 className={headingClass}>HairAudit</h4>
            <p className="text-sm leading-relaxed">
              Independent, evidence-based forensic audits of hair transplant procedures.
            </p>
          </div>
          <div>
            <h4 className={headingClass}>Patients</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/how-it-works" className={linkClass}>
                  How It Works
                </Link>
              </li>
              <li>
                <TrackedLink
                  href="/request-review"
                  eventName="cta_request_review_footer"
                  className={linkClass}
                >
                  Request Review
                </TrackedLink>
              </li>
              <li>
                <Link href="/sample-report" className={linkClass}>
                  Example Report
                </Link>
              </li>
              <li>
                <Link href="/faq" className={linkClass}>
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className={headingClass}>Professionals</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/professionals" className={linkClass}>
                  For Professionals
                </Link>
              </li>
              <li>
                <Link href="/verified-surgeon-program" className={linkClass}>
                  Verified Surgeon Program
                </Link>
              </li>
              <li>
                <Link href="/professionals/apply" className={linkClass}>
                  Apply for Participation
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className={headingClass}>Company</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/about" className={linkClass}>
                  About
                </Link>
              </li>
              <li>
                <a href="mailto:auditor@hairaudit.com" className={linkClass}>
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className={headingClass}>Legal</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/privacy" className={linkClass}>
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className={linkClass}>
                Terms
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className={linkClass}>
                  Disclaimer
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className={headingClass}>Platform Ecosystem</h4>
            <ul className="space-y-2 text-sm">
              {PLATFORM_ECOSYSTEM.map((platform) => (
                <li key={platform.key}>
                  <a
                    href={platform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={platformLinkClass}
                  >
                    <span className={platformNameClass}>{platform.name}</span>
                    <span className={platformSubClass}>{platform.subtitle}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <CrossPlatformLink mode="hairAudit" theme={theme} className="mt-8" />
        <div className={`mt-10 pt-8 border-t ${borderClass} text-center text-sm space-y-1`}>
          <p>HairAudit — Audit and feedback for hair transplant procedures</p>
          <p className="text-slate-500">
            Analysis assisted by{" "}
            <a
              href={FI_HOME}
              target="_blank"
              rel="noopener noreferrer"
              className={fiLinkClass}
            >
              Follicle Intelligence
            </a>
          </p>
        </div>
      </div>
      <SurgicalEcosystemFooterBand theme={theme} />
    </footer>
  );
}
