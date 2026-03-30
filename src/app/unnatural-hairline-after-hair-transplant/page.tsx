import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { unnaturalHairlineAfterHairTransplantArticle as article } from "@/lib/seo/patient-intent-articles/unnatural-hairline-after-hair-transplant";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function UnnaturalHairlineAfterHairTransplantPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
