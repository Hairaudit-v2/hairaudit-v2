import Link from "next/link";
import Image from "next/image";

type SiteHeaderProps = {
  variant?: "default" | "minimal";
  showLogo?: boolean;
};

export default function SiteHeader({ variant = "default", showLogo = true }: SiteHeaderProps) {
  const logoHref = "/";

  return (
    <header className="border-b border-slate-800 bg-slate-900">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 flex items-center justify-between h-[72px] sm:h-[84px]">
        <Link href={logoHref} className="flex items-center group">
          {showLogo && (
            <Image
              src="/hair-audit-logo-white.png"
              alt="Hair Audit"
              width={230}
              height={64}
              className="h-10 sm:h-12 lg:h-14 w-auto object-contain"
              priority
            />
          )}
        </Link>

        {variant === "default" ? (
          <nav className="flex items-center gap-1 sm:gap-4" aria-label="Main navigation">
            <Link
              href="/"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              Home
            </Link>
            <Link
              href="/how-it-works"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              How It Works
            </Link>
            <Link
              href="/request-review"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              Request Review
            </Link>
            <Link
              href="/sample-report"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              Example Report
            </Link>
            <Link
              href="/hair-transplant-problems"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              Problem Guides
            </Link>
            <Link
              href="/rate-my-hair-transplant"
              className="text-sm font-medium text-slate-300 hover:text-emerald-400 transition-colors hidden sm:block"
            >
              Rate My Transplant
            </Link>
            <Link
              href="/clinics"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              Clinics
            </Link>
            <Link
              href="/professionals"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              For Professionals
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors px-2"
            >
              Sign in
            </Link>
            <Link
              href="/request-review"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
            >
              Request a Hair Transplant Review
            </Link>
          </nav>
        ) : (
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/request-review"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
            >
              Request a Hair Transplant Review
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
