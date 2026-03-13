import { notFound } from "next/navigation";
import ValidationEducationPage from "@/components/patient-education/ValidationEducationPage";
import { validationFunnelPages } from "@/lib/validationFunnelPages";

const pageContent = validationFunnelPages.find((item) => item.slug === "is-my-hair-transplant-normal");

export const metadata = {
  title: "Is My Hair Transplant Normal? | HairAudit",
  description:
    "Patient-friendly guide to normal transplant recovery and quality validation with structured scoring.",
};

export default function IsMyHairTransplantNormalPage() {
  if (!pageContent) notFound();
  return <ValidationEducationPage {...pageContent} />;
}
