import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { shouldYouTrustAClinicAssessmentOfItsOwnWorkArticle as article } from "@/lib/seo/patient-intent-articles/should-you-trust-a-clinic-assessment-of-its-own-work";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function ShouldYouTrustAClinicAssessmentOfItsOwnWorkPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
