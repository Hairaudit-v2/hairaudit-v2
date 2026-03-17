import { notFound } from "next/navigation";
import IssueEducationPage from "@/components/patient-education/IssueEducationPage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { patientIssueLibrary } from "@/lib/patientEducationIssues";

const issue = patientIssueLibrary.find((item) => item.slug === "hair-transplant-not-growing");

export const metadata = createPageMetadata({
  title: "Hair Transplant Not Growing | HairAudit",
  description:
    "Understand delayed hair transplant growth, normal timelines, and signs that suggest independent review is needed.",
  pathname: "/hair-transplant-not-growing",
});

export default function HairTransplantNotGrowingPage() {
  if (!issue) {
    notFound();
  }

  return <IssueEducationPage {...issue} />;
}
