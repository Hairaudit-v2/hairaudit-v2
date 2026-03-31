import { notFound } from "next/navigation";
import IssueEducationPage from "@/components/patient-education/IssueEducationPage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { patientIssueLibrary } from "@/lib/patientEducationIssues";

const issue = patientIssueLibrary.find((item) => item.slug === "hair-transplant-graft-failure");

export const metadata = createPageMetadata({
  title: "Hair Transplant Graft Failure: Signs, Timing & Review | HairAudit",
  description:
    "Signs that may suggest graft failure after a hair transplant, how timing matters, and when an independent forensic audit can clarify evidence—without replacing your clinician.",
  pathname: "/hair-transplant-graft-failure",
});

export default function HairTransplantGraftFailurePage() {
  if (!issue) {
    notFound();
  }

  return <IssueEducationPage {...issue} />;
}
