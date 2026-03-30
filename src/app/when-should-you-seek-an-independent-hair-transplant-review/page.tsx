import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { whenShouldYouSeekAnIndependentHairTransplantReviewArticle as article } from "@/lib/seo/patient-intent-articles/when-should-you-seek-an-independent-hair-transplant-review";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function WhenShouldYouSeekAnIndependentHairTransplantReviewPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
