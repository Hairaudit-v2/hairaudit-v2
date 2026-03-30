import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { wetHairVsDryHairAfterTransplantArticle as article } from "@/lib/seo/patient-intent-articles/wet-hair-vs-dry-hair-after-transplant";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function WetHairVsDryHairAfterTransplantPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
