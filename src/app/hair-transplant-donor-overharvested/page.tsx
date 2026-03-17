import { notFound } from "next/navigation";
import IssueEducationPage from "@/components/patient-education/IssueEducationPage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { patientIssueLibrary } from "@/lib/patientEducationIssues";

const issue = patientIssueLibrary.find((item) => item.slug === "hair-transplant-donor-overharvested");

export const metadata = createPageMetadata({
  title: "Donor Overharvested After Hair Transplant | HairAudit",
  description:
    "Learn donor overharvesting signs after a hair transplant and when an independent review can help.",
  pathname: "/hair-transplant-donor-overharvested",
});

export default function HairTransplantDonorOverharvestedPage() {
  if (!issue) {
    notFound();
  }

  return <IssueEducationPage {...issue} />;
}
