import { notFound } from "next/navigation";
import ValidationEducationPage from "@/components/patient-education/ValidationEducationPage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { validationFunnelPages } from "@/lib/validationFunnelPages";

const pageContent = validationFunnelPages.find((item) => item.slug === "great-hair-transplants");

export const metadata = createPageMetadata({
  title: "Great Hair Transplants | HairAudit",
  description:
    "Learn how excellent hair transplant results are recognized and scored in an evidence-based way.",
  pathname: "/great-hair-transplants",
});

export default function GreatHairTransplantsPage() {
  if (!pageContent) notFound();
  return <ValidationEducationPage {...pageContent} />;
}
