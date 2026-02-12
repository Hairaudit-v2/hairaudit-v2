import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { StepIcons } from "@/components/ui/StepIcons";

const steps = [
  { step: 1, title: "Submit Case", desc: "Create an account and submit your case with photos and relevant details. All submissions are handled confidentially.", icon: "submit" as const },
  { step: 2, title: "Review & Analysis", desc: "Our team performs a structured clinical assessment of surgical technique, donor area, graft handling, and implantation.", icon: "review" as const },
  { step: 3, title: "Structured Scoring", desc: "Each case is assessed using defined criteria to ensure consistency, transparency, and medically relevant conclusions.", icon: "scoring" as const },
  { step: 4, title: "Audit Report", desc: "You receive a comprehensive report with findings, scores, and objective analysis of surgical quality.", icon: "report" as const },
  { step: 5, title: "Guidance & Next Steps", desc: "Expert guidance for successful outcomes. We help you understand the findings and what they mean for your situation.", icon: "guidance" as const },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 px-4 sm:px-6 py-12 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
              How it works
            </h1>
            <p className="mt-4 text-slate-600 text-sm sm:text-base">
              HairAudit follows a clear, step-by-step audit process designed to objectively assess hair
              transplant quality using clinical evidence and structured review criteria.
            </p>
          </ScrollReveal>
          <div className="mt-10 sm:mt-12 space-y-8 sm:space-y-10">
            {steps.map(({ step, title, desc, icon }, i) => (
              <ScrollReveal key={step} delay={i * 0.05}>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                    {StepIcons[icon]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
                    <p className="mt-2 text-slate-600 text-sm sm:text-base">{desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal delay={0.2}>
            <div className="mt-10 sm:mt-12">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors min-h-[44px]"
              >
                Get started
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
