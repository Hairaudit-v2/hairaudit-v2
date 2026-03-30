import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { badCrownResultAfterHairTransplantArticle as article } from "@/lib/seo/patient-intent-articles/bad-crown-result-after-hair-transplant";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function BadCrownResultAfterHairTransplantPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
