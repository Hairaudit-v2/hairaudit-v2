import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const steps = [
  { step: 1, title: "Submit Case", desc: "Create an account and submit your case with photos and relevant details. All submissions are handled confidentially." },
  { step: 2, title: "Review & Analysis", desc: "Our team performs a structured clinical assessment of surgical technique, donor area, graft handling, and implantation." },
  { step: 3, title: "Structured Scoring", desc: "Each case is assessed using defined criteria to ensure consistency, transparency, and medically relevant conclusions." },
  { step: 4, title: "Audit Report", desc: "You receive a comprehensive report with findings, scores, and objective analysis of surgical quality.", hasImage: true },
  { step: 5, title: "Guidance & Next Steps", desc: "Expert guidance for successful outcomes. We help you understand the findings and what they mean for your situation." },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 px-4 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            How it works
          </h1>
          <p className="mt-4 text-slate-600">
            HairAudit follows a clear, step-by-step audit process designed to objectively assess hair
            transplant quality using clinical evidence and structured review criteria.
          </p>
          <div className="mt-12 space-y-8">
            {steps.map(({ step, title, desc, hasImage }) => (
              <div key={step} className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  {step}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
                  <p className="mt-2 text-slate-600">{desc}</p>
                  {hasImage && (
                    <div className="mt-4 rounded-xl overflow-hidden border border-slate-200">
                      <Image
                        src="/Images/patient-report-sample.jpg"
                        alt="Sample audit report"
                        width={800}
                        height={500}
                        className="w-full max-w-md h-auto"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
