import { notFound } from "next/navigation";
import IssueEducationPage from "@/components/patient-education/IssueEducationPage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { patientIssueLibrary } from "@/lib/patientEducationIssues";

const issue = patientIssueLibrary.find((item) => item.slug === "bad-hair-transplant-hairline");

export const metadata = createPageMetadata({
  title: "Bad Hair Transplant Hairline | HairAudit",
  description:
    "Patient-friendly guide to unnatural hair transplant hairline concerns and when to seek independent review.",
  pathname: "/bad-hair-transplant-hairline",
});

export default function BadHairTransplantHairlinePage() {
  if (!issue) {
    notFound();
  }

  return <IssueEducationPage {...issue} />;
}
