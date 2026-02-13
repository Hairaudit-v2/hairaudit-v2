import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import ServiceCard from "@/components/ui/ServiceCard";

const services = [
  {
    title: "Patient Hair Transplant Audit",
    shortDesc: "Independent review of your procedure with donor area, graft placement, and growth analysis.",
    fullDesc: "Our most comprehensive audit for patients. We analyse your submitted case — pre-op, donor, recipient, and post-op photos — against clinical standards. You receive a structured report with scores, findings, and guidance on what to expect.",
    bullets: [
      "Donor area integrity and extraction patterns",
      "Graft placement and implantation quality",
      "Hairline design and density assessment",
      "Likely growth performance and outcome expectations",
    ],
    image: { src: "/images/patient-report-sample.jpg", alt: "Patient audit report sample" },
  },
  {
    title: "Post-Procedure Outcome Analysis",
    shortDesc: "Assessment of surgical outcomes to identify strengths, risks, and growth factors.",
    fullDesc: "Focused on outcomes rather than technique alone. We evaluate healing, graft survival indicators, and factors that may influence final density and aesthetic result.",
    bullets: [
      "Healing and scarring assessment",
      "Graft survival indicators",
      "Density and coverage potential",
      "Follow-up and corrective planning",
    ],
    image: { src: "/images/patient-feedback.jpg", alt: "Post-procedure outcome analysis" },
  },
  {
    title: "Donor Area & Extraction Review",
    shortDesc: "Detailed analysis of donor management, extraction patterns, and potential over-harvesting.",
    fullDesc: "A specialised audit concentrating on the donor zone. We assess extraction spacing, punch size impact, transection rates, and long-term donor sustainability.",
    bullets: [
      "Extraction patterns and spacing",
      "Donor depletion and over-harvesting risk",
      "Transection and graft quality markers",
      "Future procedure capacity",
    ],
    image: { src: "/images/donor-area.jpg", alt: "Donor area assessment" },
  },
  {
    title: "Implantation & Hairline Design Review",
    shortDesc: "Evaluation of graft angles, density distribution, and hairline design quality.",
    fullDesc: "Focused on recipient-side quality. We review incision angles, density distribution, hairline design, and overall aesthetic potential.",
    bullets: [
      "Incision angles and natural appearance",
      "Density and distribution uniformity",
      "Hairline design and recession handling",
      "Long-term aesthetic outcome",
    ],
    image: { src: "/images/hairline-implantation.jpg", alt: "Hairline and implantation review" },
  },
  {
    title: "Clinic & Surgeon Benchmark Audits",
    shortDesc: "Structured audits for clinics and surgeons seeking objective quality benchmarking.",
    fullDesc: "For practices and surgeons who want independent benchmarking. We provide structured audits of sample cases to support quality improvement and patient transparency.",
    bullets: [
      "Benchmark scores against audit criteria",
      "Strengths and improvement areas",
      "Consistency across case samples",
      "Optional ongoing audit programs",
    ],
    images: [
      { src: "/images/clinic-feedback.jpg", alt: "Clinic audit sample" },
      { src: "/images/doctors-feedback.jpg", alt: "Surgeon audit sample" },
    ],
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-slate-900 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <ScrollReveal delay={0}>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                Our services
              </h1>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="mt-4 sm:mt-6 text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
                Each audit focuses on surgical quality, donor area management, graft handling,
                implantation accuracy, and expected growth outcomes.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <p className="mt-2 text-slate-400 text-sm sm:text-base">
                HairAudit does not perform hair transplants and does not promote clinics or practitioners.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Sample report */}
        <section className="px-4 sm:px-6 py-12 sm:py-16 bg-white">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
                What you&apos;ll receive
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                Each audit delivers a comprehensive report with structured findings, scores, and expert analysis.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <div className="mt-8 sm:mt-10 max-w-[410px] mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-xl">
                <Image
                  src="/images/patient-report-sample.jpg"
                  alt="Sample patient audit report"
                  width={410}
                  height={273}
                  className="w-full h-auto"
                />
                <p className="p-4 sm:p-6 text-sm text-slate-500 bg-slate-50">
                  Sample patient audit report
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Service cards */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
                Explore our audit services
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                Click a card to reveal more details about each service.
              </p>
            </ScrollReveal>
            <div className="mt-10 sm:mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {services.map((s, i) => (
                <ScrollReveal key={s.title} delay={i * 0.05}>
                  <ServiceCard
                    title={s.title}
                    shortDesc={s.shortDesc}
                    fullDesc={s.fullDesc}
                    bullets={s.bullets}
                    image={s.image}
                    images={s.images}
                  />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 sm:px-6 py-12 sm:py-16 bg-slate-900 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold">Ready to get started?</h2>
              <p className="mt-4 text-slate-300 text-sm sm:text-base">
                Submit your case for an independent, evidence-based audit.
              </p>
              <Link
                href="/signup"
                className="mt-6 sm:mt-8 inline-flex items-center justify-center px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors text-base"
              >
                Submit your case
              </Link>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
