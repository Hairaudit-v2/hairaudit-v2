import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import VerifiedSurgeonTransparencyLanding from "@/components/landing/VerifiedSurgeonTransparencyLanding";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Verified Surgeon Program | HairAudit",
  description:
    "Explore the HairAudit transparency and recognition framework for clinics, surgeons, and participation stakeholders.",
  pathname: "/verified-surgeon-program",
});

export default function VerifiedSurgeonProgramPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <VerifiedSurgeonTransparencyLanding />
      <SiteFooter />
    </div>
  );
}
