import dynamic from "next/dynamic";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HomePageHero from "@/components/marketing/HomePageHero";
import OrganizationWebSiteSchema from "@/components/seo/OrganizationWebSiteSchema";
import { createLocalizedPageMetadata } from "@/lib/seo/localeMetadata";
import { DEFAULT_LOCALE } from "@/lib/i18n/constants";

const HomePageMarketing = dynamic(
  () => import("@/components/marketing/HomePageMarketing").then((m) => m.default),
  { ssr: true }
);

export const revalidate = 600;

/**
 * Static metadata (default locale) so `/` can be prerendered without `cookies()` / `headers()`.
 * In-page marketing copy follows {@link I18nProvider} on the client after hydration.
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
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      <OrganizationWebSiteSchema />
      <SiteHeader />

      <main id="main-content" className="relative flex-1">
        <HomePageHero />
        <HomePageMarketing />
      </main>

      <SiteFooter />
    </div>
  );
}
