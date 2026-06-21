"use client";

import Link from "next/link";

import TrackedLink from "@/components/analytics/TrackedLink";
import StartFreeAuditButton from "@/components/audit/StartFreeAuditButton";
import { FI_HOME } from "@/config/platform-links";
import { PLATFORM_ECOSYSTEM } from "@/lib/constants/platform";
import { cn } from "@/lib/utils";

export type HairAuditPublicFooterProps = {
  theme?: "default" | "light";
};

const patientLinks = [
  { href: "/how-it-works", label: "How It Works", tracked: false },
  { href: "/request-review", label: "Start Free Audit", tracked: true },
  { href: "/demo-report", label: "View Sample Report", tracked: false },
  { href: "/hair-transplant-problems", label: "Patient Guides", tracked: false },
  { href: "/faq", label: "FAQ", tracked: false },
] as const;

const professionalLinks = [
  { href: "/for-clinics", label: "For Clinics", eventName: "cta_footer_professional_for_clinics" },
  { href: "/professionals", label: "For Professionals", eventName: "cta_footer_professional_hub" },
  { href: "/clinics", label: "Clinic Directory", eventName: "cta_footer_professional_directory" },
  { href: "/verified-surgeon-program", label: "Verified Surgeon Program", eventName: "cta_footer_professional_verified" },
] as const;

const legalLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/disclaimer", label: "Disclaimer" },
] as const;

export default function HairAuditPublicFooter({ theme = "default" }: HairAuditPublicFooterProps) {
  const isLight = theme === "light";
  const footerClass = isLight
    ? "border-t border-slate-200 bg-white text-slate-600"
    : "border-t border-white/10 bg-slate-950 text-slate-400";
  const headingClass = isLight
    ? "text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
    : "text-xs font-semibold uppercase tracking-[0.2em] text-slate-500";
  const linkClass = isLight
    ? "text-sm text-slate-600 transition hover:text-slate-950"
    : "text-sm text-slate-300 transition hover:text-white";

  return (
    <footer className={footerClass}>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_2fr]">
          <div className="space-y-5">
            <div>
              <h2 className={cn("text-lg font-semibold", isLight ? "text-slate-950" : "text-white")}>HairAudit</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed">
                Independent hair transplant audit and patient guidance, powered by the Follicle Intelligence Network
                while remaining a standalone review platform.
              </p>
            </div>
            <div className="flex min-w-0 flex-col flex-wrap gap-3 sm:flex-row">
              <StartFreeAuditButton
                eventName="cta_start_free_audit_footer"
                className="inline-flex min-w-0 max-w-full shrink-0 items-center justify-center break-words rounded-full bg-amber-400 px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-70 disabled:cursor-wait"
              >
                Start Free Audit
              </StartFreeAuditButton>
              <Link
                href="/demo-report"
                className={cn(
                  "inline-flex min-w-0 max-w-full shrink items-center justify-center break-words rounded-full border px-5 py-3 text-center text-sm font-semibold transition",
                  isLight
                    ? "border-slate-300 text-slate-700 hover:bg-slate-50"
                    : "border-white/15 text-slate-100 hover:bg-white/10"
                )}
              >
                View Sample Report
              </Link>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h3 className={headingClass}>Patients</h3>
              <ul className="mt-4 space-y-3">
                {patientLinks.map((link) => (
                  <li key={link.href}>
                    {link.tracked ? (
                      <TrackedLink href={link.href} eventName="cta_start_free_audit_footer_nav" className={linkClass}>
                        {link.label}
                      </TrackedLink>
                    ) : (
                      <Link href={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={headingClass}>Professionals</h3>
              <ul className="mt-4 space-y-3">
                {professionalLinks.map((link) => (
                  <li key={link.href}>
                    <TrackedLink href={link.href} eventName={link.eventName} className={linkClass}>
                      {link.label}
                    </TrackedLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={headingClass}>Company</h3>
              <ul className="mt-4 space-y-3">
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
                {legalLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={headingClass}>Network</h3>
              <ul className="mt-4 space-y-3">
                {PLATFORM_ECOSYSTEM.map((platform) => (
                  <li key={platform.key}>
                    <a href={platform.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {platform.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-12 flex min-w-0 flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
            isLight ? "border-slate-200 text-slate-500" : "border-white/10 text-slate-500"
          )}
        >
          <p className="min-w-0 max-w-prose break-words">
            HairAudit is independent. It does not sell procedures or clinic referrals.
          </p>
          <a
            href={FI_HOME}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 shrink font-semibold uppercase tracking-[0.16em] break-words sm:text-right"
          >
            Powered by the Follicle Intelligence Network
          </a>
        </div>
      </div>
    </footer>
  );
}
