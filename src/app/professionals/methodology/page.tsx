import ProfessionalsShell from "@/components/professionals/ProfessionalsShell";

export default function ProfessionalsMethodologyPage() {
  return (
    <ProfessionalsShell
      currentPath="/professionals/methodology"
      title="Methodology"
      intro="HairAudit uses a structured review model designed for consistency across case submissions, with AI-assisted analysis and expert-reviewed interpretation."
    >
      <div className="space-y-6 text-slate-300">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Structured review model</h2>
          <p className="mt-3">
            Each case follows a defined sequence: evidence intake, visual analysis, domain scoring,
            confidence interpretation, and controlled output finalisation.
          </p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Assessment principles</h2>
          <ul className="mt-3 space-y-2">
            <li>- standardized scoring domains</li>
            <li>- documented evidence traceability</li>
            <li>- confidence-aware interpretation</li>
            <li>- transparent distinction between quality concerns and evidence limitations</li>
          </ul>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">AI-assisted, expert-reviewed</h2>
          <p className="mt-3">
            AI is used to support consistency and structured analysis. Final outputs are reviewed
            within a controlled process where applicable.
          </p>
        </section>
      </div>
    </ProfessionalsShell>
  );
}
