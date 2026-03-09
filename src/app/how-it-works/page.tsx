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
              HairAudit delivers independent, evidence-based forensic review through a clear, step-by-step
              process. We assess hair transplant quality using structured criteria and clinical evidence.
              Our methodology is supported by{" "}
              <Link href="/follicle-intelligence" className="text-amber-600 hover:text-amber-500 font-medium">
                Follicle Intelligence
              </Link>
              . Clinics can participate and be recognised through validated transparency and
              documentation contribution —{" "}
              <Link href="/verified-surgeon-program" className="text-amber-600 hover:text-amber-500 font-medium">
                learn about the Verified Program
              </Link>
              .
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/verified-surgeon-program"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border-2 border-amber-500/50 text-amber-700 font-medium hover:bg-amber-50 transition-colors text-sm"
              >
                Learn About the Verified Program
              </Link>
              <Link
                href="/clinics"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border-2 border-slate-300 text-slate-700 font-medium hover:border-slate-400 hover:bg-slate-50 transition-colors text-sm"
              >
                Explore Participating Clinics
              </Link>
            </div>
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
            <div className="mt-10 sm:mt-12 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors min-h-[44px]"
              >
                Get started
              </Link>
              <Link
                href="/clinics"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors min-h-[44px]"
              >
                Explore Participating Clinics
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
