import { notFound } from "next/navigation";
import ValidationEducationPage from "@/components/patient-education/ValidationEducationPage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { validationFunnelPages } from "@/lib/validationFunnelPages";

const pageContent = validationFunnelPages.find((item) => item.slug === "is-my-hair-transplant-normal");

export const metadata = createPageMetadata({
  title: "Is My Hair Transplant Normal? | HairAudit",
  description:
    "Patient-friendly guide to normal transplant recovery and quality validation with structured scoring.",
  pathname: "/is-my-hair-transplant-normal",
});

export default function IsMyHairTransplantNormalPage() {
  if (!pageContent) notFound();
  return <ValidationEducationPage {...pageContent} />;
}
