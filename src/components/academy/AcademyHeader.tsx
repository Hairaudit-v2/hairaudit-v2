"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const navClass = (href: string) => {
    let active = pathname === href || pathname.startsWith(`${href}/`);
    if (href === "/academy/dashboard" && pathname.startsWith("/academy/admin")) {
      active = false;
    }
    return active
      ? "font-semibold text-amber-300 bg-amber-400/10 ring-1 ring-amber-400/30 px-2.5 py-1 rounded-md"
      : "font-medium text-slate-300 hover:text-amber-300";
  };

  return (
    <header className="border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-900">
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

          <nav className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
            <Link href="/academy/dashboard" className={navClass("/academy/dashboard")}>
              Dashboard
            </Link>
            <Link href="/academy/training-modules" className={navClass("/academy/training-modules")}>
              Training library
            </Link>
            {isStaff ? (
              <>
                <Link href="/academy/trainees" className={navClass("/academy/trainees")}>
                  Trainees
                </Link>
                {isAcademyAdmin ? (
                  <>
                    <Link href="/academy/admin" className={navClass("/academy/admin")}>
                      Admin
                    </Link>
                    <Link href="/academy/sites" className={navClass("/academy/sites")}>
                      Sites
                    </Link>
                    <Link href="/academy/ops/onboarding" className={navClass("/academy/ops/onboarding")}>
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
