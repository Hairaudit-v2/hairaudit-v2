"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import TrackedLink from "@/components/analytics/TrackedLink";
import { FI_HOME, HA_HOME } from "@/config/platform-links";
import { useI18n } from "@/components/i18n/I18nProvider";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";

type SiteHeaderProps = {
  variant?: "default" | "minimal" | "light";
  showLogo?: boolean;
};

type EcosystemNavItem = {
  href: string;
  labelKey: "nav.ecosystem.poweredByFi" | "nav.ecosystem.exploreHa";
};

export default function SiteHeader({ variant = "default", showLogo = true }: SiteHeaderProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const logoHref = "/";
  const navItems = [
    { href: "/", label: t("nav.home") },
    { href: "/how-it-works", label: t("nav.howItWorks") },
    { href: "/hair-transplant-problems", label: t("nav.patientGuides") },
    { href: "/request-review", label: t("nav.requestReview") },
    { href: "/demo-report", label: t("nav.sampleReport") },
    { href: "/clinics", label: t("nav.clinics") },
    { href: "/for-clinics", label: t("nav.forClinics") },
    { href: "/professionals", label: t("nav.forProfessionals") },
  ];
  const [ecosystemNavItem, setEcosystemNavItem] = useState<EcosystemNavItem>({
    href: FI_HOME,
    labelKey: "nav.ecosystem.poweredByFi",
  });
  const isLight = variant === "light";
  const navLinkClass =
    "flex items-center justify-center text-center leading-snug text-[13px] xl:text-sm font-medium tracking-[0.01em] whitespace-normal transition-colors " +
    (isLight ? "text-slate-600 hover:text-amber-700" : "text-slate-300 hover:text-amber-300");
  const utilityLinkClass =
    "flex items-center leading-none text-[13px] xl:text-sm font-medium tracking-[0.01em] transition-colors " +
    (isLight ? "text-slate-600 hover:text-amber-700" : "text-slate-300 hover:text-amber-300");

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    const isFollicleDomain = hostname.includes("follicleintelligence");

    setEcosystemNavItem(
      isFollicleDomain
        ? { href: HA_HOME, labelKey: "nav.ecosystem.exploreHa" }
        : { href: FI_HOME, labelKey: "nav.ecosystem.poweredByFi" }
    );
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      document.body.style.overflow = "";
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const dialog = mobileDialogRef.current;
    if (dialog) {
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialog.focus();
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }

      if (event.key !== "Tab" || !mobileDialogRef.current) {
        return;
      }

      const focusable = mobileDialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <header
        className={
          isLight
            ? "border-b border-slate-200 bg-white"
            : "border-b border-slate-800 bg-slate-900"
        }
      >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-between h-24">
        <Link href={logoHref} className="flex items-center gap-2 group">
          {showLogo && (
            <>
              {isLight ? (
                <Image
                  src="/hairaudit-logo.svg"
                  alt="HairAudit"
                  width={280}
                  height={80}
                  className="h-16 sm:h-20 w-auto object-contain"
                  priority
                  sizes="(max-width: 640px) 200px, 280px"
                />
              ) : (
                <Image
                  src="/hair-audit-logo-white.png"
                  alt="HairAudit"
                  width={288}
                  height={80}
                  className="h-16 sm:h-20 w-auto object-contain"
                  priority
                  sizes="(max-width: 640px) 200px, 280px"
                />
              )}
            </>
          )}
        </Link>

        {variant === "default" || variant === "light" ? (
          <nav className="flex items-center" aria-label={t("nav.mainNav")}>
            <div className="hidden lg:flex items-center gap-x-5 xl:gap-x-6">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className={navLinkClass}>
                  {item.label}
                </Link>
              ))}
              <a href={ecosystemNavItem.href} target="_blank" rel="noopener noreferrer" className={navLinkClass}>
                {t(ecosystemNavItem.labelKey)}
              </a>
            </div>
            <div className="hidden lg:flex ml-6 lg:ml-8 items-center gap-x-4">
              <LanguageSwitcher variant={isLight ? "light" : "default"} />
              <Link
                href="/login"
                className={utilityLinkClass}
              >
                {t("nav.signIn")}
              </Link>
              <TrackedLink
                href="/request-review"
                eventName="cta_request_review_header"
                className="flex items-center justify-center text-center leading-snug text-[13px] xl:text-sm font-semibold tracking-[0.01em] px-4 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-600 transition-colors border border-amber-600/20"
              >
                {t("nav.requestReview")}
              </TrackedLink>
            </div>
            <div className="ml-4 lg:hidden flex items-center gap-2">
              <LanguageSwitcher variant={isLight ? "light" : "default"} />
              <TrackedLink
                href="/request-review"
                eventName="cta_request_review_header"
                className="inline-flex items-center justify-center text-center leading-snug rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-600 transition-colors"
              >
                {t("nav.requestReview")}
              </TrackedLink>
              <button
                type="button"
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${isLight ? "border-slate-300 text-slate-700 hover:bg-slate-50" : "border-slate-700 text-slate-200 hover:bg-slate-800"}`}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-site-menu"
                aria-label={mobileMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
                onClick={() => setMobileMenuOpen((prev) => !prev)}
              >
                <span>{mobileMenuOpen ? t("nav.close") : t("nav.menu")}</span>
                <span className="relative block h-3.5 w-4" aria-hidden>
                  <span className={`absolute left-0 block h-0.5 w-4 bg-current transition-transform ${mobileMenuOpen ? "top-1.5 rotate-45" : "top-0"}`} />
                  <span className={`absolute left-0 top-1.5 block h-0.5 w-4 bg-current transition-opacity ${mobileMenuOpen ? "opacity-0" : "opacity-100"}`} />
                  <span className={`absolute left-0 block h-0.5 w-4 bg-current transition-transform ${mobileMenuOpen ? "top-1.5 -rotate-45" : "top-3"}`} />
                </span>
              </button>
            </div>
          </nav>
        ) : (
          <nav className="flex items-center gap-x-4">
            <LanguageSwitcher variant={isLight ? "light" : "default"} />
            <Link
              href="/login"
              className={utilityLinkClass}
            >
              {t("nav.signIn")}
            </Link>
            <TrackedLink
              href="/request-review"
              eventName="cta_request_review_header"
              className="flex items-center justify-center text-center leading-snug text-[13px] xl:text-sm font-semibold tracking-[0.01em] px-4 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
            >
              {t("nav.requestReview")}
            </TrackedLink>
          </nav>
        )}
      </div>
      {(variant === "default" || variant === "light") && mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            className={`absolute inset-0 ${isLight ? "bg-slate-900/20" : "bg-slate-950/75"}`}
            aria-label={t("nav.closeMenuOverlay")}
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            id="mobile-site-menu"
            ref={mobileDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.mobileNavDialog")}
            tabIndex={-1}
            className={`absolute right-0 top-0 h-full w-full max-w-xs border-l p-5 ${isLight ? "border-slate-200 bg-white" : "border-slate-700 bg-slate-900 shadow-2xl"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm font-semibold tracking-wide ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                {t("nav.navigation")}
              </p>
              <div className="flex items-center gap-2">
                <LanguageSwitcher variant={isLight ? "light" : "default"} />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-md border px-2.5 py-1.5 text-sm ${isLight ? "border-slate-300 text-slate-700 hover:bg-slate-50" : "border-slate-700 text-slate-200 hover:bg-slate-800"}`}
                >
                  {t("nav.close")}
                </button>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg border px-3 py-2.5 text-sm font-medium ${isLight ? "border-slate-200 text-slate-700 hover:bg-slate-50" : "border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-800"}`}
                >
                  {item.label}
                </Link>
              ))}
              <a
                href={ecosystemNavItem.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`block rounded-lg border px-3 py-2.5 text-sm font-medium ${isLight ? "border-slate-200 text-slate-700 hover:bg-slate-50" : "border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-800"}`}
              >
                {t(ecosystemNavItem.labelKey)}
              </a>
            </div>
            <div className={`mt-6 space-y-3 border-t pt-5 ${isLight ? "border-slate-200" : "border-slate-800"}`}>
              <Link
                href="/login"
                className={`block rounded-lg border px-3 py-2.5 text-center text-sm font-medium ${isLight ? "border-slate-300 text-slate-700 hover:bg-slate-50" : "border-slate-700 text-slate-200 hover:bg-slate-800"}`}
              >
                {t("nav.signInMobile")}
              </Link>
              <TrackedLink
                href="/request-review"
                eventName="cta_request_review_header"
                className="block rounded-lg bg-amber-500 px-3 py-2.5 text-center text-sm font-semibold text-slate-900 hover:bg-amber-600"
              >
                {t("nav.requestReview")}
              </TrackedLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
