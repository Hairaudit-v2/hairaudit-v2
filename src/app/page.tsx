// HairAudit marketing site (B12 migrated)
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import ServiceCard from "@/components/ui/ServiceCard";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-slate-900 text-white px-4 sm:px-6 py-12 sm:py-20 lg:py-24 relative overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/images/hero.jpg"
              alt=""
              fill
              className="object-cover opacity-30"
              priority
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-slate-900/80" />
          </div>
          <div className="relative max-w-4xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              Independent Hair Transplant Audits
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-slate-300">
              Evidence-based clinical review of surgical quality, technique, and outcomes
            </p>
            <p className="mt-6 text-slate-400 max-w-2xl mx-auto">
              HairAudit provides independent clinical audits of hair transplant and hair restoration
              procedures worldwide. We assess donor extraction quality, graft handling, implantation
              technique, hairline design, and likely growth outcomes using structured analysis and
              medical evidence.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
              >
                Request an Audit
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-slate-600 text-slate-200 font-semibold hover:border-amber-500 hover:text-amber-400 transition-colors"
              >
                How it works
              </Link>
            </div>
          </div>
        </section>

        {/* Sample Report Preview */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-white">
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
              <div className="mt-8 sm:mt-10 max-w-2xl mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
                <Image
                  src="/images/patient-report-sample.jpg"
                  alt="Sample patient audit report"
                  width={600}
                  height={400}
                  className="w-full h-auto"
                />
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Intro */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-white">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
                Objective, evidence-based clinical assessment
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="mt-6 text-slate-600 text-center text-sm sm:text-base">
                HairAudit was created to bring transparency, accountability, and clinical clarity to the
                hair restoration industry. We provide independent audits of hair transplant procedures
                by analysing surgical technique, donor area integrity, graft handling, implantation
                accuracy, and post-operative standards using structured medical review methods.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.15}>
              <p className="mt-4 text-slate-600 text-center text-sm sm:text-base">
                HairAudit does not perform hair transplants and does not promote clinics or surgeons.
                Our role is to deliver unbiased, evidence-based reporting that supports informed patient
                decisions, corrective planning, and continuous improvement across the industry.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="px-4 sm:px-6 py-12 sm:py-20 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
                Our services
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                Each audit focuses on surgical quality, donor area management, graft handling,
                implantation accuracy, and expected growth outcomes.
              </p>
            </ScrollReveal>
            <div className="mt-10 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <ScrollReveal delay={0}>
                <ServiceCard
                  title="Patient Hair Transplant Audit"
                  shortDesc="Independent review of your procedure with donor area, graft placement, and growth analysis."
                  fullDesc="Our most comprehensive audit for patients. We analyse your submitted case against clinical standards and deliver a structured report with scores and guidance."
                  bullets={["Donor area integrity", "Graft placement quality", "Hairline design", "Growth expectations"]}
                  image={{ src: "/images/patient-report-sample.jpg", alt: "Patient audit report sample" }}
                />
              </ScrollReveal>
              <ScrollReveal delay={0.05}>
                <ServiceCard
                  title="Post-Procedure Outcome Analysis"
                  shortDesc="Assessment of surgical outcomes and growth factors."
                  fullDesc="Focused on outcomes — healing, graft survival indicators, and factors influencing final density."
                  bullets={["Healing assessment", "Graft survival", "Density potential", "Follow-up planning"]}
                  image={{ src: "/images/patient-feedback.jpg", alt: "Post-procedure outcome analysis" }}
                />
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <ServiceCard
                  title="Donor Area & Extraction Review"
                  shortDesc="Analysis of extraction patterns and donor sustainability."
                  fullDesc="Specialised audit of the donor zone — extraction spacing, punch impact, and long-term sustainability."
                  bullets={["Extraction patterns", "Over-harvesting risk", "Graft quality", "Future capacity"]}
                  image={{ src: "/images/donor-area.jpg", alt: "Donor area assessment" }}
                />
              </ScrollReveal>
              <ScrollReveal delay={0.15}>
                <ServiceCard
                  title="Implantation & Hairline Design Review"
                  shortDesc="Evaluation of graft angles, density, and hairline design."
                  fullDesc="Recipient-side quality review — incision angles, density distribution, and aesthetic potential."
                  bullets={["Incision angles", "Density distribution", "Hairline design", "Aesthetic outcome"]}
                  image={{ src: "/images/hairline-implantation.jpg", alt: "Hairline and implantation review" }}
                />
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <ServiceCard
                  title="Clinic & Surgeon Benchmark Audits"
                  shortDesc="Structured audits for clinics and surgeons seeking benchmarking."
                  fullDesc="For practices wanting independent benchmarking. We provide structured audits to support quality improvement."
                  bullets={["Benchmark scores", "Improvement areas", "Case consistency", "Ongoing programs"]}
                  images={[
                    { src: "/images/clinic-feedback.jpg", alt: "Clinic audit" },
                    { src: "/images/doctors-feedback.jpg", alt: "Surgeon audit" },
                  ]}
                />
              </ScrollReveal>
            </div>
            <ScrollReveal delay={0.25}>
              <div className="mt-8 sm:mt-10 text-center">
                <Link
                  href="/services"
                  className="inline-flex items-center px-6 py-3 rounded-xl border-2 border-amber-500 text-amber-600 font-semibold hover:bg-amber-50 transition-colors"
                >
                  View all services →
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Audit Process */}
        <section id="how-it-works" className="px-4 sm:px-6 py-12 sm:py-20 bg-white">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
                Our audit process
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                A structured, evidence-based review from submission to report
              </p>
              <p className="mt-2 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                HairAudit follows a clear, step-by-step audit process designed to objectively assess hair
                transplant quality using clinical evidence and structured review criteria.
              </p>
            </ScrollReveal>
            <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-4">
              {[
                { step: 1, title: "Submit Case", desc: "Upload photos and case details" },
                { step: 2, title: "Review & Analysis", desc: "Structured clinical assessment" },
                { step: 3, title: "Structured Scoring", desc: "Defined criteria and consistency" },
                { step: 4, title: "Audit Report", desc: "Comprehensive findings" },
                { step: 5, title: "Guidance & Next Steps", desc: "Expert guidance for successful outcomes" },
              ].map(({ step, title, desc }, i) => (
                <ScrollReveal key={step} delay={i * 0.05}>
                  <div className="text-center p-4 sm:p-0">
                    <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold mx-auto">
                      {step}
                    </div>
                    <h3 className="mt-3 font-semibold text-slate-900 text-base sm:text-sm">{title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{desc}</p>
                    <Link href="/how-it-works" className="mt-2 inline-block text-sm font-medium text-amber-600 hover:text-amber-500">
                      Learn more →
                    </Link>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-slate-900 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold">
                Request an Audit Review
              </h2>
              <p className="mt-4 text-slate-300 text-sm sm:text-base">
                Independent, evidence-based review with no clinic promotion or affiliations. Whether you
                are a patient seeking clarity, or a clinic or surgeon looking to benchmark quality,
                HairAudit provides an independent pathway to objective clinical insight.
              </p>
              <Link
                href="/signup"
                className="mt-6 sm:mt-8 inline-flex items-center justify-center px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors text-base min-h-[44px]"
              >
                Submit your case
              </Link>
            </ScrollReveal>
          </div>
        </section>

        {/* Why Choose HairAudit */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
                Why Choose HairAudit
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                Independent. Evidence-based. Clinically focused. All submissions are handled
                confidentially and never shared without consent.
              </p>
            </ScrollReveal>
            <div className="mt-10 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[
                {
                  title: "Truly Independent",
                  desc: "We do not perform hair transplants and do not promote clinics, surgeons, or products. Our audits are unbiased and evidence-based.",
                },
                {
                  title: "Clinically Focused Analysis",
                  desc: "Reviews are based on surgical technique, donor area integrity, graft handling, implantation accuracy, and expected growth — not testimonials or marketing claims.",
                },
                {
                  title: "Structured Audit Methodology",
                  desc: "Each case is assessed using defined criteria to ensure consistency, transparency, and medically relevant conclusions.",
                },
                {
                  title: "Designed for Patients and Professionals",
                  desc: "Our reports support patients seeking clarity, clinics benchmarking performance, and surgeons committed to improving outcomes.",
                },
                {
                  title: "Global and Procedure-Focused",
                  desc: "HairAudit operates independently of location and clinic size, focusing solely on the quality of the procedure and its likely outcome.",
                },
              ].map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.05}>
                  <div className="p-5 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <h3 className="font-semibold text-slate-900 text-base sm:text-lg">{item.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 sm:px-6 py-10 sm:py-12 bg-white border-t border-slate-200">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 sm:py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors min-h-[44px]"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 sm:py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-semibold hover:border-amber-400 hover:bg-amber-50/50 transition-colors min-h-[44px]"
            >
              Sign in
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
