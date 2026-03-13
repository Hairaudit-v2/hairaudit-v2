import type { Metadata } from "next";
import SampleReportPage from "@/app/sample-report/page";

export const metadata: Metadata = {
  title: "Sample Audit Report | HairAudit",
  description:
    "Preview a premium HairAudit forensic-style report with score breakdowns, image evidence analysis, findings, and correction guidance.",
  alternates: {
    canonical: "/sample-audit",
  },
};

export default function SampleAuditPage() {
  return <SampleReportPage />;
}
