import Link from "next/link";

import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import PublicMarketingHero from "@/components/marketing/PublicMarketingHero";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import MedicalProcedureFaqSchema from "@/components/seo/MedicalProcedureFaqSchema";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { patientIssueLibrary } from "@/lib/patientEducationIssues";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { PATHWAY_CHOOSER_HREF } from "@/lib/patient/patientReviewPathway";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { cn } from "@/lib/utils";
import { Badge, Section, networkButtonVariants } from "@/packages/ui";

const faqs = [
  {
    question: "Are these real patient reports?",
    answer: "This library uses redacted and educational examples. Private patient data is not published.",
  },
  {
    question: "Why review examples first?",
    answer: "Examples help you understand report language, evidence limits, and how decisions are supported.",
  },
  {
    question: "Can examples predict my own outcome?",
    answer: "No. Every case is different. Examples show format and method, not personal medical outcomes.",
  },
];

export const metadata = createPageMetadata({
  title: "Audit Examples | HairAudit",
  description:
    "Explore educational audit examples, report sections, and patient concern guides to understand HairAudit methodology and trust signals.",
  pathname: "/audit-examples",
});

export default function AuditExamplesPage() {
  return (
    <HairAuditFiMarketingShell>
      <MedicalProcedureFaqSchema
        pageName="HairAudit Audit Examples Library"
        pageDescription="Educational library of report examples and patient concern explainers."
        faqs={faqs}
      />

      <main id="main-content" className="relative flex-1">
        <PublicMarketingHero
          badge="Examples library"
          title="Audit examples library"
          description="Review sample report structure and common concern guides before you begin your HairAudit. Built for trust, transparency, and plain-language clarity."
        />

        <Section className="border-t border-border/30">
          <article className="mx-auto max-w-4xl rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel sm:p-8">
            <Badge tone="neutral">Core report example</Badge>
            <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">Clinical Intelligence Report preview</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              See how a full analysis is organized: summary, evidence status, domain findings, and next-step context.
            </p>
            <div className="mt-5">
              <Link href="/demo-report" className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}>
                {PUBLIC_CTAS.viewSampleReport}
              </Link>
            </div>
          </article>
        </Section>

        <Section className="border-t border-border/30">
          <div className="mx-auto max-w-5xl space-y-6">
            <h2 className="font-display text-2xl font-semibold text-foreground">Patient concern guides</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {patientIssueLibrary.map((issue) => (
                <Link
                  key={issue.slug}
                  href={`/${issue.slug}`}
                  className="rounded-2xl border border-border/50 bg-card/70 p-5 transition hover:border-amber-400/40 shadow-fi-panel"
                >
                  <h3 className="font-semibold text-foreground">{issue.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{issue.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </Section>

        <Section className="border-t border-border/30">
          <div className="mx-auto max-w-4xl rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel sm:p-8">
            <h2 className="text-xl font-semibold text-foreground">Ready to begin your HairAudit?</h2>
            <p className="mt-3 text-muted-foreground">
              Upload photos and case details for independent analysis with a Clinical Intelligence Report.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href={PATHWAY_CHOOSER_HREF} className={fiHairauditPrimaryButtonClass("md")}>
                {PUBLIC_CTAS.startFreeHairAudit}
              </Link>
            </div>
            <ReviewProcessReassurance className="mt-6 border-emerald-400/25 bg-emerald-400/5 text-foreground [&_h3]:text-emerald-200 [&_li]:text-emerald-50/90 [&_p]:text-emerald-100/80" />
          </div>
        </Section>
      </main>
    </HairAuditFiMarketingShell>
  );
}
