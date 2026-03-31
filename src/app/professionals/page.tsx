import type { Metadata } from "next";
import ProfessionalsHub from "@/components/marketing/ProfessionalsHub";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
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
  return (
    <>
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "Independent audit standards for professionals", pathname: "/professionals" },
        ]}
      />
      <ProfessionalsHub />
    </>
  );
}
