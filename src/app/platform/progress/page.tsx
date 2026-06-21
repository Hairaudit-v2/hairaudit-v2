import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import PlatformProgressPage from "@/components/platform/PlatformProgressPage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Platform Engineering Progress | HairAudit Intelligence Infrastructure",
  description:
    "Live HairAudit engineering progress: intelligence module completion, patient experience improvements, and public changelog for independent hair restoration review infrastructure.",
  pathname: "/platform/progress",
});

export default function PlatformProgressRoutePage() {
  return (
    <HairAuditFiMarketingShell>
      <PlatformProgressPage />
    </HairAuditFiMarketingShell>
  );
}
