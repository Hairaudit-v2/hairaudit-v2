import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { badHairTransplantSignsArticle as article } from "@/lib/seo/patient-intent-articles/bad-hair-transplant-signs";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function BadHairTransplantSignsPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
