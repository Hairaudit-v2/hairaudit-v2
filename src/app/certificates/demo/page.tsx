/**
 * Placeholder demo certificate page. Displays one of the demo certificates by tier.
 * Static v1: no persistence. Used by homepage CertifiedClinicsSection links.
 */

import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CertificateView from "@/components/certificates/CertificateView";
import { DEMO_CERTIFICATES } from "@/lib/certificates/demoCertificates";
import type { CertificateTier } from "@/lib/certificates/types";

type PageProps = { searchParams: Promise<{ tier?: string }> };

const VALID_TIERS: CertificateTier[] = ["verified", "silver", "gold", "platinum"];

export default async function CertificateDemoPage(props: PageProps) {
  const { tier: tierParam } = await props.searchParams;
  const tier = (tierParam ?? "platinum").toLowerCase() as CertificateTier;
  if (!VALID_TIERS.includes(tier)) notFound();

  const cert = DEMO_CERTIFICATES.find((c) => c.tier === tier) ?? DEMO_CERTIFICATES[0];

  return (
    <div className="min-h-screen flex flex-col bg-stone-200 text-stone-900">
      <SiteHeader />
      <main className="relative flex-1">
        <CertificateView data={cert} variant="fullPage" showDownloadPlaceholder />
      </main>
      <SiteFooter />
    </div>
  );
}
