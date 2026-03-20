import type { Metadata } from "next";
import ProfessionalsHub from "@/components/marketing/ProfessionalsHub";
import { createLocalizedPageMetadata, resolvePublicSeoLocale } from "@/lib/seo/localeMetadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolvePublicSeoLocale();
  return createLocalizedPageMetadata(locale, {
    titleKey: "marketing.meta.professionals.title",
    descriptionKey: "marketing.meta.professionals.description",
    pathname: "/professionals",
  });
}

export default function ProfessionalsPage() {
  return <ProfessionalsHub />;
}
