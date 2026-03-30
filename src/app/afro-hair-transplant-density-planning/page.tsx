import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { afroHairTransplantDensityPlanningArticle as article } from "@/lib/seo/patient-intent-articles/afro-hair-transplant-density-planning";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function AfroHairTransplantDensityPlanningPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
