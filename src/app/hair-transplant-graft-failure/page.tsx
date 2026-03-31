import { notFound } from "next/navigation";
import IssueEducationPage from "@/components/patient-education/IssueEducationPage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { patientIssueLibrary } from "@/lib/patientEducationIssues";

const issue = patientIssueLibrary.find((item) => item.slug === "hair-transplant-graft-failure");

export const metadata = createPageMetadata({
  title: issue ? `${issue.title} | HairAudit` : "Hair Transplant Graft Failure | HairAudit",
  description:
    issue?.description ??
    "Signs that may suggest graft failure after a hair transplant, how timing matters, and when an independent forensic audit can clarify evidence—without replacing your clinician.",
  pathname: "/hair-transplant-graft-failure",
});

export default function HairTransplantGraftFailurePage() {
  if (!issue) {
    notFound();
  }

  return <IssueEducationPage {...issue} />;
}
