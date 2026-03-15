"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import TrackedLink from "@/components/analytics/TrackedLink";
import HairEcosystemNav from "@/components/HairEcosystemNav";
import { FI_HOME, HA_HOME } from "@/config/platform-links";

type SiteHeaderProps = {
  variant?: "default" | "minimal";
  showLogo?: boolean;
};

type EcosystemNavItem = {
  href: string;
  label: string;
};

export default function SiteHeader({ variant = "default", showLogo = true }: SiteHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const logoHref = "/";
  const navItems = [
    { href: "/", label: "Home" },
    { href: "/how-it-works", label: "How It Works" },
    { href: "/request-review", label: "Request Review" },
    { href: "/sample-report", label: "Example Report" },
    { href: "/clinics", label: "Clinics" },
    { href: "/professionals", label: "For Professionals" },
  ];
  const [ecosystemNavItem, setEcosystemNavItem] = useState<EcosystemNavItem>({
    href: FI_HOME,
    label: "Powered by Follicle Intelligence",
  });
  const navLinkClass =
    "flex items-center leading-none text-[13px] xl:text-sm font-medium tracking-[0.01em] text-slate-300 hover:text-amber-300 transition-colors whitespace-nowrap";
  const utilityLinkClass =
    "flex items-center leading-none text-[13px] xl:text-sm font-medium tracking-[0.01em] text-slate-300 hover:text-amber-300 transition-colors";

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    const isFollicleDomain = hostname.includes("follicleintelligence");

    setEcosystemNavItem(
      isFollicleDomain
        ? { href: HA_HOME, label: "Explore HairAudit" }
        : { href: FI_HOME, label: "Powered by Follicle Intelligence" }
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
    <>
      <HairEcosystemNav currentSite="hairaudit" />
      <header className="border-b border-slate-800 bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-between h-20">
        <Link href={logoHref} className="flex items-center gap-2 group">
          {showLogo && (
            <>
              <Image
                src="/hair-audit-logo-white.png"
                alt="Hair Audit"
                width={230}
                height={64}
                className="h-8 sm:h-10 w-auto object-contain"
                priority
              />
              <span
                className="rounded px-1.5 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40"
                aria-label="Beta"
              >
                Beta
              </span>
            </>
          )}
        </Link>

        {variant === "default" ? (
          <nav className="flex items-center" aria-label="Main navigation">
            <div className="hidden lg:flex items-center gap-x-8">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className={navLinkClass}>
                  {item.label}
                </Link>
              ))}
              <a href={ecosystemNavItem.href} target="_blank" rel="noopener noreferrer" className={navLinkClass}>
                {ecosystemNavItem.label}
              </a>
            </div>
            <div className="hidden lg:flex ml-6 lg:ml-8 items-center gap-x-4">
              <Link
                href="/login"
                className={utilityLinkClass}
              >
                Sign in
              </Link>
              <TrackedLink
                href="/request-review"
                eventName="cta_request_review_header"
                className="flex items-center leading-none text-[13px] xl:text-sm font-semibold tracking-[0.01em] px-4 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
              >
                Request Review
              </TrackedLink>
            </div>
            <div className="ml-4 lg:hidden flex items-center gap-2">
              <TrackedLink
                href="/request-review"
                eventName="cta_request_review_header"
                className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400 transition-colors"
              >
                Request Review
              </TrackedLink>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-site-menu"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                onClick={() => setMobileMenuOpen((prev) => !prev)}
              >
                <span>{mobileMenuOpen ? "Close" : "Menu"}</span>
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
            <Link
              href="/login"
              className={utilityLinkClass}
            >
              Sign in
            </Link>
            <TrackedLink
              href="/request-review"
              eventName="cta_request_review_header"
              className="flex items-center leading-none text-[13px] xl:text-sm font-semibold tracking-[0.01em] px-4 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
            >
              Request Review
            </TrackedLink>
          </nav>
        )}
      </div>
      {variant === "default" && mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/75"
            aria-label="Close menu overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            id="mobile-site-menu"
            ref={mobileDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile site navigation"
            tabIndex={-1}
            className="absolute right-0 top-0 h-full w-full max-w-xs border-l border-slate-700 bg-slate-900 p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold tracking-wide text-slate-300">Navigation</p>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md border border-slate-700 px-2.5 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="mt-5 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg border border-slate-800 px-3 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-700 hover:bg-slate-800"
                >
                  {item.label}
                </Link>
              ))}
              <a
                href={ecosystemNavItem.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-slate-800 px-3 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-700 hover:bg-slate-800"
              >
                {ecosystemNavItem.label}
              </a>
            </div>
            <div className="mt-6 space-y-3 border-t border-slate-800 pt-5">
              <Link
                href="/login"
                className="block rounded-lg border border-slate-700 px-3 py-2.5 text-center text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Sign In
              </Link>
              <TrackedLink
                href="/request-review"
                eventName="cta_request_review_header"
                className="block rounded-lg bg-amber-500 px-3 py-2.5 text-center text-sm font-semibold text-slate-900 hover:bg-amber-400"
              >
                Request Review
              </TrackedLink>
            </div>
          </div>
        </div>
      )}
    </header>
    </>
  );
}
