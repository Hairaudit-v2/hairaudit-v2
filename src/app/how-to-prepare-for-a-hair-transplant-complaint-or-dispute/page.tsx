import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { howToPrepareForAHairTransplantComplaintOrDisputeArticle as article } from "@/lib/seo/patient-intent-articles/how-to-prepare-for-a-hair-transplant-complaint-or-dispute";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function HowToPrepareForAHairTransplantComplaintOrDisputePage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
