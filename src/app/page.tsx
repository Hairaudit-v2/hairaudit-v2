// HairAudit marketing site (B12 migrated)
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-slate-900 text-white px-4 py-16 sm:py-24 relative overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/Images/hero.jpg"
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
        <section className="px-4 py-16 sm:py-20 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
              What you&apos;ll receive
            </h2>
            <p className="mt-4 text-slate-600 text-center max-w-2xl mx-auto">
              Each audit delivers a comprehensive report with structured findings, scores, and expert analysis.
            </p>
            <div className="mt-10 rounded-xl overflow-hidden border border-slate-200 shadow-lg">
              <Image
                src="/Images/patient-report-sample.jpg"
                alt="Sample patient audit report"
                width={1200}
                height={800}
                className="w-full h-auto"
              />
            </div>
          </div>
        </section>

        {/* Intro */}
        <section className="px-4 py-16 sm:py-20 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
              Objective, evidence-based clinical assessment
            </h2>
            <p className="mt-6 text-slate-600 text-center">
              HairAudit was created to bring transparency, accountability, and clinical clarity to the
              hair restoration industry. We provide independent audits of hair transplant procedures
              by analysing surgical technique, donor area integrity, graft handling, implantation
              accuracy, and post-operative standards using structured medical review methods.
            </p>
            <p className="mt-4 text-slate-600 text-center">
              HairAudit does not perform hair transplants and does not promote clinics or surgeons.
              Our role is to deliver unbiased, evidence-based reporting that supports informed patient
              decisions, corrective planning, and continuous improvement across the industry.
            </p>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="px-4 py-16 sm:py-20 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
              Our services
            </h2>
            <p className="mt-4 text-slate-600 text-center max-w-2xl mx-auto">
              Each audit focuses on surgical quality, donor area management, graft handling,
              implantation accuracy, and expected growth outcomes.
            </p>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Patient Hair Transplant Audit",
                  desc: "In-depth analysis of hair restoration procedures. Independent review of a patient's hair transplant procedure, including donor area integrity, graft placement, hairline design, and likely growth performance.",
                },
                {
                  title: "Post-Procedure Outcome Analysis",
                  desc: "Assessment of surgical outcomes following a hair transplant, identifying strengths, risks, and factors that may influence final growth and density.",
                },
                {
                  title: "Donor Area & Extraction Review",
                  desc: "Detailed analysis of donor area management, extraction patterns, spacing, and potential over-harvesting or trauma.",
                },
                {
                  title: "Implantation & Hairline Design Review",
                  desc: "Comprehensive evaluation of hair transplant techniques, graft angles, density distribution, and direction.",
                },
                {
                  title: "Clinic & Surgeon Benchmark Audits",
                  desc: "Structured audits for clinics and surgeons seeking objective quality benchmarking.",
                  image: "clinic",
                },
              ].map((s) => (
                <div
                  key={s.title}
                  className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-amber-200 transition-colors overflow-hidden"
                >
                  {s.image === "clinic" && (
                    <div className="grid grid-cols-2 gap-2 -mx-6 -mt-6 mb-4">
                      <div className="aspect-video">
                        <Image
                          src="/Images/clinic-feedback.jpg"
                          alt="Clinic audit sample"
                          width={400}
                          height={225}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="aspect-video">
                        <Image
                          src="/Images/doctors-feedback.jpg"
                          alt="Surgeon audit sample"
                          width={400}
                          height={225}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                  <h3 className="font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
                  <Link
                    href="/signup"
                    className="inline-block mt-3 text-sm font-medium text-amber-600 hover:text-amber-500"
                  >
                    Learn more →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Audit Process */}
        <section id="how-it-works" className="px-4 py-16 sm:py-20 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
              Our audit process
            </h2>
            <p className="mt-4 text-slate-600 text-center max-w-2xl mx-auto">
              A structured, evidence-based review from submission to report
            </p>
            <p className="mt-2 text-slate-600 text-center max-w-2xl mx-auto">
              HairAudit follows a clear, step-by-step audit process designed to objectively assess hair
              transplant quality using clinical evidence and structured review criteria.
            </p>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { step: 1, title: "Submit Case", desc: "Upload photos and case details" },
                { step: 2, title: "Review & Analysis", desc: "Structured clinical assessment" },
                { step: 3, title: "Structured Scoring", desc: "Defined criteria and consistency" },
                { step: 4, title: "Audit Report", desc: "Comprehensive findings" },
                { step: 5, title: "Guidance & Next Steps", desc: "Expert guidance for successful outcomes" },
              ].map(({ step, title, desc }) => (
                <div key={step} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold mx-auto">
                    {step}
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{desc}</p>
                  <Link href="/signup" className="mt-2 inline-block text-sm font-medium text-amber-600 hover:text-amber-500">
                    Learn more →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-16 sm:py-20 bg-slate-900 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold">
              Request an Audit Review
            </h2>
            <p className="mt-4 text-slate-300">
              Independent, evidence-based review with no clinic promotion or affiliations. Whether you
              are a patient seeking clarity, or a clinic or surgeon looking to benchmark quality,
              HairAudit provides an independent pathway to objective clinical insight.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center justify-center px-8 py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
            >
              Submit your case
            </Link>
          </div>
        </section>

        {/* Why Choose HairAudit */}
        <section className="px-4 py-16 sm:py-20 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
              Why Choose HairAudit
            </h2>
            <p className="mt-4 text-slate-600 text-center max-w-2xl mx-auto">
              Independent. Evidence-based. Clinically focused. All submissions are handled
              confidentially and never shared without consent.
            </p>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm"
                >
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 py-12 bg-white border-t border-slate-200">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-semibold hover:border-amber-400 hover:bg-amber-50/50 transition-colors"
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
