import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { hairDirectionAndAngleAfterTransplantArticle as article } from "@/lib/seo/patient-intent-articles/hair-direction-and-angle-after-transplant";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function HairDirectionAndAngleAfterTransplantPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
