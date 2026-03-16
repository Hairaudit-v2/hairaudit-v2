import { SURGICAL_ECOSYSTEM_FOOTER } from "@/lib/constants/platform";

type SurgicalEcosystemFooterBandProps = {
  theme?: "default" | "light";
};

export default function SurgicalEcosystemFooterBand({
  theme = "default",
}: SurgicalEcosystemFooterBandProps) {
  const isLight = theme === "light";
  const bandClass = isLight
    ? "border-t border-slate-200 bg-neutral-50"
    : "border-t border-slate-700/80 bg-slate-900/80";
  const textClass = isLight
    ? "text-center text-xs uppercase tracking-widest text-slate-500 font-medium mb-3"
    : "text-center text-xs uppercase tracking-widest text-slate-500 font-medium mb-3";
  const linkClass = isLight
    ? "text-slate-600 hover:text-amber-700 transition-colors"
    : "text-slate-400 hover:text-amber-400 transition-colors";
  const labelClass = isLight ? "font-medium text-slate-700" : "font-medium text-slate-300";
  const tagClass = isLight ? "text-slate-500 ml-1" : "text-slate-500 ml-1";

  return (
    <div
      role="contentinfo"
      aria-label="Surgical Intelligence Ecosystem"
      className={bandClass}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <p className={textClass}>
          Part of the Surgical Intelligence Ecosystem™
        </p>
        <nav
          aria-label="Ecosystem platforms"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm"
        >
          {SURGICAL_ECOSYSTEM_FOOTER.map((item) => (
            <a
              key={item.label}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              <span className={labelClass}>{item.label}</span>
              <span className={tagClass}>({item.tag})</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
