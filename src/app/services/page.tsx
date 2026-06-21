import Link from "next/link";

import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import PublicMarketingCtaPanel from "@/components/marketing/PublicMarketingCtaPanel";
import PublicMarketingHero from "@/components/marketing/PublicMarketingHero";
import TrackedLink from "@/components/analytics/TrackedLink";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { cn } from "@/lib/utils";
import { Badge, FeatureGrid, Section, networkButtonVariants } from "@/packages/ui";

export const metadata = createPageMetadata({
  title: "HairAudit Pathways | Patients, Clinics & Professionals | HairAudit",
  description:
    "HairAudit pathways: Pre-Surgery Review, Post-Surgery Audit, Professional Profile, and Clinic Profile—independent analysis and accountability infrastructure without treatment sales.",
  pathname: "/services",
});

const pathways = [
  {
    id: "pre-surgery",
    name: "Pre-Surgery Review",
    audience: "Patients planning a first procedure or comparing clinics who want donor safety and long-term planning context before committing.",
    analyzed: [
      "Donor quality and reserve for future loss",
      "Hair loss classification and progression risk",
      "Recipient viability and conservative planning",
      "Documentation gaps that could limit later review",
    ],
    deliverable: "Clinical Intelligence Report focused on planning concerns, evidence strength, and questions to discuss before surgery.",
    cta: PUBLIC_CTAS.startPreSurgeryReview,
    href: "/request-review?pathway=pre_surgery",
    eventName: "cta_start_pre_surgery_services",
  },
  {
    id: "post-surgery",
    name: "Post-Surgery Audit",
    audience: "Patients reviewing an outcome, timeline concern, or disputed result who need independent, evidence-led documentation.",
    analyzed: [
      "Donor stewardship and extraction pattern",
      "Recipient density, design, and growth timeline",
      "Procedural concerns visible in photos",
      "Confidence limits when documentation is incomplete",
    ],
    deliverable: "Clinical Intelligence Report with structured findings, confidence-aware conclusions, and practical next-step context.",
    cta: PUBLIC_CTAS.startPostSurgeryAudit,
    href: "/request-review?pathway=post_surgery",
    eventName: "cta_start_post_surgery_services",
  },
  {
    id: "professional",
    name: "Professional Profile",
    audience: "Surgeons and professional teams building verified participation, internal audits, and transparency records.",
    analyzed: [
      "Documentation contribution quality",
      "Case-level performance across review domains",
      "Transparency participation patterns",
      "Recognition progression and benchmark readiness",
    ],
    deliverable: "Professional profile infrastructure, audit-quality feedback, and transparency metrics within the HairAudit ecosystem.",
    cta: PUBLIC_CTAS.createProfessionalProfile,
    href: "/professionals/apply",
    eventName: "cta_create_professional_profile_services",
  },
  {
    id: "clinic",
    name: "Clinic Profile",
    audience: "Clinics seeking quality assurance, accountability infrastructure, and certification-ready benchmarking.",
    analyzed: [
      "Planning and documentation quality",
      "Donor preservation and procedural consistency",
      "Validated case contribution patterns",
      "Transparency and certification progression",
    ],
    deliverable: "Clinic profile, internal audit workflow, and optional public transparency display earned through documented participation.",
    cta: PUBLIC_CTAS.createClinicProfile,
    href: "/signup?role=clinic",
    eventName: "cta_create_clinic_profile_services",
  },
] as const;

export default function ServicesPage() {
  return (
    <HairAuditFiMarketingShell>
      <main id="main-content" className="relative flex-1">
        <PublicMarketingHero
          badge="HairAudit Pathways"
          title="Independent analysis pathways—not generic services"
          description="Each HairAudit pathway has a defined audience, evidence scope, and Clinical Intelligence Report or profile deliverable. Choose the route that matches patient protection or professional accountability goals."
        />

        <Section className="border-t border-border/30">
          <div className="space-y-10">
            <div className="max-w-3xl space-y-3">
              <Badge tone="neutral">At a glance</Badge>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Four pathways across patients and professionals
              </h2>
            </div>
            <FeatureGrid columnsClassName="md:grid-cols-2">
              {pathways.map((pathway) => (
                <article
                  key={pathway.id}
                  className="flex h-full flex-col rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel"
                >
                  <h3 className="text-xl font-semibold text-foreground">{pathway.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{pathway.audience}</p>
                  <div className="mt-5 space-y-4 flex-1">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        What is analyzed
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {pathway.analyzed.map((item) => (
                          <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                            <span className="shrink-0 text-amber-400">—</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        What you receive
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pathway.deliverable}</p>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-border/40">
                    <TrackedLink
                      href={pathway.href}
                      eventName={pathway.eventName}
                      className={cn(
                        pathway.id === "pre-surgery" || pathway.id === "post-surgery"
                          ? fiHairauditPrimaryButtonClass("md")
                          : networkButtonVariants({ variant: "secondary", size: "md" })
                      )}
                    >
                      {pathway.cta}
                    </TrackedLink>
                  </div>
                </article>
              ))}
            </FeatureGrid>
          </div>
        </Section>

        <Section className="border-t border-border/30">
          <div className="mx-auto max-w-4xl space-y-6">
            <Badge tone="neutral">Report preview</Badge>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Clinical Intelligence Report format
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Patient pathways produce structured, confidence-aware reports designed for patient protection and
              long-term planning—not clinic marketing.
            </p>
            <FeatureGrid columnsClassName="sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: "Structured report", desc: "Summary, domain analysis, evidence observations, and next-step guidance." },
                { title: "Evidence-led scoring", desc: "Domain scores aligned with HairAudit methodology across cases." },
                { title: "Donor & recipient focus", desc: "Donor safety, recipient planning, and procedural concerns tied to evidence." },
                { title: "Confidence-aware findings", desc: "Explicit limits when documentation is incomplete." },
              ].map((item) => (
                <article key={item.title} className="rounded-2xl border border-border/50 bg-card/60 p-5">
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </article>
              ))}
            </FeatureGrid>
            <TrackedLink
              href="/demo-report"
              eventName="cta_view_sample_report_services"
              className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
            >
              {PUBLIC_CTAS.viewSampleReport}
            </TrackedLink>
          </div>
        </Section>

        <PublicMarketingCtaPanel
          title="Choose your HairAudit pathway"
          description={
            <>
              Patients typically begin with a free HairAudit. Professionals and clinics create profiles to build
              transparency over time. Read the{" "}
              <Link href="/methodology" className="font-medium text-amber-400 hover:text-amber-300">
                evidence-led methodology
              </Link>{" "}
              for framework detail.
            </>
          }
          actions={[
            {
              href: "/request-review",
              label: PUBLIC_CTAS.startFreeHairAudit,
              variant: "primary",
              eventName: "cta_request_review_services",
              useStartFreeAuditButton: true,
            },
            {
              href: "/signup?role=clinic",
              label: PUBLIC_CTAS.createClinicProfile,
              variant: "secondary",
              eventName: "cta_create_clinic_profile_services_panel",
            },
          ]}
        />
      </main>
    </HairAuditFiMarketingShell>
  );
}
