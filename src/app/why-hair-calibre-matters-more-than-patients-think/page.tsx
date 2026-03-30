import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { whyHairCalibreMattersMoreThanPatientsThinkArticle as article } from "@/lib/seo/patient-intent-articles/why-hair-calibre-matters-more-than-patients-think";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function WhyHairCalibreMattersMoreThanPatientsThinkPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
