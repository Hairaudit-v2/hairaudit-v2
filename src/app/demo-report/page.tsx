import { createPageMetadata } from "@/lib/seo/pageMetadata";
import DemoReportPageContent from "./DemoReportPageContent";

export const metadata = createPageMetadata({
  title: "Sample Report | HairAudit",
  description:
    "View the structure and depth of a HairAudit AI surgical analysis report. Sample content only — no patient data. Request a full audit for your case.",
  pathname: "/demo-report",
});

export default function DemoReportPage() {
  return <DemoReportPageContent />;
}
