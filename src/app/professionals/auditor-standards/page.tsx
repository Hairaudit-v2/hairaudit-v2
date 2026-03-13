import ProfessionalsShell from "@/components/professionals/ProfessionalsShell";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Auditor Standards | HairAudit",
  description:
    "Review HairAudit auditor standards, consistency controls, and oversight pathways for defensible outputs.",
  pathname: "/professionals/auditor-standards",
});

export default function AuditorStandardsPage() {
  return (
    <ProfessionalsShell
      currentPath="/professionals/auditor-standards"
      title="Auditor Standards"
      intro="Auditor standards focus on reviewer qualification, consistency controls, and oversight pathways to preserve output quality."
    >
      <div className="space-y-6 text-slate-300">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Reviewer qualification</h2>
          <p className="mt-3">
            Reviews are performed within a structured framework supported by expert interpretation
            and defined documentation expectations.
          </p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Consistency controls</h2>
          <p className="mt-3">
            Standardized domains, confidence logic, and evidence mapping are used to reduce
            interpretive drift and improve case-to-case comparability.
          </p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Escalation and oversight</h2>
          <p className="mt-3">
            Cases with complex evidence limitations or high material impact can be escalated within
            controlled review pathways to support defensibility.
          </p>
        </section>
      </div>
    </ProfessionalsShell>
  );
}
