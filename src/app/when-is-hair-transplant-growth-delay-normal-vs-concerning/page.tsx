import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { whenIsHairTransplantGrowthDelayNormalVsConcerningArticle as article } from "@/lib/seo/patient-intent-articles/when-is-hair-transplant-growth-delay-normal-vs-concerning";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function WhenIsHairTransplantGrowthDelayNormalVsConcerningPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
