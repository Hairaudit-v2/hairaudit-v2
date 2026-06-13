import type { Metadata } from "next";
import OrganizationWebSiteSchema from "@/components/seo/OrganizationWebSiteSchema";
import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import HairAuditNetworkHomePage from "@/components/marketing/fi-network/HairAuditNetworkHomePage";
import { createLocalizedPageMetadata } from "@/lib/seo/localeMetadata";
import { DEFAULT_LOCALE } from "@/lib/i18n/constants";

export const revalidate = 600;

/**
 * Static metadata (default locale) so `/` can be prerendered without `cookies()` / `headers()`.
 */
export function generateMetadata(): Metadata {
  return createLocalizedPageMetadata(DEFAULT_LOCALE, {
    titleKey: "marketing.meta.home.title",
    descriptionKey: "marketing.meta.home.description",
    pathname: "/",
  });
}

export default function HomePage() {
  return (
    <HairAuditFiMarketingShell>
      <OrganizationWebSiteSchema />
      <HairAuditNetworkHomePage />
    </HairAuditFiMarketingShell>
  );
}
