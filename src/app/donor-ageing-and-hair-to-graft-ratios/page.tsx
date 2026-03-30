import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { donorAgeingAndHairToGraftRatiosArticle as article } from "@/lib/seo/patient-intent-articles/donor-ageing-and-hair-to-graft-ratios";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function DonorAgeingAndHairToGraftRatiosPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
