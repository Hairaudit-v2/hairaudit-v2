import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import OrganizationWebSiteSchema from "@/components/seo/OrganizationWebSiteSchema";
import { createLocalizedPageMetadata, resolvePublicSeoLocale } from "@/lib/seo/localeMetadata";
import { getHomepageAuthRedirectTarget } from "@/lib/auth/redirects";

const HomePageMarketing = nextDynamic(
  () => import("@/components/marketing/HomePageMarketing").then((m) => m.default),
  { ssr: true }
);

export const revalidate = 600;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolvePublicSeoLocale();
  return createLocalizedPageMetadata(locale, {
    titleKey: "marketing.meta.home.title",
    descriptionKey: "marketing.meta.home.description",
    pathname: "/",
  });
}

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function HomePage(props: PageProps) {
  const rawParams = props.searchParams;
  const searchParams = rawParams ? await rawParams : {};
  const authRedirect = getHomepageAuthRedirectTarget(searchParams);
  if (authRedirect) redirect(authRedirect);

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      <OrganizationWebSiteSchema />
      <SiteHeader />

      <HomePageMarketing />

      <SiteFooter />
    </div>
  );
}
