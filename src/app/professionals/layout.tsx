import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import ProfessionalPathwayRibbon from "@/components/marketing/ProfessionalPathwayRibbon";

export default function ProfessionalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HairAuditFiMarketingShell>
      <main id="main-content" className="relative flex-1 px-4 sm:px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl min-w-0 space-y-8">
          <ProfessionalPathwayRibbon variant="fi" />
          {children}
        </div>
      </main>
    </HairAuditFiMarketingShell>
  );
}
