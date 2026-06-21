import Link from "next/link";
import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import PublicTrustArchitectureBlock from "@/components/marketing/PublicTrustArchitectureBlock";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import MedicalProcedureFaqSchema from "@/components/seo/MedicalProcedureFaqSchema";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import { resolvePatientGuideLink } from "@/lib/seo/resolvePatientGuideLink";
import { PatientEducationLinkedText } from "@/components/patient-education/PatientEducationLinkedText";
import {
  GeoContextLine,
  GeoPhotosCannotConfirm,
  GeoShortAnswer,
} from "@/components/patient-education/GeoContentBlocks";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { PATHWAY_CHOOSER_HREF } from "@/lib/patient/patientReviewPathway";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { Badge, Section, networkButtonVariants } from "@/packages/ui";
import { cn } from "@/lib/utils";

type FAQItem = {
  question: string;
  answer: string;
};

type IssueEducationPageProps = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  shortAnswer?: string;
  whatThisPageExplains?: string;
  photosCannotConfirm?: string[];
  explanations: string[];
  summaryPoints: string[];
  seekReviewPoints: string[];
  faqs: FAQItem[];
  /** Long-form guides and related issue slugs for anti-cannibalization cross-links */
  relatedGuideSlugs?: string[];
};

export default function IssueEducationPage({
  slug,
  title,
  description,
  intro,
  shortAnswer,
  whatThisPageExplains,
  photosCannotConfirm,
  explanations,
  summaryPoints,
  seekReviewPoints,
  faqs,
  relatedGuideSlugs = [],
}: IssueEducationPageProps) {
  const relatedGuides = relatedGuideSlugs
    .map((s) => resolvePatientGuideLink(s))
    .filter((r): r is NonNullable<typeof r> => r != null);
  const issuePath = slug.startsWith("/") ? slug : `/${slug}`;
  return (
    <HairAuditFiMarketingShell>
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "Patient guides", pathname: "/hair-transplant-problems" },
          { name: title, pathname: issuePath },
        ]}
      />
      <MedicalProcedureFaqSchema pageName={title} pageDescription={description} faqs={faqs} />


      <main id="main-content" className="relative flex-1">
        <Section className="pt-10 sm:pt-14">
        <div className="mx-auto max-w-4xl">
          <nav className="mb-8" aria-label="Breadcrumb">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              Home
            </Link>
            <span className="mx-2 text-muted-foreground">/</span>
            <Link href="/hair-transplant-problems" className="text-sm text-muted-foreground hover:text-foreground">
              Patient guides
            </Link>
            <span className="mx-2 text-muted-foreground">/</span>
            <span className="text-sm text-foreground">{title}</span>
          </nav>
          <Badge tone="accent">Patient education</Badge>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl leading-relaxed text-muted-foreground">
            <PatientEducationLinkedText text={intro} guideSlug="" />
          </p>
          {shortAnswer ? (
            <GeoShortAnswer spacing="tight">
              <PatientEducationLinkedText text={shortAnswer} guideSlug="" />
            </GeoShortAnswer>
          ) : null}
          {whatThisPageExplains ? (
            <GeoContextLine label="What this page helps explain" variant="inline">
              <PatientEducationLinkedText text={whatThisPageExplains} guideSlug="" />
            </GeoContextLine>
          ) : null}
          {photosCannotConfirm && photosCannotConfirm.length > 0 ? (
            <GeoPhotosCannotConfirm items={photosCannotConfirm} density="compact" />
          ) : null}
          <PublicTrustArchitectureBlock surface="fi" className="mt-6" />

          {relatedGuides.length > 0 ? (
            <section className="mt-8 rounded-2xl border border-border/50 bg-card/60 p-6">
              <h2 className="text-lg font-semibold text-foreground">Related guides</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Deeper education on the same topic—structured to avoid repeating this short overview.
              </p>
              <ul className="mt-4 space-y-3">
                {relatedGuides.map((g) => (
                  <li key={g.pathname}>
                    <Link
                      href={g.pathname}
                      className="font-medium text-amber-400 underline underline-offset-2 hover:text-amber-300"
                      data-cta="issue-page-related-guide"
                      data-cta-destination={g.pathname}
                    >
                      {g.h1}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{g.metaDescription}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-10 rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel">
            <h2 className="text-xl font-semibold text-foreground">Clear explanation</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              {explanations.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel">
            <h2 className="text-xl font-semibold text-foreground">Quick summary</h2>
            <ul className="mt-4 space-y-2 text-muted-foreground">
              {summaryPoints.map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="shrink-0 text-amber-400">—</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-6">
            <h2 className="text-xl font-semibold text-foreground">When independent analysis helps</h2>
            <ul className="mt-4 space-y-2 text-muted-foreground">
              {seekReviewPoints.map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="shrink-0 text-amber-400">—</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8 rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel">
            <h2 className="text-xl font-semibold text-foreground">Need independent analysis?</h2>
            <p className="mt-3 text-muted-foreground">
              HairAudit can review your photos and case timeline, then explain findings in plain language.
            </p>
            <div className="mt-6 flex flex-col flex-wrap gap-4 sm:flex-row">
              <Link href={PATHWAY_CHOOSER_HREF} className={fiHairauditPrimaryButtonClass("md")}>
                {PUBLIC_CTAS.startFreeHairAudit}
              </Link>
              <Link href="/demo-report" className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}>
                {PUBLIC_CTAS.viewSampleReport}
              </Link>
              <Link href="/audit-examples" className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}>
                Audit examples
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              <Link href="/hair-transplant-problems" className="text-amber-400 hover:text-amber-300">
                All patient guides
              </Link>
              {" · "}
              <Link href="/hair-transplant-second-opinion-vs-clinic-opinion" className="text-amber-400 hover:text-amber-300">
                Independent analysis vs clinic opinion
              </Link>
              {" · "}
              <Link href="/methodology" className="text-amber-400 hover:text-amber-300">
                Methodology
              </Link>
            </p>
            <ReviewProcessReassurance className="mt-6 border-emerald-400/25 bg-emerald-400/5 text-foreground [&_h3]:text-emerald-200 [&_li]:text-emerald-50/90 [&_p]:text-emerald-100/80" />
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-semibold text-foreground">Common questions</h2>
            <div className="mt-4 space-y-4">
              {faqs.map((faq) => (
                <div key={faq.question} className="rounded-xl border border-border/50 bg-card/60 p-4">
                  <h3 className="font-semibold text-foreground">{faq.question}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
        </Section>
      </main>
    </HairAuditFiMarketingShell>
  );
}
