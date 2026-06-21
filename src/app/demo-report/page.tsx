import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import DemoReportPageContent from "./DemoReportPageContent";

export const metadata = createPageMetadata({
  title: "Clinical Intelligence Report Preview | HairAudit",
  description:
    "Preview how HairAudit evaluates donor quality, progression risk, recipient viability, and planning concerns. Sample content only—start your free HairAudit when ready.",
  pathname: "/demo-report",
});

export default function DemoReportPage() {
  return (
    <>
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "Clinical Intelligence Report Preview", pathname: "/demo-report" },
        ]}
      />
      <DemoReportPageContent />
    </>
  );
}
