import { notFound } from "next/navigation";
import ValidationEducationPage from "@/components/patient-education/ValidationEducationPage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { validationFunnelPages } from "@/lib/validationFunnelPages";

const pageContent = validationFunnelPages.find((item) => item.slug === "best-hair-transplant-results");

export const metadata = createPageMetadata({
  title: "Best Hair Transplant Results | HairAudit",
  description:
    "Explore evidence-based markers found in the best hair transplant results and get independent score validation.",
  pathname: "/best-hair-transplant-results",
});

export default function BestHairTransplantResultsPage() {
  if (!pageContent) notFound();
  return <ValidationEducationPage {...pageContent} />;
}
