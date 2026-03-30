import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { howToThinkAboutRealisticHairTransplantExpectationsArticle as article } from "@/lib/seo/patient-intent-articles/how-to-think-about-realistic-hair-transplant-expectations";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function HowToThinkAboutRealisticHairTransplantExpectationsPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
