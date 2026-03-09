import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import VerifiedSurgeonTransparencyLanding from "@/components/landing/VerifiedSurgeonTransparencyLanding";

export default function VerifiedSurgeonProgramPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <VerifiedSurgeonTransparencyLanding />
      <SiteFooter />
    </div>
  );
}
