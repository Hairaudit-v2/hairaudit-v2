import ScrollReveal from "@/components/ui/ScrollReveal";
import { PLATFORM } from "@/lib/constants/platform";

const FLOW_STEPS = [
  { label: "Upload", description: "Submit your case and images" },
  { label: "Analyse", description: "Structured assessment of donor, graft, and recipient" },
  { label: "Score", description: "Evidence-based quality and consistency metrics" },
  { label: "Benchmark", description: "Compared against global standards and norms" },
  { label: "Improve", description: "Data feeds training and system refinement" },
] as const;

export default function SurgicalIntelligenceEcosystemSection() {
  return (
    <section
      aria-labelledby="surgical-intelligence-heading"
      className="relative px-4 sm:px-6 py-16 sm:py-20 border-t border-white/5"
    >
      <div className="max-w-5xl mx-auto">
        <ScrollReveal>
          <p className="text-xs uppercase tracking-widest text-slate-500 font-medium">
            Surgical intelligence ecosystem
          </p>
          <h2
            id="surgical-intelligence-heading"
            className="mt-2 text-2xl sm:text-3xl font-bold text-white"
          >
            Where your surgery meets the system
          </h2>
          <p className="mt-4 text-slate-300 max-w-3xl leading-relaxed">
            Every case submitted to HairAudit is analysed, scored, and benchmarked against a global
            dataset. Results are aggregated anonymously to improve methodology, calibrate scores, and
            strengthen the system — so each new case benefits from the data that came before it.
          </p>
          <p className="mt-3 text-slate-400 text-sm max-w-3xl">
            Your case contributes to a feedback loop: structured outcomes feed back into training
            and improvement, raising the bar for transparency and consistency across the field.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.05}>
          <p className="mt-8 text-xs uppercase tracking-wider text-slate-500 font-semibold">
            The pathway
          </p>
          <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-3 lg:gap-2 lg:flex-nowrap items-stretch lg:items-center">
            {FLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center gap-3 lg:gap-2 flex-1 lg:flex-none min-w-0">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 flex-1 lg:flex-none lg:min-w-0">
                  <p className="text-sm font-semibold text-amber-200">{step.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{step.description}</p>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <span className="text-slate-600 shrink-0 self-center" aria-hidden>
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <h3 className="mt-12 text-xl sm:text-2xl font-bold text-white">
            Global ranking, consistency, and transparency
          </h3>
          <div className="mt-6 grid sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wider text-amber-300/90 font-semibold">
                Global ranking
              </p>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Clinics and surgeons are evaluated against a shared, evidence-based framework.
                Rankings reflect measurable quality and outcomes, not marketing.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wider text-amber-300/90 font-semibold">
                Performance consistency
              </p>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Scores are calibrated across cases and reviewers. The system tracks consistency over
                time so that high standards are maintained and outliers are identified.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wider text-amber-300/90 font-semibold">
                Transparency
              </p>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Methodology, rubrics, and scoring criteria are documented. Patients and
                professionals can see how outcomes are assessed and how data is used.
              </p>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <div className="mt-10 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 sm:p-6">
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              <strong className="text-white font-semibold">HairAudit</strong> is powered by{" "}
              <a
                href={PLATFORM.FI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-300 hover:text-amber-200 underline underline-offset-2 transition-colors"
              >
                Follicle Intelligence
              </a>{" "}
              and connected to IIOHR training. The same structured, data-driven assessment that
              supports your review feeds into global benchmarks and professional education.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
