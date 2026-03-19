import Link from "next/link";
import TrackedLink from "@/components/analytics/TrackedLink";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Create Clinic or Doctor Profile | HairAudit",
  description:
    "Create your free HairAudit profile as a clinic or doctor. Start with internal audits and build a verified, transparent professional presence.",
  pathname: "/professionals/apply",
});

const clinicCopy = {
  title: "Create Clinic Profile",
  description:
    "Create your free clinic profile, submit audited cases, and build a verified public presence over time. Clinics can begin with private internal audits before making selected cases public.",
  cta: "Create Clinic Profile",
  href: "/signup?role=clinic",
};

const doctorCopy = {
  title: "Create Doctor Profile",
  description:
    "Create your free doctor profile and begin building a transparent, evidence-based professional record. Doctors can contribute cases and build a verified presence through transparent case contribution.",
  cta: "Create Doctor Profile",
  href: "/signup?role=doctor",
};

export default function ProfessionalApplyPage() {
  return (
    <div className="space-y-8">
      <ScrollReveal>
        <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
            For professionals
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Create your profile
          </h1>
          <p className="mt-4 max-w-3xl text-slate-200">
            Choose your path. Clinics and doctors can create a free profile and get started with
            internal audits or begin building a verified, transparent presence — no application or
            approval required.
          </p>
        </section>
      </ScrollReveal>

      <div className="grid gap-6 lg:grid-cols-2">
        <ScrollReveal delay={0.04}>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col h-full">
            <h2 className="text-xl font-semibold text-white">{clinicCopy.title}</h2>
            <p className="mt-3 text-slate-300 text-sm leading-relaxed flex-1">
              {clinicCopy.description}
            </p>
            <div className="mt-6">
              <TrackedLink
                href={clinicCopy.href}
                eventName="cta_create_clinic_profile_professionals_apply"
                className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors"
              >
                {clinicCopy.cta}
              </TrackedLink>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delay={0.06}>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col h-full">
            <h2 className="text-xl font-semibold text-white">{doctorCopy.title}</h2>
            <p className="mt-3 text-slate-300 text-sm leading-relaxed flex-1">
              {doctorCopy.description}
            </p>
            <div className="mt-6">
              <TrackedLink
                href={doctorCopy.href}
                eventName="cta_create_doctor_profile_professionals_apply"
                className="inline-flex items-center justify-center rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-400 transition-colors"
              >
                {doctorCopy.cta}
              </TrackedLink>
            </div>
          </section>
        </ScrollReveal>
      </div>

      <ScrollReveal delay={0.1}>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Learn more</h2>
          <p className="mt-3 text-sm text-slate-300">
            Explore the Verified Surgeon Program and how recognition works, or browse participating
            clinics.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/verified-surgeon-program"
              className="inline-flex items-center justify-center rounded-xl border border-slate-600 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-white/5 transition-colors"
            >
              Verified Surgeon Program
            </Link>
            <Link
              href="/clinics"
              className="inline-flex items-center justify-center rounded-xl border border-slate-600 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-white/5 transition-colors"
            >
              Explore Clinics
            </Link>
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}
