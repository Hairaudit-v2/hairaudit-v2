import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { beardOrBodyHairTransplantQuestionsArticle as article } from "@/lib/seo/patient-intent-articles/beard-or-body-hair-transplant-questions";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function BeardOrBodyHairTransplantQuestionsPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
