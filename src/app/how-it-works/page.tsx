import type { Metadata } from "next";
import HowItWorksMarketing from "@/components/marketing/HowItWorksMarketing";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import { createLocalizedPageMetadata, resolvePublicSeoLocale } from "@/lib/seo/localeMetadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolvePublicSeoLocale();
  return createLocalizedPageMetadata(locale, {
    titleKey: "marketing.meta.howItWorks.title",
    descriptionKey: "marketing.meta.howItWorks.description",
    pathname: "/how-it-works",
  });
}

export default function HowItWorksPage() {
  return (
    <>
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "How hair transplant audits work", pathname: "/how-it-works" },
        ]}
      />
      <HowItWorksMarketing />
    </>
  );
}
