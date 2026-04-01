import Link from "next/link";
import Image from "next/image";
import SignOutButton from "@/components/SignOutButton";

export default function AcademyHeader({
  isStaff,
  role,
  isAcademyAdmin,
}: {
  isStaff: boolean;
  role: string;
  isAcademyAdmin?: boolean;
}) {
  return (
    <header className="border-b border-slate-800 bg-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 h-14 sm:h-16">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/academy/dashboard" className="flex items-center gap-2 shrink-0">
              <Image
                src="/hair-audit-logo-white.png"
                alt="HairAudit"
                width={180}
                height={40}
                className="h-8 sm:h-9 w-auto object-contain"
                sizes="160px"
              />
            </Link>
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-400/90 hidden sm:inline">
              IIOHR Academy
            </span>
          </div>

          <nav className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
            <Link href="/academy/dashboard" className="font-medium text-slate-300 hover:text-amber-400">
              Dashboard
            </Link>
            <Link href="/academy/training-modules" className="font-medium text-slate-300 hover:text-amber-400">
              Training library
            </Link>
            {isStaff ? (
              <>
                <Link href="/academy/trainees" className="font-medium text-slate-300 hover:text-amber-400">
                  Trainees
                </Link>
                {isAcademyAdmin ? (
                  <>
                    <Link href="/academy/sites" className="font-medium text-slate-300 hover:text-amber-400">
                      Sites
                    </Link>
                    <Link href="/academy/ops/onboarding" className="font-medium text-slate-300 hover:text-amber-400">
                      Academy roster
                    </Link>
                  </>
                ) : null}
              </>
            ) : null}
            <span className="text-xs text-slate-500 capitalize hidden md:inline">{role.replace("_", " ")}</span>
            <SignOutButton />
          </nav>
        </div>
      </div>
    </header>
  );
}
