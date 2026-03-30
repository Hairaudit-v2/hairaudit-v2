import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { canAHairTransplantBeAuditedFromPhotosArticle as article } from "@/lib/seo/patient-intent-articles/can-a-hair-transplant-be-audited-from-photos";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function CanAHairTransplantBeAuditedFromPhotosPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
