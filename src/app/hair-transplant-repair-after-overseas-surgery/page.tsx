import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { hairTransplantRepairAfterOverseasSurgeryArticle as article } from "@/lib/seo/patient-intent-articles/hair-transplant-repair-after-overseas-surgery";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function HairTransplantRepairAfterOverseasSurgeryPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
