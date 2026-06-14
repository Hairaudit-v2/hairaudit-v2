import type { ReactNode } from "react";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

type HairAuditFiMarketingShellProps = {
  children: ReactNode;
};

/**
 * Public HairAudit chrome with Follicle Intelligence network alignment.
 * Keeps HairAudit standalone while sharing the upgraded corporate surface.
 */
export default function HairAuditFiMarketingShell({ children }: HairAuditFiMarketingShellProps) {
  return (
    <div
      data-hairaudit-fi-network="marketing"
      className="relative min-h-screen bg-background text-foreground"
    >
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-10%,rgba(251,191,36,0.07),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_90%_55%,rgba(56,189,248,0.06),transparent)]" />
      </div>

      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
