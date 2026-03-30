import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { donorReserveAndFutureOptionsArticle as article } from "@/lib/seo/patient-intent-articles/donor-reserve-and-future-options";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function DonorReserveAndFutureOptionsPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
