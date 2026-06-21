"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import TrackedLink from "@/components/analytics/TrackedLink";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { FI_HOME } from "@/config/platform-links";
import { PATHWAY_CHOOSER_HREF } from "@/lib/patient/patientReviewPathway";
import { PUBLIC_CTAS, PUBLIC_ECOSYSTEM_FOOTER } from "@/lib/marketing/publicMarketingCopy";
import { cn } from "@/lib/utils";

export type HairAuditPublicHeaderProps = {
  variant?: "default" | "minimal" | "light";
  showLogo?: boolean;
};

const PATIENT_NAV = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/demo-report", label: "Sample Report" },
  { href: "/hair-transplant-problems", label: "Patient Guides" },
  { href: "/faq", label: "FAQ" },
] as const;

const PROFESSIONAL_NAV = [
  { href: "/clinics", label: "Clinic Directory" },
  { href: "/for-clinics", label: "For Clinics" },
  { href: "/professionals", label: "For Professionals" },
] as const;

type MobileSiteMenuProps = {
  isLight: boolean;
};

function MobileSiteMenu({ isLight }: MobileSiteMenuProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const mobilePanelClass = isLight
    ? "border-slate-200 bg-white text-slate-900"
    : "border-white/10 bg-slate-950 text-white";

  useEffect(() => {
    if (!mobileMenuOpen) {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const firstFocusable = mobileDialogRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex items-center justify-center rounded-full border p-2 transition lg:hidden",
          isLight
            ? "border-slate-300 text-slate-700 hover:bg-slate-50"
            : "border-white/15 text-white hover:bg-white/10"
        )}
        aria-expanded={mobileMenuOpen}
        aria-controls="mobile-site-menu"
        aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setMobileMenuOpen((prev) => !prev)}
      >
        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70"
            aria-label="Close navigation overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            id="mobile-site-menu"
            ref={mobileDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            tabIndex={-1}
            className={cn("absolute right-0 top-0 h-full w-full max-w-sm border-l p-5 shadow-2xl", mobilePanelClass)}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">HairAudit</p>
              <button
                type="button"
                className="rounded-full border border-current/20 p-2"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 space-y-2">
              {PATIENT_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block break-words rounded-xl border border-current/10 px-4 py-3 text-base font-medium leading-snug"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-6 border-t border-current/10 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Professional pathways
              </p>
              <div className="mt-3 space-y-2">
                {PROFESSIONAL_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block break-words rounded-xl px-4 py-2.5 text-sm leading-snug text-current/75 hover:bg-current/5"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-6 space-y-3 border-t border-current/10 pt-5">
              <div className="sm:hidden">
                <LanguageSwitcher variant={isLight ? "light" : "default"} />
              </div>
              <TrackedLink
                href={PATHWAY_CHOOSER_HREF}
                eventName="cta_start_free_audit_mobile_menu"
                className="block w-full rounded-xl bg-amber-400 px-4 py-3 text-center text-sm font-semibold text-slate-950"
                data-testid="choose-review-pathway-mobile-menu"
              >
                {PUBLIC_CTAS.startReview}
              </TrackedLink>
              <Link
                href="/demo-report"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-xl border border-current/15 px-4 py-3 text-center text-sm font-semibold"
              >
                {PUBLIC_CTAS.viewSampleReport}
              </Link>
              <a
                href={FI_HOME}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs font-medium uppercase tracking-[0.16em] text-slate-400"
              >
                {PUBLIC_ECOSYSTEM_FOOTER}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function HairAuditPublicHeader({
  variant = "default",
  showLogo = true,
}: HairAuditPublicHeaderProps) {
  const pathname = usePathname();

  const isLight = variant === "light";
  const isMinimal = variant === "minimal";
  const logoSrc = isLight ? "/hairaudit-logo.svg" : "/hair-audit-logo-white.png";
  const shellClass = isLight
    ? "border-b border-slate-200 bg-white/95 text-slate-900 shadow-sm backdrop-blur"
    : "border-b border-white/10 bg-slate-950/92 text-white shadow-[0_10px_40px_rgba(2,6,23,0.25)] backdrop-blur-md";
  const navLinkClass = isLight
    ? "text-slate-600 hover:text-slate-950"
    : "text-slate-300 hover:text-white";
  const mutedClass = isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-white";

  return (
    <header className={cn("sticky top-0 z-40", shellClass)}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="HairAudit home">
            {showLogo ? (
              <Image
                src={logoSrc}
                alt="HairAudit"
                width={220}
                height={64}
                className="h-12 w-auto object-contain sm:h-14"
                priority
                sizes="(max-width: 640px) 170px, 220px"
              />
            ) : null}
          </Link>
          {!isMinimal ? (
            <a
              href={FI_HOME}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "hidden max-w-[220px] border-l pl-4 text-[10px] font-semibold uppercase leading-snug tracking-[0.22em] lg:block",
                isLight ? "border-slate-200 text-slate-500" : "border-white/10 text-slate-400"
              )}
            >
              {PUBLIC_ECOSYSTEM_FOOTER}
            </a>
          ) : null}
        </div>

        {!isMinimal ? (
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Patient navigation">
            {PATIENT_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn("rounded-full px-3 py-2 text-sm font-medium transition", navLinkClass)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/for-clinics"
              className={cn("rounded-full px-3 py-2 text-sm font-medium transition", mutedClass)}
            >
              Clinics & Professionals
            </Link>
          </nav>
        ) : null}

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-3">
          <div className="hidden sm:block">
            <LanguageSwitcher variant={isLight ? "light" : "default"} />
          </div>
          <Link
            href="/login"
            className={cn("hidden rounded-full px-3 py-2 text-sm font-medium transition sm:inline-flex", mutedClass)}
          >
            Sign in
          </Link>
          <TrackedLink
            href={PATHWAY_CHOOSER_HREF}
            eventName="cta_start_free_audit_header"
            className="inline-flex items-center justify-center rounded-full bg-amber-400 px-3 py-2 text-center text-xs font-semibold leading-tight text-slate-950 shadow-lg shadow-amber-500/15 transition hover:bg-amber-300 sm:px-4 sm:py-2.5 sm:text-sm"
            data-testid="choose-review-pathway-header"
          >
            {PUBLIC_CTAS.startReview}
          </TrackedLink>
          {!isMinimal ? <MobileSiteMenu key={pathname} isLight={isLight} /> : null}
        </div>
      </div>
    </header>
  );
}
