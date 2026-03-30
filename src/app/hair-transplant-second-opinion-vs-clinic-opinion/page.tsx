import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { hairTransplantSecondOpinionVsClinicOpinionArticle as article } from "@/lib/seo/patient-intent-articles/hair-transplant-second-opinion-vs-clinic-opinion";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function HairTransplantSecondOpinionVsClinicOpinionPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
