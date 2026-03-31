import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { repairVsWaitAfterPoorHairTransplantGrowthArticle as article } from "@/lib/seo/patient-intent-articles/repair-vs-wait-after-poor-hair-transplant-growth";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function RepairVsWaitAfterPoorHairTransplantGrowthPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
