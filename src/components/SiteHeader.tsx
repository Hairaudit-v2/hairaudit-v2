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
      <div className="max-w-6xl mx-auto px-5 sm:px-8 flex items-center h-[72px] sm:h-[84px] relative">
        {showLogo && (
          <>
            <Link href={logoHref} className="flex items-center group xl:hidden">
              <Image
                src="/hair-audit-logo-white.png"
                alt="Hair Audit"
                width={230}
                height={64}
                className="h-10 sm:h-12 lg:h-14 w-auto object-contain"
                priority
              />
            </Link>
            <Link
              href={logoHref}
              className="hidden xl:flex items-center group absolute left-1/2 -translate-x-1/2"
            >
              <Image
                src="/hair-audit-logo-white.png"
                alt="Hair Audit"
                width={230}
                height={64}
                className="h-10 sm:h-12 lg:h-14 w-auto object-contain"
                priority
              />
            </Link>
          </>
        )}

        {variant === "default" ? (
          <nav className="ml-auto flex items-center gap-1 sm:gap-4" aria-label="Main navigation">
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
              href="/methodology"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              Methodology
            </Link>
            <Link
              href="/clinics"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              Clinics
            </Link>
            <Link
              href="/verified-surgeon-program"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              Verified Program
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              About
            </Link>
            <Link
              href="/services"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              Services
            </Link>
            <Link
              href="/follicle-intelligence"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              Follicle Intelligence
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              Request an Audit
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors px-2"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
            >
              Request an Audit
            </Link>
          </nav>
        ) : (
          <nav className="ml-auto flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
            >
              Request an Audit
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
