import Link from "next/link";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Apply for Professional Participation | HairAudit",
  description:
    "Request participation in the HairAudit professional ecosystem for clinics, surgeons, partners, auditors, and expert stakeholders.",
  pathname: "/professionals/apply",
});

const audienceItems = [
  "Clinics that want transparent, evidence-based profile participation.",
  "Surgeons seeking recognition through validated documentation and outcomes.",
  "Clinical partners supporting quality improvement and benchmark readiness.",
  "Independent auditors and expert stakeholders contributing review quality.",
  "Legal and advisory professionals needing structured, objective documentation context.",
];

const valueItems = [
  "Strengthen trust with independent, evidence-led visibility.",
  "Support fairer interpretation through improved documentation contribution.",
  "Track recognition progression based on validated participation.",
  "Align your profile with transparent quality standards.",
];

const processSteps = [
  "Submit your participation interest with role and organization details.",
  "HairAudit reviews fit, scope, and operational readiness.",
  "We confirm onboarding requirements and evidence standards.",
  "You receive next-step onboarding guidance and access path.",
];

const participationEmail =
  "mailto:auditor@hairaudit.com?subject=HairAudit%20Professional%20Participation%20Request";

export default function ProfessionalApplyPage() {
  return (
    <div className="space-y-8">
      <ScrollReveal>
        <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
            Professional Participation
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Join the HairAudit professional ecosystem
          </h1>
          <p className="mt-4 max-w-3xl text-slate-200">
            This pathway is for clinics, surgeons, partners, and expert stakeholders who want to
            participate in transparent, evidence-based quality benchmarking.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href={participationEmail}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors"
            >
              Request Participation
            </Link>
            <Link
              href="/verified-surgeon-program"
              className="inline-flex items-center justify-center rounded-xl border border-slate-600 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-white/5 transition-colors"
            >
              Review Program Overview
            </Link>
          </div>
        </section>
      </ScrollReveal>

      <div className="grid gap-6 lg:grid-cols-2">
        <ScrollReveal delay={0.04}>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Who this is for</h2>
            <ul className="mt-4 space-y-2 text-slate-300 text-sm">
              {audienceItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-cyan-300">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Why participate</h2>
            <ul className="mt-4 space-y-2 text-slate-300 text-sm">
              {valueItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-cyan-300">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </ScrollReveal>
      </div>

      <ScrollReveal delay={0.12}>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">What the process looks like</h2>
          <ol className="mt-4 space-y-3 text-sm text-slate-300">
            {processSteps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/25 text-cyan-200 text-xs font-semibold">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-slate-400">
            Include role, organization name, country, and your participation goals in your request.
          </p>
        </section>
      </ScrollReveal>

      <ScrollReveal delay={0.16}>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Next steps</h2>
          <p className="mt-3 text-sm text-slate-300">
            Ready to participate? Submit your request and our team will reply with onboarding guidance.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <Link
              href={participationEmail}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors"
            >
              Request Participation
            </Link>
            <Link
              href="/clinics"
              className="inline-flex items-center justify-center rounded-xl border border-slate-600 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-white/5 transition-colors"
            >
              Explore Participating Clinics
            </Link>
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}
