import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { normalDonorHealingAfterFueArticle as article } from "@/lib/seo/patient-intent-articles/normal-donor-healing-after-fue";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function NormalDonorHealingAfterFuePage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
