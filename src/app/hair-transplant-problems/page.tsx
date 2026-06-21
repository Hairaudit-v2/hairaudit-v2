import Link from "next/link";
import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import PublicMarketingHero from "@/components/marketing/PublicMarketingHero";
import PublicTrustArchitectureBlock from "@/components/marketing/PublicTrustArchitectureBlock";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import MedicalProcedureFaqSchema from "@/components/seo/MedicalProcedureFaqSchema";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { patientIssueLibrary } from "@/lib/patientEducationIssues";
import { listPatientIntentGuidesGroupedByTheme } from "@/lib/seo/patient-intent-hub-themes";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { Badge, Section, networkButtonVariants } from "@/packages/ui";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "Are all transplant concerns signs of surgical failure?",
    answer:
      "No. Some concerns are part of normal recovery. A timeline-based, independent review helps separate expected healing from issues that deserve closer attention.",
  },
  {
    question: "What do these guides cover?",
    answer:
      "Plain-language explainers on common post-transplant worries, how photos and timelines are used in assessment, donor and design trade-offs, and when an independent HairAudit review is most useful.",
  },
  {
    question: "When should I request an independent review?",
    answer:
      "When worry persists after a fair healing window, clinic explanations do not match what you see in consistent photos, or you want structured documentation before a complaint, second opinion, or revision plan.",
  },
];

export const metadata = createPageMetadata({
  title: "Hair Transplant Patient Guides | Independent Education | HairAudit",
  description:
    "Evidence-based patient guides on hair transplant results, timelines, donor safety, photos, and when an independent HairAudit review helps—without clinic marketing.",
  pathname: "/hair-transplant-problems",
});

function GuideCard({
  href,
  title,
  description,
  linkLabel,
  hubCardType,
  hubCardSlug,
  hubThemeId,
}: {
  href: string;
  title: string;
  description: string;
  linkLabel: string;
  hubCardType: "quick-topic" | "in-depth";
  hubCardSlug: string;
  hubThemeId?: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col rounded-2xl border border-border/50 bg-card/70 p-5 shadow-fi-panel transition hover:border-amber-400/40"
      data-cta="patient-guides-hub-card"
      data-hub-card-type={hubCardType}
      data-hub-card-slug={hubCardSlug}
      data-cta-destination={href}
      {...(hubThemeId ? { "data-hub-theme": hubThemeId } : {})}
    >
      <h3 className="text-lg font-semibold leading-snug text-foreground">{title}</h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-4">{description}</p>
      <p className="mt-4 text-sm font-medium text-amber-300">{linkLabel}</p>
    </Link>
  );
}

export default function HairTransplantProblemsHubPage() {
  const themedSections = listPatientIntentGuidesGroupedByTheme();

  return (
    <HairAuditFiMarketingShell>
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "Hair transplant patient guides", pathname: "/hair-transplant-problems" },
        ]}
      />
      <MedicalProcedureFaqSchema
        pageName="Hair transplant patient guides"
        pageDescription="Independent patient education on post-transplant concerns, photo-based review, and when structured independent analysis helps."
        faqs={faqs}
      />

      <main id="main-content" className="relative flex-1" data-analytics-scope="patient-guides-hub">
        <PublicMarketingHero
          badge="Patient guides"
          title="Hair transplant patient guides"
          description={
            <>
              Worried about density, hairline shape, donor thinning, or slow growth? These guides explain common
              concerns, what can still be normal during recovery, and where an independent HairAudit fits—separate from
              any clinic’s sales story.
            </>
          }
        >
          <div
            className="flex flex-col flex-wrap gap-3 sm:flex-row"
            data-analytics-region="patient-guides-hub-hero-ctas"
          >
            <Link
              href="/request-review"
              className={fiHairauditPrimaryButtonClass("md")}
              data-cta="patient-guides-hub-hero-request-review"
              data-cta-destination="/request-review"
            >
              {PUBLIC_CTAS.startFreeHairAudit}
            </Link>
            <Link
              href="/demo-report"
              className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
              data-cta="patient-guides-hub-hero-sample-report"
              data-cta-destination="/demo-report"
            >
              {PUBLIC_CTAS.viewSampleReport}
            </Link>
            <Link
              href="/methodology"
              className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
              data-cta="patient-guides-hub-hero-methodology"
              data-cta-destination="/methodology"
            >
              Methodology
            </Link>
          </div>
        </PublicMarketingHero>

        <Section className="border-t border-border/30">
          <div className="mx-auto max-w-5xl space-y-14">
            <PublicTrustArchitectureBlock surface="fi" />

            <section aria-labelledby="quick-topics-heading">
              <Badge tone="neutral">Quick topics</Badge>
              <h2 id="quick-topics-heading" className="mt-3 text-xl font-semibold text-foreground sm:text-2xl">
                Quick topic guides
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Shorter pages on frequent search questions. Pair them with the themed guides below when you want more depth.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2" data-analytics-region="patient-guides-hub-quick-topics">
                {patientIssueLibrary.map((issue) => (
                  <GuideCard
                    key={issue.slug}
                    href={`/${issue.slug}`}
                    title={issue.title}
                    description={issue.description}
                    linkLabel="Open quick guide"
                    hubCardType="quick-topic"
                    hubCardSlug={issue.slug}
                  />
                ))}
              </div>
            </section>

            <section className="mt-16" aria-labelledby="in-depth-heading">
              <Badge tone="neutral">In-depth guides</Badge>
              <h2 id="in-depth-heading" className="mt-3 text-xl font-semibold text-foreground sm:text-2xl">
                In-depth guides by theme
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Longer reads organised into clusters so you can explore one concern without losing surrounding
                context—healing versus design versus donor planning versus independent analysis.
              </p>
            </section>

            {themedSections.map((section) => (
              <section key={section.id} className="scroll-mt-24" aria-labelledby={`theme-${section.id}`}>
                <h3 id={`theme-${section.id}`} className="text-lg font-semibold text-foreground sm:text-xl">
                  {section.title}
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {section.description}
                </p>
                <div
                  className="mt-5 grid gap-4 sm:grid-cols-2"
                  data-analytics-region={`patient-guides-hub-theme-${section.id}`}
                >
                  {section.guides.map((guide) => (
                    <GuideCard
                      key={guide.slug}
                      href={guide.pathname}
                      title={guide.h1}
                      description={guide.metaDescription}
                      linkLabel="Read full guide"
                      hubCardType="in-depth"
                      hubCardSlug={guide.slug}
                      hubThemeId={section.id}
                    />
                  ))}
                </div>
              </section>
            ))}

            <section className="rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel">
              <h2 className="text-xl font-semibold text-foreground">Want example findings, not theory?</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                The audit example library shows how structured findings, evidence limits, and next steps appear in
                practice.
              </p>
              <div className="mt-5" data-analytics-region="patient-guides-hub-audit-examples">
                <Link
                  href="/audit-examples"
                  className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
                  data-cta="patient-guides-hub-audit-examples"
                  data-cta-destination="/audit-examples"
                >
                  Browse audit examples
                </Link>
              </div>
            </section>

            <section
              className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/10 to-transparent p-6 sm:p-8"
              data-analytics-region="patient-guides-hub-footer-cta"
            >
              <h2 className="text-xl font-semibold text-foreground">Ready for structured, independent analysis?</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                If something still feels off after reading, begin your HairAudit with photos and timeline evidence.
                Preview a{" "}
                <Link
                  href="/demo-report"
                  className="font-medium text-amber-400 underline underline-offset-2 hover:text-amber-300"
                  data-cta="patient-guides-hub-footer-inline-sample-report"
                  data-cta-destination="/demo-report"
                >
                  Clinical Intelligence Report preview
                </Link>{" "}
                or read the{" "}
                <Link
                  href="/faq"
                  className="font-medium text-amber-400 underline underline-offset-2 hover:text-amber-300"
                  data-cta="patient-guides-hub-footer-inline-faq"
                  data-cta-destination="/faq"
                >
                  FAQ
                </Link>{" "}
                first if that helps.
              </p>
              <div
                className="mt-6 flex flex-col flex-wrap gap-3 sm:flex-row"
                data-analytics-region="patient-guides-hub-footer-ctas"
              >
                <Link
                  href="/request-review"
                  className={fiHairauditPrimaryButtonClass("md")}
                  data-cta="patient-guides-hub-footer-request-review"
                  data-cta-destination="/request-review"
                >
                  {PUBLIC_CTAS.startFreeHairAudit}
                </Link>
                <Link
                  href="/demo-report"
                  className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
                  data-cta="patient-guides-hub-footer-sample-report"
                  data-cta-destination="/demo-report"
                >
                  {PUBLIC_CTAS.viewSampleReport}
                </Link>
                <Link
                  href="/faq"
                  className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
                  data-cta="patient-guides-hub-footer-faq"
                  data-cta-destination="/faq"
                >
                  FAQ
                </Link>
              </div>
              <ReviewProcessReassurance className="mt-6 border-emerald-400/25 bg-emerald-400/5 text-foreground [&_h3]:text-emerald-200 [&_li]:text-emerald-50/90 [&_p]:text-emerald-100/80" />
            </section>
          </div>
        </Section>
      </main>
    </HairAuditFiMarketingShell>
  );
}
