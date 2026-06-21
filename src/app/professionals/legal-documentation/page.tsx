import ProfessionalsShell from "@/components/professionals/ProfessionalsShell";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Legal Documentation | HairAudit",
  description:
    "Understand HairAudit legal documentation context, evidence limits, and structured reporting standards.",
  pathname: "/professionals/legal-documentation",
});

export default function LegalDocumentationPage() {
  return (
    <ProfessionalsShell
      currentPath="/professionals/legal-documentation"
      title="Legal Documentation"
      intro="HairAudit reports are structured, evidence-based documents that may assist clarification in dispute or second-opinion contexts."
    >
      <div className="space-y-6 text-muted-foreground">
        <section className="rounded-2xl border border-border/50 bg-card/70 shadow-fi-panel p-6">
          <h2 className="text-xl font-semibold text-foreground">Use in dispute clarification</h2>
          <p className="mt-3">
            Reports may help organize case evidence, identify documented concerns, and provide
            structured interpretation for advisors and expert reviewers.
          </p>
        </section>
        <section className="rounded-2xl border border-border/50 bg-card/70 shadow-fi-panel p-6">
          <h2 className="text-xl font-semibold text-foreground">Important limitation</h2>
          <p className="mt-3">
            HairAudit outputs are not automatic legal determinations. They are structured reviews
            based on the evidence submitted and the limits of that evidence.
          </p>
        </section>
        <section className="rounded-2xl border border-border/50 bg-card/70 shadow-fi-panel p-6">
          <h2 className="text-xl font-semibold text-foreground">Documentation standards</h2>
          <p className="mt-3">
            Reports prioritize traceable observations, confidence-aware interpretation, and clear
            separation between evidence-supported findings and evidence limitations.
          </p>
        </section>
      </div>
    </ProfessionalsShell>
  );
}
