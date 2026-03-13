import ProfessionalsShell from "@/components/professionals/ProfessionalsShell";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Scoring Framework | HairAudit",
  description:
    "Understand HairAudit's scoring domains and evidence-led framework for consistent professional review.",
  pathname: "/professionals/scoring-framework",
});

const domains = [
  {
    name: "Surgical Planning",
    patient: "How the surgery plan matched your pattern and goals.",
    technical:
      "Evaluation of planning logic, recipient zoning, and preoperative design coherence against available context.",
  },
  {
    name: "Donor Preservation",
    patient: "How safely hair was removed from the donor area.",
    technical:
      "Evaluation of extraction technique, donor distribution, punch trauma indicators, and overharvesting risk.",
  },
  {
    name: "Graft Viability",
    patient: "How well graft handling appears to support growth.",
    technical:
      "Review of viability-related handling signals, storage context where available, and compatibility with observed progression.",
  },
  {
    name: "Implantation Consistency",
    patient: "How accurately the hairs were implanted.",
    technical:
      "Assessment of placement pattern, directionality, angulation consistency, and recipient-zone execution.",
  },
  {
    name: "Density Integrity",
    patient: "How even and natural the density pattern looks.",
    technical:
      "Evaluation of density distribution, local variation, and pattern integrity relative to documented views.",
  },
];

export default function ScoringFrameworkPage() {
  return (
    <ProfessionalsShell
      currentPath="/professionals/scoring-framework"
      title="Scoring Framework"
      intro="HairAudit applies structured scoring domains to increase consistency across cases and improve interpretation clarity."
    >
      <div className="space-y-4">
        {domains.map((domain) => (
          <section key={domain.name} className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">{domain.name}</h2>
            <p className="mt-3 text-sm text-slate-400">
              <span className="font-semibold text-slate-300">Patient explanation:</span> {domain.patient}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              <span className="font-semibold text-slate-300">Technical explanation:</span> {domain.technical}
            </p>
          </section>
        ))}
      </div>
    </ProfessionalsShell>
  );
}
