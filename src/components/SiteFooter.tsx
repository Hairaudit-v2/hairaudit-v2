"use client";

import Link from "next/link";
import TrackedLink from "@/components/analytics/TrackedLink";
import { FI_HOME } from "@/config/platform-links";
import CrossPlatformLink from "@/components/platform/CrossPlatformLink";
import SurgicalEcosystemFooterBand from "@/components/SurgicalEcosystemFooterBand";
import { PLATFORM_ECOSYSTEM } from "@/lib/constants/platform";
import { useI18n } from "@/components/i18n/I18nProvider";

type SiteFooterProps = {
  theme?: "default" | "light";
};

export default function SiteFooter({ theme = "default" }: SiteFooterProps) {
  const { t } = useI18n();
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
            <h4 className={headingClass}>{t("nav.footer.brandName")}</h4>
            <p className="text-sm leading-relaxed">{t("nav.footer.brandBlurb")}</p>
          </div>
          <div>
            <h4 className={headingClass}>{t("nav.footer.sectionPatients")}</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/how-it-works" className={linkClass}>
                  {t("nav.howItWorks")}
                </Link>
              </li>
              <li>
                <TrackedLink
                  href="/request-review"
                  eventName="cta_request_review_footer"
                  className={linkClass}
                >
                  {t("nav.requestReview")}
                </TrackedLink>
              </li>
              <li>
                <Link href="/demo-report" className={linkClass}>
                  {t("nav.sampleReport")}
                </Link>
              </li>
              <li>
                <Link href="/faq" className={linkClass}>
                  {t("nav.footer.linkFaq")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className={headingClass}>{t("nav.footer.sectionProfessionals")}</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/professionals" className={linkClass}>
                  {t("nav.forProfessionals")}
                </Link>
              </li>
              <li>
                <Link href="/verified-surgeon-program" className={linkClass}>
                  {t("nav.footer.linkVerifiedProgram")}
                </Link>
              </li>
              <li>
                <Link href="/signup" className={linkClass}>
                  {t("nav.footer.linkCreateProfile")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className={headingClass}>{t("nav.footer.sectionCompany")}</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/about" className={linkClass}>
                  {t("nav.footer.linkAbout")}
                </Link>
              </li>
              <li>
                <a href="mailto:auditor@hairaudit.com" className={linkClass}>
                  {t("nav.footer.linkContact")}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className={headingClass}>{t("nav.footer.sectionLegal")}</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/privacy" className={linkClass}>
                  {t("nav.footer.linkPrivacy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className={linkClass}>
                  {t("nav.footer.linkTerms")}
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className={linkClass}>
                  {t("nav.footer.linkDisclaimer")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className={headingClass}>{t("nav.footer.sectionPlatformEcosystem")}</h4>
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
                    <span className={platformSubClass}>
                      {platform.key === "follicleIntelligence"
                        ? t("nav.footer.platformFiSubtitle")
                        : t("nav.footer.platformHaSubtitle")}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <CrossPlatformLink mode="hairAudit" theme={theme} className="mt-8" />
        <div
          className={`mt-10 pt-8 border-t ${borderClass} text-center text-sm space-y-1 leading-snug`}
        >
          <p>{t("nav.footer.tagline")}</p>
          <p className="text-slate-500">
            {t("nav.footer.assistedByPrefix")}{" "}
            <a href={FI_HOME} target="_blank" rel="noopener noreferrer" className={fiLinkClass}>
              {t("nav.footer.follicleIntelligenceName")}
            </a>
          </p>
        </div>
      </div>
      <SurgicalEcosystemFooterBand theme={theme} />
    </footer>
  );
}
