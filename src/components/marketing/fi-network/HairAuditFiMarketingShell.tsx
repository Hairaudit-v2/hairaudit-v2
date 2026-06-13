import type { ReactNode } from "react";

import { EcosystemFooter } from "@/packages/ui";

import { resolveProductHref } from "@/lib/network/resolveProductHref";

import HairAuditFiNavBar from "./HairAuditFiNavBar";

const LEGAL_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Disclaimer", href: "/disclaimer" },
] as const;

type HairAuditFiMarketingShellProps = {
  children: ReactNode;
};

/**
 * Follicle Intelligence Network chrome for HairAudit marketing surfaces.
 * Scoped design tokens apply via `data-hairaudit-fi-network` (see `globals.css`).
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

      <HairAuditFiNavBar />

      {children}

      <EcosystemFooter
        resolveProductHref={resolveProductHref}
        legalLinks={LEGAL_LINKS}
        statement="HairAudit is the outcome verification and surgical quality assurance layer of the Follicle Intelligence Network — structured evidence, independent review discipline, and reporting designed for real-world accountability."
      />
    </div>
  );
}
