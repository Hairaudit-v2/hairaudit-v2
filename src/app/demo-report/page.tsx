import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import DemoReportPageContent from "./DemoReportPageContent";

export const metadata = createPageMetadata({
  title: "Interactive Sample Hair Transplant Audit Report | HairAudit",
  description:
    "Explore the structure of a HairAudit forensic audit report: domains, evidence, and confidence—sample content only, no patient data. For the marketing walkthrough, see the sample report page; to submit your case, request a review.",
  pathname: "/demo-report",
});

export default function DemoReportPage() {
  return (
    <>
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "Interactive audit demo", pathname: "/demo-report" },
        ]}
      />
      <DemoReportPageContent />
    </>
  );
}
