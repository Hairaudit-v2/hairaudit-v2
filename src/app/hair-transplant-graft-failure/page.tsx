import { notFound } from "next/navigation";
import IssueEducationPage from "@/components/patient-education/IssueEducationPage";
import { patientIssueLibrary } from "@/lib/patientEducationIssues";

const issue = patientIssueLibrary.find((item) => item.slug === "hair-transplant-graft-failure");

export const metadata = {
  title: "Hair Transplant Graft Failure | HairAudit",
  description:
    "Understand possible hair transplant graft failure signs and when an independent evidence review is appropriate.",
};

export default function HairTransplantGraftFailurePage() {
  if (!issue) {
    notFound();
  }

  return <IssueEducationPage {...issue} />;
}
