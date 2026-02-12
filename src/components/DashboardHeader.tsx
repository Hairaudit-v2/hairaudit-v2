import Link from "next/link";
import Image from "next/image";
import SignOutButton from "./SignOutButton";

export default function DashboardHeader() {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <header className="border-b border-slate-800 bg-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/hair-audit-logo-white.svg"
              alt="Hair Audit"
              width={160}
              height={48}
              className="h-9 sm:h-10 w-auto object-contain"
              priority
            />
          </Link>

          <div className="flex items-center gap-4">
            {isDev && (
              <Link
                href="/dev"
                className="text-xs font-medium text-amber-400 hover:text-amber-300"
              >
                Dev: Switch role
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
