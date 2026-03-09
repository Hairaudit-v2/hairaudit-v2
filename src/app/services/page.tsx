import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import ServiceCard, { type ServiceCardLayer } from "@/components/ui/ServiceCard";

const services: Array<{
  title: string;
  shortDesc: string;
  image?: { src: string; alt: string };
  images?: { src: string; alt: string }[];
  layers: ServiceCardLayer;
  cta?: string;
  href?: string;
}> = [
  {
    title: "Patient Hair Transplant Audit",
    shortDesc: "Independent forensic review of your procedure: donor, graft handling, implantation, and outcome potential.",
    image: { src: "/images/patient-report-sample.jpg", alt: "Patient audit report sample" },
    layers: {
      whoItIsFor: "Patients seeking independent review of a transplant result or concern.",
      whatWeAnalyse: [
        "Donor extraction pattern and spacing",
        "Implantation quality and density distribution",
        "Hairline design and recession handling",
        "Graft handling and viability signals",
        "Density and healing evidence from your photos",
      ],
      whatYouReceive: [
        "Forensic audit report with structured scorecard",
        "Visual evidence analysis across scoring domains",
        "Corrective planning insights where relevant",
        "Clear next-step guidance based on findings",
      ],
      whyItMatters:
        "Helps you understand whether the outcome aligns with expected surgical standards and what next step — if any — may be justified.",
    },
    cta: "Request an audit",
  },
  {
    title: "Post-Procedure Outcome Analysis",
    shortDesc: "Evidence-based assessment of healing, graft survival signals, and outcome potential.",
    image: { src: "/images/patient-feedback.jpg", alt: "Post-procedure outcome analysis" },
    layers: {
      whoItIsFor: "Patients who want to understand how their result is tracking and what factors may affect final outcome.",
      whatWeAnalyse: [
        "Healing and scarring indicators",
        "Graft survival and retention signals",
        "Density and coverage progression",
        "Factors that may limit or support final result",
      ],
      whatYouReceive: [
        "Outcome-focused forensic report",
        "Structured assessment of healing and survival evidence",
        "Density and aesthetic potential assessment",
        "Follow-up and corrective planning where relevant",
      ],
      whyItMatters:
        "Helps you gauge whether the result is on track, what may be affecting it, and whether further intervention or reassurance is appropriate.",
    },
    cta: "Request an audit",
  },
  {
    title: "Donor Area & Extraction Review",
    shortDesc: "Focused forensic review of donor zone integrity, extraction patterns, and long-term sustainability.",
    image: { src: "/images/donor-area.jpg", alt: "Donor area assessment" },
    layers: {
      whoItIsFor: "Patients or referring clinicians who need a clear view of donor management and future capacity.",
      whatWeAnalyse: [
        "Extraction pattern and spacing",
        "Punch impact and transection risk markers",
        "Donor depletion and over-harvesting risk",
        "Graft quality and future procedure capacity",
      ],
      whatYouReceive: [
        "Donor-focused forensic report",
        "Visual evidence analysis of extraction and donor zone",
        "Structured assessment of sustainability and risk",
        "Capacity and limitation summary",
      ],
      whyItMatters:
        "Helps you understand donor health, whether extraction was conservative and sustainable, and what future options remain.",
    },
    cta: "Request an audit",
  },
  {
    title: "Implantation & Hairline Design Review",
    shortDesc: "Recipient-side forensic review: angles, density, hairline design, and aesthetic potential.",
    image: { src: "/images/hairline-implantation.jpg", alt: "Hairline and implantation review" },
    layers: {
      whoItIsFor: "Patients focused on recipient quality, hairline design, and long-term aesthetic outcome.",
      whatWeAnalyse: [
        "Incision angles and natural appearance",
        "Density and distribution uniformity",
        "Hairline design and recession handling",
        "Aesthetic and growth potential",
      ],
      whatYouReceive: [
        "Recipient-side forensic report",
        "Visual evidence analysis of implantation and hairline",
        "Structured scorecard for design and density",
        "Insight into likely aesthetic outcome",
      ],
      whyItMatters:
        "Helps you understand whether implantation and design meet expected standards and what to expect for naturalness and coverage.",
    },
    cta: "Request an audit",
  },
  {
    title: "Clinic & Surgeon Benchmark Audits",
    shortDesc: "Structured external review of documented case performance for transparency and recognition readiness.",
    images: [
      { src: "/images/clinic-feedback.jpg", alt: "Clinic audit sample" },
      { src: "/images/doctors-feedback.jpg", alt: "Surgeon audit sample" },
    ],
    layers: {
      whoItIsFor: "Clinics and surgeons seeking structured external review of documented case performance.",
      whatWeAnalyse: [
        "Planning and documentation quality",
        "Donor preservation and extraction discipline",
        "Graft viability chain and handling",
        "Implantation consistency and hairline design",
        "Documentation integrity for benchmark eligibility",
      ],
      whatYouReceive: [
        "Benchmark-oriented case review and scorecard",
        "Transparency contribution impact on recognition",
        "Recognition-readiness and next-milestone insight",
        "Structured feedback for quality improvement",
      ],
      whyItMatters:
        "Helps clinics strengthen transparency, understand benchmark readiness, and support evidence-based recognition in the HairAudit ecosystem.",
    },
    cta: "Learn about participation",
    href: "/verified-surgeon-program",
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
                Forensic audit services
              </h1>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="mt-4 sm:mt-6 text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
                Independent, evidence-based forensic review by type: patient audits, outcome analysis,
                donor and recipient reviews, and clinic benchmark audits.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <p className="mt-2 text-slate-400 text-sm sm:text-base">
                HairAudit does not perform procedures or promote clinics. Methodology supported by{" "}
                <Link href="/follicle-intelligence" className="text-amber-400 hover:text-amber-300 font-medium">
                  Follicle Intelligence
                </Link>
                .
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Sample report */}
        <section className="px-4 sm:px-6 py-12 sm:py-16 bg-white">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
                What you receive
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                Every audit produces a forensic report: structured scorecard, visual evidence analysis, and clear deliverables. Patient reports look like this.
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
                  Sample patient forensic report
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
                Audit types and deliverables
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                Each service has a clear audience, scope, deliverable set, and decision impact. Expand a card for full detail.
              </p>
            </ScrollReveal>
            <div className="mt-10 sm:mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {services.map((s, i) => (
                <ScrollReveal key={s.title} delay={i * 0.05}>
                  <ServiceCard
                    title={s.title}
                    shortDesc={s.shortDesc}
                    layers={s.layers}
                    image={s.image}
                    images={s.images}
                    cta={s.cta}
                    href={s.href}
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
              <h2 className="text-2xl sm:text-3xl font-bold">Request a forensic audit</h2>
              <p className="mt-4 text-slate-300 text-sm sm:text-base">
                Submit your case for independent forensic review and a structured benchmark report.
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
