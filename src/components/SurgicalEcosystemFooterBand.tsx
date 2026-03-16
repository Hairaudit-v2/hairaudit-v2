import { SURGICAL_ECOSYSTEM_FOOTER } from "@/lib/constants/platform";

export default function SurgicalEcosystemFooterBand() {
  return (
    <div
      role="contentinfo"
      aria-label="Surgical Intelligence Ecosystem"
      className="border-t border-slate-700/80 bg-slate-900/80"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <p className="text-center text-xs uppercase tracking-widest text-slate-500 font-medium mb-3">
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
              className="text-slate-400 hover:text-amber-400 transition-colors"
            >
              <span className="font-medium text-slate-300">{item.label}</span>
              <span className="text-slate-500 ml-1">({item.tag})</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
