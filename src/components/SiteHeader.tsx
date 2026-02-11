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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 sm:h-20">
        <Link href={logoHref} className="flex items-center gap-3 group">
          {showLogo && (
            <Image
              src="/hair-audit-logo-white.svg"
              alt="Hair Audit"
              width={200}
              height={60}
              className="h-12 sm:h-14 w-auto object-contain"
              priority
            />
          )}
        </Link>

        {variant === "default" ? (
          <nav className="flex items-center gap-1 sm:gap-4">
            <Link
              href="/"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              Home
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
              href="/how-it-works"
              className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors hidden sm:block"
            >
              How It Works
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
              Create account
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
              href="/signup"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
            >
              Create account
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
