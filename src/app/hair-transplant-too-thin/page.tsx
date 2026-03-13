import { notFound } from "next/navigation";
import IssueEducationPage from "@/components/patient-education/IssueEducationPage";
import { patientIssueLibrary } from "@/lib/patientEducationIssues";

const issue = patientIssueLibrary.find((item) => item.slug === "hair-transplant-too-thin");

export const metadata = {
  title: "Hair Transplant Too Thin | HairAudit",
  description:
    "Learn why a hair transplant can look too thin, what is normal over time, and when to request independent review.",
};

export default function HairTransplantTooThinPage() {
  if (!issue) {
    notFound();
  }

  return <IssueEducationPage {...issue} />;
}
