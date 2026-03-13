import Link from "next/link";
import ProfessionalsShell from "@/components/professionals/ProfessionalsShell";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "For Professionals | HairAudit",
  description:
    "Review HairAudit standards for methodology, scoring, evidence quality, participation, and documentation frameworks.",
  pathname: "/professionals",
});

const cards = [
  { href: "/professionals/apply", title: "Apply for Participation", desc: "Dedicated intake for clinics, surgeons, partners, auditors, and expert stakeholders." },
  { href: "/professionals/methodology", title: "Methodology", desc: "Structured review model, evidence weighting logic, and standardized assessment principles." },
  { href: "/professionals/scoring-framework", title: "Scoring Framework", desc: "Domain definitions, dual patient/technical explanations, and scoring clarity." },
  { href: "/professionals/evidence-standards", title: "Evidence Standards", desc: "Image requirements, sufficiency criteria, confidence grading, and limitations." },
  { href: "/professionals/clinical-participation", title: "Clinical Participation", desc: "Voluntary participation pathways and quality-improvement context for clinics." },
  { href: "/professionals/legal-documentation", title: "Legal Documentation", desc: "Objective documentation principles for dispute clarification and structured review." },
  { href: "/professionals/auditor-standards", title: "Auditor Standards", desc: "Reviewer qualifications, consistency controls, and oversight processes." },
];

export default function ProfessionalsPage() {
  return (
    <ProfessionalsShell
      currentPath="/professionals"
      title="HairAudit Professional Standards"
      intro="HairAudit combines structured image review, scoring logic, evidence standards, and expert interpretation to assess hair transplant outcomes with consistency and clarity."
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card, i) => (
          <ScrollReveal key={card.href} delay={i * 0.04}>
            <Link
              href={card.href}
              className="group block rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-white/20 transition-colors h-full"
            >
              <h2 className="text-lg font-semibold text-white group-hover:text-amber-300 transition-colors">
                {card.title}
              </h2>
              <p className="mt-3 text-sm text-slate-400">{card.desc}</p>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </ProfessionalsShell>
  );
}
