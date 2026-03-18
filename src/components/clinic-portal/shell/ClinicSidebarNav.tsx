"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ClinicNextActionCard from "./ClinicNextActionCard";
import ClinicStatusCard from "./ClinicStatusCard";

export type ClinicNavItem = {
  label: string;
  href: string;
  placeholder?: boolean;
  matchPrefix?: string;
};

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: ClinicNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.matchPrefix ? pathname.startsWith(item.matchPrefix) : false);
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-cyan-500/20 text-cyan-100"
                : "text-slate-300 hover:bg-white/10 hover:text-slate-100"
            }`}
          >
            <span>{item.label}</span>
            {item.placeholder ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Soon</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export default function ClinicSidebarNav({
  clinicName,
  navItems,
  trustStatus,
  completionPercent,
  onboardingSteps,
  statusChips,
  nextAction,
}: {
  clinicName: string;
  navItems: ClinicNavItem[];
  trustStatus: string;
  completionPercent: number;
  onboardingSteps: number;
  statusChips: Array<{ label: string; ready: boolean }>;
  nextAction: {
    title: string;
    description: string;
    href: string;
    ctaLabel: string;
  };
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <aside className="hidden lg:block lg:w-80">
        <div className="sticky top-6 space-y-4 rounded-3xl border border-slate-700 bg-gradient-to-b from-slate-950 to-slate-900 p-4 shadow-2xl">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Clinic Portal</p>
            <p className="mt-2 text-base font-semibold text-white">{clinicName}</p>
            <p className="mt-1 text-xs text-slate-300">Invited Contributions & Submitted Cases</p>
          </div>
          <NavList items={navItems} pathname={pathname} />
          <ClinicStatusCard
            trustStatus={trustStatus}
            completionPercent={completionPercent}
            onboardingSteps={onboardingSteps}
            statusChips={statusChips}
          />
          <ClinicNextActionCard {...nextAction} />
        </div>
      </aside>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="mb-3 inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
        >
          {mobileOpen ? "Close Portal Nav" : "Open Portal Nav"}
        </button>
        {mobileOpen ? (
          <div className="mb-4 space-y-3 rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-950 to-slate-900 p-3 shadow-2xl">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Clinic Portal</p>
              <p className="mt-1 text-sm font-semibold text-white">{clinicName}</p>
            </div>
            <NavList items={navItems} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <ClinicStatusCard
              trustStatus={trustStatus}
              completionPercent={completionPercent}
              onboardingSteps={onboardingSteps}
              statusChips={statusChips}
            />
            <ClinicNextActionCard {...nextAction} />
          </div>
        ) : null}
      </div>
    </>
  );
}
