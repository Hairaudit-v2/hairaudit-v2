import { notFound } from "next/navigation";
import ValidationEducationPage from "@/components/patient-education/ValidationEducationPage";
import { validationFunnelPages } from "@/lib/validationFunnelPages";

const pageContent = validationFunnelPages.find((item) => item.slug === "great-hair-transplants");

export const metadata = {
  title: "Great Hair Transplants | HairAudit",
  description:
    "Learn how excellent hair transplant results are recognized and scored in an evidence-based way.",
};

export default function GreatHairTransplantsPage() {
  if (!pageContent) notFound();
  return <ValidationEducationPage {...pageContent} />;
}
