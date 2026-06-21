import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import FaqConversionFooter from "@/components/marketing/FaqConversionFooter";
import PublicMarketingFaqList from "@/components/marketing/PublicMarketingFaqList";
import PublicMarketingHero from "@/components/marketing/PublicMarketingHero";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import FaqPageSchema from "@/components/seo/FaqPageSchema";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { Section } from "@/packages/ui";

export const metadata = createPageMetadata({
  title: "HairAudit FAQ | Process, Privacy & Clinical Intelligence Reports | HairAudit",
  description:
    "HairAudit FAQ—process, privacy, confidence-aware reporting, and what Clinical Intelligence Reports include. Long-form patient education lives in the guides hub.",
  pathname: "/faq",
});

const faqs = [
  {
    question: "What does HairAudit do?",
    answer:
      "HairAudit provides independent, evidence-led analysis of hair transplant procedures. We review donor safety, recipient planning, procedural concerns, and documentation quality using structured methodology and visual evidence. We do not perform procedures or promote clinics.",
  },
  {
    question: "Does HairAudit perform hair transplants?",
    answer:
      "No. HairAudit does not perform hair transplants and does not promote clinics, surgeons, or products. Our role is independent analysis and patient protection only.",
  },
  {
    question: "Does HairAudit replace medical advice from my doctor?",
    answer:
      "No. HairAudit supports informed decision-making with structured documentation and plain-language findings. It does not replace in-person examination, diagnosis, or treatment plans from your treating clinician.",
  },
  {
    question: "How do confidence scores work?",
    answer:
      "Confidence reflects how complete the evidence is for each part of the analysis. More complete documentation supports higher confidence. Lower confidence means conclusions are more limited—not necessarily a negative finding. Reports state where evidence is strong and where it is thin.",
  },
  {
    question: "What happens if I do not have full documentation?",
    answer:
      "You can still begin your HairAudit. We analyze what you provide and note missing photos or details. The report explains what was reviewed and where evidence limits conclusions. Clinic or doctor contribution can sometimes improve completeness later.",
  },
  {
    question: "How is HairAudit different from asking the clinic for an opinion?",
    answer:
      "A clinic opinion comes from the same provider whose work is being evaluated. HairAudit is an independent third party with no financial interest in the outcome. Analysis uses defined criteria and consistent review standards—not provider self-review.",
  },
  {
    question: "Can HairAudit help me understand corrective options?",
    answer:
      "Yes. The Clinical Intelligence Report can help structure thinking about next steps—density, design, donor capacity, and timeline fit. We do not prescribe treatments or recommend specific surgeons; we provide independent context you and your clinician can use.",
  },
  {
    question: "Can a report be useful if I need independent documentation of concerns?",
    answer:
      "A report can document what the evidence showed and how conclusions were reached. It may help structure conversations with a provider or other advisers. We do not give legal advice or guarantee outcomes.",
  },
  {
    question: "How does HairAudit compare cases or determine benchmark quality?",
    answer:
      "We use fixed scoring domains and criteria so cases are reviewed consistently. Benchmark quality reflects how well a case meets defined standards across planning, donor preservation, graft handling, implantation, and documentation—not comparisons to other patients by name.",
  },
  {
    question: "Who can start a HairAudit?",
    answer:
      "Patients can begin independent analysis today through the secure upload flow. Professional participation has a separate pathway for clinics, surgeons, and expert stakeholders.",
  },
  {
    question: "Is my information kept confidential?",
    answer: "Yes. Submissions are handled confidentially and are not shared without your consent.",
  },
  {
    question: "What does the Clinical Intelligence Report include?",
    answer:
      "Reports include structured findings by domain, confidence where relevant, donor and recipient analysis, procedural concerns visible in photos, and practical next-step context. Each case uses the same defined criteria for consistency.",
  },
];

export default function FAQPage() {
  return (
    <HairAuditFiMarketingShell>
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "HairAudit FAQ", pathname: "/faq" },
        ]}
      />
      <FaqPageSchema faqs={faqs.map(({ question, answer }) => ({ question, answer }))} />

      <main id="main-content" className="relative flex-1 pb-16">
        <PublicMarketingHero
          badge="FAQ"
          title="HairAudit FAQ"
          description="Process, privacy, Clinical Intelligence Reports, and pathways—for patients seeking independent analysis and for clinics or professionals building transparency records."
        />

        <Section className="border-t border-border/30">
          <div className="mx-auto max-w-3xl">
            <p className="rounded-2xl border border-amber-400/25 bg-amber-400/5 px-5 py-4 text-sm leading-relaxed text-foreground/90">
              HairAudit supports informed decision-making but does not replace medical advice. If you have severe pain,
              fever, spreading infection, or other emergency signs, seek local urgent care or emergency services.
            </p>
            <div className="mt-10">
              <PublicMarketingFaqList faqs={faqs} />
            </div>
            <FaqConversionFooter />
          </div>
        </Section>
      </main>
    </HairAuditFiMarketingShell>
  );
}
