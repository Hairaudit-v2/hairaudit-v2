import Link from "next/link";
import TrackedLink from "@/components/analytics/TrackedLink";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { cn } from "@/lib/utils";
import { networkButtonVariants } from "@/packages/ui";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Create Clinic or Doctor Profile | HairAudit",
  description:
    "Create your free HairAudit professional profile as a clinic or doctor. Build verified transparency infrastructure through structured participation.",
  pathname: "/professionals/apply",
});

const clinicCopy = {
  title: "Create Clinic Profile",
  description:
    "Create your free clinic profile, submit audited cases, and build a verified public presence over time. Clinics can begin with private internal audits before making selected cases public.",
  cta: PUBLIC_CTAS.createClinicProfile,
  href: "/signup?role=clinic",
};

const doctorCopy = {
  title: "Create Doctor Profile",
  description:
    "Create your free doctor profile and begin building a transparent, evidence-based professional record through structured case contribution.",
  cta: "Create Doctor Profile",
  href: "/signup?role=doctor",
};

export default function ProfessionalApplyPage() {
  return (
    <div className="space-y-8">
      <ScrollReveal>
        <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
            Professional Standards Infrastructure
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Create your professional profile
          </h1>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            Choose your path. Clinics and doctors can create a free profile and begin with internal
            audits or build a verified, transparent presence through structured participation.
          </p>
          <div className="mt-6">
            <TrackedLink
              href="/signup?role=doctor"
              eventName="cta_create_professional_profile_apply_header"
              className={fiHairauditPrimaryButtonClass("md")}
            >
              {PUBLIC_CTAS.createProfessionalProfile}
            </TrackedLink>
          </div>
        </section>
      </ScrollReveal>

      <div className="grid gap-6 lg:grid-cols-2">
        <ScrollReveal delay={0.04}>
          <section className="flex h-full flex-col rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel">
            <h2 className="text-xl font-semibold text-foreground">{clinicCopy.title}</h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              {clinicCopy.description}
            </p>
            <div className="mt-6">
              <TrackedLink
                href={clinicCopy.href}
                eventName="cta_create_clinic_profile_professionals_apply"
                className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
              >
                {clinicCopy.cta}
              </TrackedLink>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delay={0.06}>
          <section className="flex h-full flex-col rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel">
            <h2 className="text-xl font-semibold text-foreground">{doctorCopy.title}</h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              {doctorCopy.description}
            </p>
            <div className="mt-6">
              <TrackedLink
                href={doctorCopy.href}
                eventName="cta_create_doctor_profile_professionals_apply"
                className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
              >
                {doctorCopy.cta}
              </TrackedLink>
            </div>
          </section>
        </ScrollReveal>
      </div>

      <ScrollReveal delay={0.1}>
        <section className="rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel">
          <h2 className="text-xl font-semibold text-foreground">Institutional trust context</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Explore how recognition and transparency participation work, or browse participating
            clinics in the HairAudit ecosystem.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/verified-surgeon-program"
              className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
            >
              Verified Surgeon Program
            </Link>
            <Link
              href="/clinics"
              className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
            >
              Explore Clinics
            </Link>
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}
