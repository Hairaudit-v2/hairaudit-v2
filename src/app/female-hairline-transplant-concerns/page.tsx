import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { femaleHairlineTransplantConcernsArticle as article } from "@/lib/seo/patient-intent-articles/female-hairline-transplant-concerns";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function FemaleHairlineTransplantConcernsPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
