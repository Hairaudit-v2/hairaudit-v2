import { createPageMetadata } from "@/lib/seo/pageMetadata";
import SampleReportMarketing from "@/components/marketing/SampleReportMarketing";

export const metadata = createPageMetadata({
  title: "Sample Audit Report | HairAudit",
  description:
    "Preview a premium HairAudit forensic-style report with score breakdowns, image evidence analysis, findings, and correction guidance.",
  pathname: "/sample-report",
});

export default function SampleReportPage() {
  return <SampleReportMarketing />;
}
