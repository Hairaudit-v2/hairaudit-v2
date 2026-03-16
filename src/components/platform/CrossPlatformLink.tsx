import { FI_HOME, HA_HOME } from "@/config/platform-links";
import { PLATFORM } from "@/lib/constants/platform";

type CrossPlatformLinkMode = "hairAudit" | "follicleIntelligence";

type CrossPlatformLinkProps = {
  mode: CrossPlatformLinkMode;
  className?: string;
  theme?: "default" | "light";
};

const CONTENT: Record<
  CrossPlatformLinkMode,
  {
    message: string;
    cta: string;
    href: string;
  }
> = {
  hairAudit: {
    message: "HairAudit is powered by the Follicle Intelligence engine.",
    cta: `Visit ${PLATFORM.FI_NAME}`,
    href: FI_HOME,
  },
  follicleIntelligence: {
    message: "HairAudit is the first application powered by Follicle Intelligence.",
    cta: "Explore HairAudit",
    href: HA_HOME,
  },
};

export default function CrossPlatformLink({
  mode,
  className = "",
  theme = "default",
}: CrossPlatformLinkProps) {
  const content = CONTENT[mode];
  const isLight = theme === "light";
  const asideClass = isLight
    ? "rounded-xl border border-slate-200 bg-neutral-50 p-4 sm:p-5"
    : "rounded-xl border border-slate-700 bg-slate-800/40 p-4 sm:p-5";
  const labelClass = isLight
    ? "text-xs uppercase tracking-wider text-slate-500"
    : "text-xs uppercase tracking-wider text-slate-400";
  const messageClass = isLight ? "mt-2 text-sm text-slate-600" : "mt-2 text-sm text-slate-200";

  return (
    <aside className={`${asideClass} ${className}`.trim()}>
      <p className={labelClass}>Platform relationship</p>
      <p className={messageClass}>{content.message}</p>
      <a
        href={content.href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-600 border border-amber-600/20"
      >
        {content.cta}
      </a>
    </aside>
  );
}
