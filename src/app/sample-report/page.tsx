import { permanentRedirect } from "next/navigation";

import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Clinical Intelligence Report Preview | HairAudit",
  description:
    "Preview how HairAudit evaluates donor quality, progression risk, recipient viability, and planning concerns. Sample content only—start your free HairAudit when ready.",
  pathname: "/demo-report",
});

/** Legacy inbound URL — permanently redirects to /demo-report (see next.config redirects). */
export default function SampleReportPage() {
  permanentRedirect("/demo-report");
}
