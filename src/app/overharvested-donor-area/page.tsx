import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { overharvestedDonorAreaArticle as article } from "@/lib/seo/patient-intent-articles/overharvested-donor-area";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function OverharvestedDonorAreaPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
