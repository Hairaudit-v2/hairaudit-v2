import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { canAnOverharvestedDonorBeCorrectedArticle as article } from "@/lib/seo/patient-intent-articles/can-an-overharvested-donor-be-corrected";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function CanAnOverharvestedDonorBeCorrectedPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
