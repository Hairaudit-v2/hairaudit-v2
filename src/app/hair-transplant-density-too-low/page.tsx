import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { hairTransplantDensityTooLowArticle as article } from "@/lib/seo/patient-intent-articles/hair-transplant-density-too-low";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function HairTransplantDensityTooLowPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
