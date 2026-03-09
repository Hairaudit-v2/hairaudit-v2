// HairAudit marketing site (B12 migrated)
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import ServiceCard from "@/components/ui/ServiceCard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const revalidate = 600;

/** Public homepage metrics. Single source of truth: cases table only. Beta-appropriate and never contradictory. */
async function getPublicAuditMetrics() {
  try {
    const admin = createSupabaseAdminClient();

    const baseFilter = admin
      .from("cases")
      .select("id", { count: "exact", head: true });

    const { count: auditsCompleted } = await baseFilter
      .eq("status", "complete")
      .eq("is_test", false);

    const { count: casesUnderReview } = await admin
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted")
      .eq("is_test", false);

    return {
      auditsCompleted: auditsCompleted ?? 0,
      casesUnderReview: casesUnderReview ?? 0,
      forensicScoringDomains: 5,
    };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const metrics = await getPublicAuditMetrics();
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
              Independent Forensic Benchmarking for Hair Transplant Outcomes
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-slate-300">
              Evidence-based transplant review through structured visual analysis and benchmark scoring
            </p>
            <p className="mt-6 text-slate-400 max-w-2xl mx-auto">
              HairAudit is the independent layer for hair transplant outcome transparency. We deliver
              forensic audits of donor extraction, graft handling, implantation technique, and
              hairline design using structured surgical scoring and visual evidence analysis. Our
              methodology is supported by{" "}
              <Link href="/follicle-intelligence" className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
                Follicle Intelligence
              </Link>
              .
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
              >
                Request an Audit (Patient Beta)
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-slate-600 text-slate-200 font-semibold hover:border-amber-500 hover:text-amber-400 transition-colors"
              >
                Learn How HairAudit Works
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/clinics"
                className="text-sm font-medium text-slate-400 hover:text-amber-400 transition-colors"
              >
                Explore Participating Clinics
              </Link>
              <span className="text-slate-600" aria-hidden>·</span>
              <Link
                href="/verified-surgeon-program"
                className="text-sm font-medium text-slate-400 hover:text-amber-400 transition-colors"
              >
                Learn About the Verified Program
              </Link>
            </div>

            {metrics && (
              <div className="mt-10 flex justify-center">
                <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
                    Platform at a glance
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                    <div>
                      <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{metrics.auditsCompleted}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Audits completed</p>
                    </div>
                    <div>
                      <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{metrics.casesUnderReview}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Cases under review</p>
                    </div>
                    <div>
                      <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{metrics.forensicScoringDomains}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Forensic scoring domains</p>
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex flex-col justify-end">
                      <p className="text-xs text-slate-400">Human-reviewed, structured reports</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Sample Report Preview */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-white">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
                Your forensic report
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                Every case receives a benchmark report: structured scores, visual evidence analysis, and outcome transparency across our forensic scoring domains.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <div className="mt-8 sm:mt-10 max-w-[410px] mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
                <Image
                  src="/images/patient-report-sample.jpg"
                  alt="Sample patient audit report"
                  width={410}
                  height={273}
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
                The independent benchmark for transplant outcome transparency
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="mt-6 text-slate-600 text-center text-sm sm:text-base">
                HairAudit was built to establish an independent forensic standard for hair transplant
                quality. We apply structured visual evidence analysis and benchmark scoring across donor
                integrity, graft handling, implantation accuracy, and outcome potential — no clinic
                affiliation, no promotion.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.15}>
              <p className="mt-4 text-slate-600 text-center text-sm sm:text-base">
                We do not perform procedures or promote surgeons. Our role is evidence-based
                benchmarking: unbiased reporting that supports informed decisions, corrective
                planning, and outcome transparency for patients and the industry.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="px-4 sm:px-6 py-12 sm:py-20 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
                Forensic review by domain
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                Structured benchmarking across surgical quality, donor management, graft handling,
                implantation accuracy, and outcome potential.
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
                From submission to benchmark report
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                Independent forensic review with defined criteria and visual evidence analysis from
                submission through to your structured report. Analysis is assisted by{" "}
                <Link href="/follicle-intelligence" className="text-amber-600 hover:text-amber-500 font-medium">
                  Follicle Intelligence
                </Link>
                .
              </p>
            </ScrollReveal>
            <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-4">
              {[
                { step: 1, title: "Submit Case", desc: "Photos and case details" },
                { step: 2, title: "Forensic Review", desc: "Visual evidence and benchmark analysis" },
                { step: 3, title: "Structured Scoring", desc: "Defined criteria across domains" },
                { step: 4, title: "Benchmark Report", desc: "Scores and outcome transparency" },
                { step: 5, title: "Guidance & Next Steps", desc: "Findings and next steps" },
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
                Submit for independent forensic review
              </h2>
              <p className="mt-4 text-slate-300 text-sm sm:text-base">
                No clinic affiliation. Evidence-based benchmark scoring and visual analysis. During
                patient beta, submit your transplant case for forensic review. Clinic and doctor
                participation will open in later stages.
              </p>
              <Link
                href="/signup"
                className="mt-6 sm:mt-8 inline-flex items-center justify-center px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors text-base min-h-[44px]"
              >
                Join patient beta
              </Link>
            </ScrollReveal>
          </div>
        </section>

        {/* Why HairAudit */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
                Why HairAudit
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-center max-w-2xl mx-auto text-sm sm:text-base">
                Independent first. Evidence-based benchmarking. Submissions are confidential and never shared without consent.
              </p>
            </ScrollReveal>
            <div className="mt-10 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[
                {
                  title: "Independent",
                  desc: "We do not perform procedures or promote clinics or surgeons. Forensic benchmarking only — no affiliation, no bias.",
                },
                {
                  title: "Evidence-based",
                  desc: "Structured visual evidence analysis and benchmark scoring: donor integrity, graft handling, implantation, outcome potential. Not testimonials or marketing.",
                },
                {
                  title: "Forensic methodology",
                  desc: "Defined scoring criteria and consistent domains so every case is comparable, transparent, and medically relevant.",
                },
                {
                  title: "Outcome transparency",
                  desc: "Reports give patients clarity and support corrective planning; they give the industry a shared benchmark for quality.",
                },
                {
                  title: "Global benchmark standard",
                  desc: "Location- and clinic-agnostic. We focus solely on procedure quality and outcome potential.",
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
              Join patient beta
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
