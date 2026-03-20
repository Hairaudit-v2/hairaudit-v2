import type { Metadata } from "next";
import HowItWorksMarketing from "@/components/marketing/HowItWorksMarketing";
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
  return <HowItWorksMarketing />;
}
