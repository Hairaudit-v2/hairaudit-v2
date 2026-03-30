import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { howToReadAHairauditReportArticle as article } from "@/lib/seo/patient-intent-articles/how-to-read-a-hairaudit-report";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function HowToReadAHairauditReportPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
