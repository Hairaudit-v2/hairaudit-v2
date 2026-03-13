import Link from "next/link";
import Image from "next/image";

type SiteHeaderProps = {
  variant?: "default" | "minimal";
  showLogo?: boolean;
};

export default function SiteHeader({ variant = "default", showLogo = true }: SiteHeaderProps) {
  const logoHref = "/";
  const navLinkClass =
    "flex items-center leading-none text-[13px] xl:text-sm font-medium tracking-[0.01em] text-slate-300 hover:text-amber-300 transition-colors whitespace-nowrap";
  const navLinkEmeraldClass =
    "flex items-center leading-none text-[13px] xl:text-sm font-medium tracking-[0.01em] text-slate-300 hover:text-emerald-300 transition-colors whitespace-nowrap";
  const utilityLinkClass =
    "flex items-center leading-none text-[13px] xl:text-sm font-medium tracking-[0.01em] text-slate-300 hover:text-amber-300 transition-colors";

  return (
    <header className="border-b border-slate-800 bg-slate-900">
      <div className="max-w-7xl mx-auto px-8 lg:px-12 flex items-center justify-between h-20">
        <Link href={logoHref} className="flex items-center group">
          {showLogo && (
            <Image
              src="/hair-audit-logo-white.png"
              alt="Hair Audit"
              width={230}
              height={64}
              className="h-8 sm:h-10 w-auto object-contain"
              priority
            />
          )}
        </Link>

        {variant === "default" ? (
          <nav className="flex items-center" aria-label="Main navigation">
            <div className="hidden lg:flex items-center gap-x-10">
              <Link href="/" className={navLinkClass}>
                Home
              </Link>
              <Link href="/how-it-works" className={navLinkClass}>
                How It Works
              </Link>
              <Link href="/request-review" className={navLinkClass}>
                Request Review
              </Link>
              <Link href="/sample-report" className={navLinkClass}>
                Example Report
              </Link>
              <Link href="/hair-transplant-problems" className={navLinkClass}>
                Problem Guides
              </Link>
              <Link href="/rate-my-hair-transplant" className={navLinkEmeraldClass}>
                Rate My Transplant
              </Link>
              <Link href="/community-results" className={navLinkEmeraldClass}>
                Community Results
              </Link>
              <Link href="/clinics" className={navLinkClass}>
                Clinics
              </Link>
              <Link href="/professionals" className={navLinkClass}>
                For Professionals
              </Link>
            </div>
            <div className="ml-6 lg:ml-8 flex items-center gap-x-4">
              <Link
                href="/login"
                className={utilityLinkClass}
              >
                Sign in
              </Link>
              <Link
                href="/request-review"
                className="flex items-center leading-none text-[13px] xl:text-sm font-semibold tracking-[0.01em] px-4 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
              >
                Request a Hair Transplant Review
              </Link>
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
            <Link
              href="/request-review"
              className="flex items-center leading-none text-[13px] xl:text-sm font-semibold tracking-[0.01em] px-4 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
            >
              Request a Hair Transplant Review
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
