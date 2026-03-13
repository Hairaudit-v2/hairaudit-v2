import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Link from "next/link";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "FAQ | HairAudit",
  description:
    "Read common questions about HairAudit reviews, confidence interpretation, privacy, and participation.",
  pathname: "/faq",
});

const faqs = [
  {
    q: "What does HairAudit do?",
    a: "HairAudit provides independent, evidence-based forensic audits of hair transplant procedures. We assess surgical quality, donor area integrity, graft handling, implantation accuracy, and outcome potential using structured scoring and visual evidence analysis. We do not perform procedures or promote clinics.",
  },
  {
    q: "Does HairAudit perform hair transplants?",
    a: "No. HairAudit does not perform hair transplants and does not promote clinics, surgeons, or products. Our role is to deliver unbiased, independent evaluation only.",
  },
  {
    q: "How do confidence scores work?",
    a: "Confidence reflects how complete the evidence is for each part of the audit. More complete documentation (e.g. pre-op, donor, recipient, post-op photos and key details) supports higher confidence. Lower confidence does not mean a negative finding — it means we are more limited in what we can conclude. The report states where evidence is strong and where it is limited.",
  },
  {
    q: "What happens if I do not have full documentation?",
    a: "You can still submit. We analyse what you provide and score confidence by domain. Missing photos or details will be noted and may limit the strength of conclusions in those areas. The report will state what was assessed and what could not be assessed due to missing evidence. In some cases, clinic or doctor contribution can later improve evidence completeness.",
  },
  {
    q: "How is HairAudit different from asking the clinic for an opinion?",
    a: "A clinic opinion is from the same provider whose work is being evaluated. HairAudit is an independent third party with no financial interest in the outcome. Our audit uses defined criteria and benchmark methodology, not provider self-assessment. That independence can provide a separate reference point for understanding quality and outcome.",
  },
  {
    q: "Can HairAudit help me understand corrective options?",
    a: "Yes. The report can help structure your thinking about next steps. It identifies strengths and limitations in the procedure and may suggest areas that could be relevant to corrective planning (e.g. density, design, donor capacity). We do not give medical advice or recommend specific treatments; we provide independent forensic context that you and your clinician can use in decisions.",
  },
  {
    q: "Can an audit report be useful if I need independent documentation of concerns?",
    a: "An audit report can provide independent documentation of what was assessed and what the evidence showed. It may assist in structuring a conversation with a provider or in providing context if you pursue other avenues. We do not give legal advice or guarantee any particular outcome; we deliver a clear, evidence-based record of our analysis that you can use as you see fit.",
  },
  {
    q: "How does HairAudit compare cases or determine benchmark quality?",
    a: "We use a fixed set of scoring domains and criteria so that cases are assessed consistently. Benchmark quality is determined by how well a case meets defined standards across those domains (e.g. planning, donor preservation, graft handling, implantation, documentation). We do not compare your case to other patients by name; we compare it to the same clinical and evidence standards we apply to all audits.",
  },
  {
    q: "Who can submit a case?",
    a: "Patients can request independent review today through the request flow. Professional participation has a separate pathway for clinics, surgeons, partners, and expert stakeholders.",
  },
  {
    q: "Is my information kept confidential?",
    a: "Yes. All submissions are handled confidentially and never shared without your consent.",
  },
  {
    q: "What does the audit report include?",
    a: "Reports include a structured scorecard by domain, confidence where relevant, donor and recipient analysis, findings on technique and outcome potential, and corrective-planning context where applicable. Each case is assessed using the same defined criteria for consistency and transparency.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
      </div>
      <SiteHeader />

      <main className="relative flex-1 px-4 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-slate-300">
            Clear answers for patients and professionals about HairAudit process, confidence, privacy,
            and participation pathways.
          </p>
          <div className="mt-12 space-y-6">
            {faqs.map(({ q, a }) => (
              <div key={q} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-semibold text-white">{q}</h2>
                <p className="mt-2 text-slate-300">{a}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col sm:flex-row gap-3">
            <Link
              href="/request-review"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
            >
              Request Review
            </Link>
            <Link
              href="/professionals"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
            >
              For Professionals
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
