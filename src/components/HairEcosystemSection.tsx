import type { HairEcosystemSite } from "@/components/HairEcosystemNav";
import { PLATFORM } from "@/lib/constants/platform";

type HairEcosystemSectionProps = {
  site: HairEcosystemSite;
  eyebrow?: string;
  className?: string;
  theme?: "dark" | "light";
};

const PLATFORMS: Array<{
  id: HairEcosystemSite;
  name: string;
  tagline: string;
  href: string;
}> = [
  {
    id: "hli",
    name: "Hair Longevity Institute",
    tagline: "Treatment pathway.",
    href: PLATFORM.HLI_URL,
  },
  {
    id: "hairaudit",
    name: "HairAudit",
    tagline: "Surgical truth and audit.",
    href: PLATFORM.HA_URL,
  },
  {
    id: "follicleintelligence",
    name: "Follicle Intelligence",
    tagline: "Analysis engine.",
    href: PLATFORM.FI_URL,
  },
];

const DEFAULT_EYEBROW = "Hair Intelligence ecosystem";

export default function HairEcosystemSection({
  site,
  eyebrow = DEFAULT_EYEBROW,
  className = "",
  theme = "dark",
}: HairEcosystemSectionProps) {
  const isLight = theme === "light";
  const order = ["hli", "follicleintelligence", "hairaudit"] as const;
  const ordered = order.map((id) => PLATFORMS.find((p) => p.id === id)!);

  return (
    <section
      aria-labelledby="ecosystem-heading"
      className={`relative px-4 sm:px-6 py-20 sm:py-24 border-t ${isLight ? "border-slate-200 bg-neutral-50" : ""} ${className}`.trim()}
    >
      <div className="max-w-3xl mx-auto">
        <p className={`text-xs uppercase tracking-widest font-medium ${isLight ? "text-slate-500" : "text-slate-500"}`}>
          {eyebrow}
        </p>
        <h2 id="ecosystem-heading" className="mt-2 text-xl sm:text-2xl font-bold sr-only">
          Hair Intelligence Ecosystem
        </h2>

        {/* Simple diagram: three nodes, FI in centre */}
        <div className="mt-8 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-4">
          {ordered.map((platform, index) => {
            const isCurrent = site === platform.id;
            const isExternal = !isCurrent;
            const isCenter = platform.id === "follicleintelligence";
            const cardClass =
              "rounded-xl border w-full sm:w-[140px] flex-shrink-0 p-4 text-center transition-colors " +
              (isLight
                ? isCurrent
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-slate-200 bg-white"
                : isCurrent
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-white/10 bg-white/5");

            const content = (
              <>
                <p className={`text-sm font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
                  {platform.name}
                </p>
                <p className={`mt-1 text-xs ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  {platform.tagline}
                </p>
                {isCurrent && (
                  <span
                    className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${isLight ? "text-amber-800 bg-amber-500/20" : "text-amber-200 bg-amber-500/20"}`}
                    aria-hidden
                  >
                    You are here
                  </span>
                )}
                {isExternal && (
                  <span className={`mt-2 inline-block text-[10px] font-medium ${isLight ? "text-amber-700" : "text-amber-400/90"}`}>
                    Visit →
                  </span>
                )}
              </>
            );

            const card = (
              <div className={`flex h-full flex-col items-center justify-center ${cardClass}`}>
                {content}
              </div>
            );

            return (
              <div key={platform.id} className="flex items-center gap-2 sm:gap-0">
                {index > 0 && (
                  <span
                    className="hidden flex-shrink-0 sm:block sm:w-8"
                    aria-hidden
                  >
                    <svg viewBox="0 0 32 24" className="w-8 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2 12h20M20 8l4 4-4 4" />
                    </svg>
                  </span>
                )}
                {isExternal ? (
                  <a
                    href={platform.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full w-full sm:w-[140px] flex-shrink-0 flex-col items-center justify-center rounded-xl border p-4 text-center transition-colors hover:border-amber-500/30"
                  >
                    {content}
                  </a>
                ) : (
                  <div className="w-full sm:w-[140px]" aria-current="page">
                    {card}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* One line: how they connect */}
        <p className={`mt-6 text-center text-sm ${isLight ? "text-slate-500" : "text-slate-400"}`}>
          Follicle Intelligence powers analysis for both Hair Longevity Institute and HairAudit.
        </p>
      </div>
    </section>
  );
}
