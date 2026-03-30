import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { whenIsAHairTransplantFinalArticle as article } from "@/lib/seo/patient-intent-articles/when-is-a-hair-transplant-final";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function WhenIsAHairTransplantFinalPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
