import Link from "next/link";
import Image from "next/image";
import { B12_SITE_URL } from "@/lib/constants";

type SiteHeaderProps = {
  variant?: "default" | "minimal";
  showLogo?: boolean;
};

export default function SiteHeader({ variant = "default", showLogo = true }: SiteHeaderProps) {
  // On auth pages (minimal), logo links back to main HairAudit B12 site
  const logoHref = variant === "minimal" ? B12_SITE_URL : "/";

  return (
    <header className="border-b border-slate-800 bg-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 sm:h-16">
        <Link href={logoHref} className="flex items-center gap-3 group">
          {showLogo && (
            <Image
              src="/hair-audit-logo-white.svg"
              alt="Hair Audit"
              width={160}
              height={48}
              className="h-9 sm:h-10 w-auto object-contain"
              priority
            />
          )}
        </Link>

        {variant === "default" && (
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
