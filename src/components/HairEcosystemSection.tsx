import type { HairEcosystemSite } from "@/components/HairEcosystemNav";

type HairEcosystemSectionProps = {
  site: HairEcosystemSite;
  eyebrow?: string;
  benefitStatement?: string;
  className?: string;
};

const PLATFORMS: Array<{
  id: HairEcosystemSite;
  name: string;
  description: string;
  href: string;
}> = [
  {
    id: "hli",
    name: "Hair Longevity Institute",
    description: "Biology-first optimisation and treatment planning. Understand drivers of hair loss, treatment response, and long-term planning before considering surgery.",
    href: "https://hairlongevityinstitute.com",
  },
  {
    id: "hairaudit",
    name: "HairAudit",
    description: "Surgical transparency platform. Evaluate procedures, surgeons, clinic quality, donor handling, implantation quality, and outcomes with independent, evidence-based review.",
    href: "https://hairaudit.com",
  },
  {
    id: "follicleintelligence",
    name: "Follicle Intelligence",
    description: "Analysis engine powering both platforms. Structured, evidence-based assessment of donor, graft, and recipient quality.",
    href: "https://follicleintelligence.ai",
  },
];

const DEFAULT_EYEBROW = "Connected platforms";
const DEFAULT_BENEFIT =
  "Together, these platforms help patients understand hair biology, evaluate surgical options, and make more informed decisions with greater transparency.";

export default function HairEcosystemSection({
  site,
  eyebrow = DEFAULT_EYEBROW,
  benefitStatement = DEFAULT_BENEFIT,
  className = "",
}: HairEcosystemSectionProps) {
  return (
    <section
      aria-labelledby="ecosystem-heading"
      className={`relative px-4 sm:px-6 py-16 sm:py-20 ${className}`.trim()}
    >
      <div className="max-w-5xl mx-auto">
        <p className="text-xs uppercase tracking-widest text-slate-500 font-medium">
          {eyebrow}
        </p>
        <h2 id="ecosystem-heading" className="mt-2 text-xl sm:text-2xl font-bold text-white sr-only">
          Hair Intelligence Ecosystem
        </h2>
        <p className="mt-4 text-slate-300 text-sm sm:text-base max-w-3xl">
          {benefitStatement}
        </p>
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {PLATFORMS.map((platform) => {
            const isCurrent = site === platform.id;
            const isExternal = !isCurrent;
            const cardClass =
              "rounded-xl border p-5 sm:p-6 flex flex-col " +
              (isCurrent
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-white/10 bg-white/5 hover:border-white/15 transition-colors");

            const content = (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-base">
                    {platform.name}
                  </span>
                  {isCurrent && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-200 bg-amber-500/20 border border-amber-500/30"
                      aria-hidden
                    >
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                  {platform.description}
                </p>
                {isExternal && (
                  <span className="mt-4 text-xs font-medium text-amber-300/90">
                    Visit {platform.name} →
                  </span>
                )}
              </>
            );

            if (isCurrent) {
              return (
                <div key={platform.id} className={cardClass} aria-current="page">
                  {content}
                </div>
              );
            }

            return (
              <a
                key={platform.id}
                href={platform.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cardClass}
              >
                {content}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
