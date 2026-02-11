import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Link from "next/link";

const faqs = [
  {
    q: "What does HairAudit do?",
    a: "HairAudit provides independent, evidence-based audits of hair transplant procedures. We assess surgical quality, donor area integrity, graft handling, implantation accuracy, and likely growth outcomes.",
  },
  {
    q: "Does HairAudit perform hair transplants?",
    a: "No. HairAudit does not perform hair transplants and does not promote clinics, surgeons, or products. Our role is to deliver unbiased, independent evaluation.",
  },
  {
    q: "Who can submit a case?",
    a: "Both patients seeking clarity on their procedure and clinics or surgeons wanting to benchmark quality can submit cases for audit.",
  },
  {
    q: "Is my information kept confidential?",
    a: "Yes. All submissions are handled confidentially and never shared without consent.",
  },
  {
    q: "What does the audit report include?",
    a: "Reports include structured scoring, donor quality assessment, analysis of surgical technique, and actionable findings. Each case is assessed using defined criteria for consistency and transparency.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 px-4 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Frequently Asked Questions
          </h1>
          <div className="mt-12 space-y-6">
            {faqs.map(({ q, a }) => (
              <div key={q} className="border-b border-slate-200 pb-6">
                <h2 className="text-lg font-semibold text-slate-900">{q}</h2>
                <p className="mt-2 text-slate-600">{a}</p>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
            >
              Request an Audit
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
