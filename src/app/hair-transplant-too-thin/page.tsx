import { notFound } from "next/navigation";
import IssueEducationPage from "@/components/patient-education/IssueEducationPage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { patientIssueLibrary } from "@/lib/patientEducationIssues";

const issue = patientIssueLibrary.find((item) => item.slug === "hair-transplant-too-thin");

export const metadata = createPageMetadata({
  title: issue ? `${issue.title} | HairAudit` : "Hair Transplant Too Thin | HairAudit",
  description:
    issue?.description ??
    "Learn why a hair transplant can look too thin, what is normal over time, and when to request independent review.",
  pathname: "/hair-transplant-too-thin",
});

export default function HairTransplantTooThinPage() {
  if (!issue) {
    notFound();
  }

  return <IssueEducationPage {...issue} />;
}
