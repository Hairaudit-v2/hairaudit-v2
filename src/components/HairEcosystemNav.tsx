"use client";

import { PLATFORM } from "@/lib/constants/platform";

export type HairEcosystemSite = "hli" | "hairaudit" | "follicleintelligence";

type HairEcosystemNavProps = {
  currentSite?: HairEcosystemSite;
  className?: string;
};

const ECOSYSTEM_LINKS = [
  {
    id: "hli" as const,
    label: "Hair Longevity Institute",
    href: PLATFORM.HLI_URL,
  },
  {
    id: "hairaudit" as const,
    label: "HairAudit",
    href: PLATFORM.HA_URL,
  },
  {
    id: "follicleintelligence" as const,
    label: "Follicle Intelligence",
    href: PLATFORM.FI_URL,
  },
] as const;

export default function HairEcosystemNav({
  currentSite,
  className = "",
}: HairEcosystemNavProps) {
  return (
    <div
      role="navigation"
      aria-label="Hair Intelligence Ecosystem"
      className={
        "w-full border-b border-slate-700/60 bg-slate-900/95 text-slate-400 " +
        "flex items-center justify-center min-h-0 " +
        className.trim()
      }
    >
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 py-2 flex items-center gap-4 sm:gap-6 flex-wrap sm:flex-nowrap justify-center sm:justify-between">
        <span className="text-[11px] sm:text-xs uppercase tracking-widest text-slate-500 font-medium shrink-0">
          Part of the Hair Intelligence Ecosystem
        </span>
        <nav
          className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-600/60 py-0.5 -mx-1 sm:mx-0"
          aria-label="Ecosystem sites"
        >
          {ECOSYSTEM_LINKS.map((item) => {
            const isCurrent = currentSite === item.id;
            const linkClass =
              "shrink-0 text-[11px] sm:text-xs font-medium tracking-wide transition-colors rounded-sm px-2 py-1 -mx-0.5 " +
              (isCurrent
                ? "text-slate-200 border-b border-amber-500/50 pb-0.5 cursor-default"
                : "text-slate-500 hover:text-slate-300 border-b border-transparent hover:border-slate-600");

            if (isCurrent) {
              return (
                <span
                  key={item.id}
                  className={linkClass}
                  aria-current="page"
                  title="Current site"
                >
                  {item.label}
                </span>
              );
            }

            return (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
