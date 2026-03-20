import type { Metadata } from "next";
import SampleReportMarketing from "@/components/marketing/SampleReportMarketing";
import { createLocalizedPageMetadata, resolvePublicSeoLocale } from "@/lib/seo/localeMetadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolvePublicSeoLocale();
  return createLocalizedPageMetadata(locale, {
    titleKey: "marketing.meta.sampleReport.title",
    descriptionKey: "marketing.meta.sampleReport.description",
    pathname: "/sample-report",
  });
}

export default function SampleReportPage() {
  return <SampleReportMarketing />;
}
