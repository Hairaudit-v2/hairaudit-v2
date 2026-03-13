import { notFound } from "next/navigation";
import ValidationEducationPage from "@/components/patient-education/ValidationEducationPage";
import { validationFunnelPages } from "@/lib/validationFunnelPages";

const pageContent = validationFunnelPages.find((item) => item.slug === "best-hair-transplant-results");

export const metadata = {
  title: "Best Hair Transplant Results | HairAudit",
  description:
    "Explore evidence-based markers found in the best hair transplant results and get independent score validation.",
};

export default function BestHairTransplantResultsPage() {
  if (!pageContent) notFound();
  return <ValidationEducationPage {...pageContent} />;
}
