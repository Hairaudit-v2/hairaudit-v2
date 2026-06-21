import Link from "next/link";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { PATHWAY_CHOOSER_HREF } from "@/lib/patient/patientReviewPathway";
import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import PublicTrustArchitectureBlock from "@/components/marketing/PublicTrustArchitectureBlock";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import FaqPageSchema from "@/components/seo/FaqPageSchema";
import { getBaseUrl } from "@/lib/seo/baseUrl";
import { getPatientIntentArticle } from "@/lib/seo/patient-intent-articles";
import type { PatientIntentArticleBlock } from "@/lib/seo/patient-intent-articles/types";
import { resolvePatientGuideLink } from "@/lib/seo/resolvePatientGuideLink";
import { PatientEducationLinkedText } from "@/components/patient-education/PatientEducationLinkedText";
import { GeoKeyTakeaways, GeoShortAnswer } from "@/components/patient-education/GeoContentBlocks";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { cn } from "@/lib/utils";
import { Badge, Section, networkButtonVariants } from "@/packages/ui";

function ArticleBodyBlock({ block, guideSlug }: { block: PatientIntentArticleBlock; guideSlug: string }) {
  if (block.type === "p") {
    return (
      <p className="leading-relaxed text-muted-foreground">
        <PatientEducationLinkedText text={block.text} guideSlug={guideSlug} />
      </p>
    );
  }
  if (block.type === "h3") {
    return <h3 className="mb-2 mt-6 text-lg font-semibold text-foreground">{block.text}</h3>;
  }
  return (
    <ul className="mt-4 list-none space-y-2 pl-0 text-muted-foreground">
      {block.items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="text-amber-400 shrink-0">-</span>
          <span className="leading-relaxed">
            <PatientEducationLinkedText text={item} guideSlug={guideSlug} />
          </span>
        </li>
      ))}
    </ul>
  );
}

type PatientIntentArticlePageProps = {
  articleSlug: string;
};

export default function PatientIntentArticlePage({ articleSlug }: PatientIntentArticlePageProps) {
  const article = getPatientIntentArticle(articleSlug);
  if (!article) return null;

  const related = article.relatedSlugs
    .map((slug) => resolvePatientGuideLink(slug))
    .filter((r): r is NonNullable<typeof r> => r != null);

  const baseUrl = getBaseUrl();
  const articleUrl = `${baseUrl}${article.pathname}`;
  const logoUrl = `${baseUrl}/hairaudit-logo.svg`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.h1,
    description: article.metaDescription,
    url: articleUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    inLanguage: "en",
    author: {
      "@type": "Organization",
      name: "HairAudit",
      url: baseUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "HairAudit",
      url: baseUrl,
      logo: {
        "@type": "ImageObject",
        url: logoUrl,
      },
    },
  };

  return (
    <HairAuditFiMarketingShell>
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "Patient guides", pathname: "/hair-transplant-problems" },
          { name: article.h1, pathname: article.pathname },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FaqPageSchema faqs={article.faqs} />


      <main id="main-content" className="relative flex-1">
        <Section className="pt-10 sm:pt-14">
        <article
          data-analytics-scope="patient-intent-guide"
          data-patient-guide={articleSlug}
        >
          <div className="mx-auto max-w-3xl">
            <nav className="mb-8" aria-label="Breadcrumb">
              <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Home
              </Link>
              <span className="mx-2 text-muted-foreground">/</span>
              <Link
                href="/hair-transplant-problems"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                data-cta="patient-guide-breadcrumb-hub"
                data-patient-guide={articleSlug}
                data-cta-destination="/hair-transplant-problems"
              >
                Patient guides
              </Link>
              <span className="mx-2 text-muted-foreground">/</span>
              <span className="text-sm text-foreground">{article.h1}</span>
            </nav>

            <Badge tone="accent">Patient guide</Badge>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.15] tracking-tight text-foreground sm:text-4xl lg:text-[2.5rem]">
              {article.h1}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{article.intro}</p>
            {article.shortAnswer ? (
              <GeoShortAnswer spacing="tight">
                <PatientEducationLinkedText text={article.shortAnswer} guideSlug={articleSlug} />
              </GeoShortAnswer>
            ) : null}

            <div
              className="mt-6 rounded-2xl border border-border/50 bg-card/60 px-4 py-4 sm:px-5 sm:py-5"
              data-analytics-region="patient-guide-next-steps"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next steps</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-1 sm:gap-y-2">
                <li className="sm:after:px-2 sm:after:text-muted-foreground sm:after:content-['·'] sm:last:after:content-none">
                  <Link
                    href={PATHWAY_CHOOSER_HREF}
                    className="font-medium text-amber-400 underline underline-offset-2 hover:text-amber-300"
                    data-cta="patient-guide-next-request-review"
                    data-cta-destination="/request-review"
                    data-patient-guide={articleSlug}
                  >
                    {PUBLIC_CTAS.startFreeHairAudit}
                  </Link>
                </li>
                <li className="sm:after:px-2 sm:after:text-muted-foreground sm:after:content-['·'] sm:last:after:content-none">
                  <Link
                    href="/demo-report"
                    className="font-medium text-amber-400 underline underline-offset-2 hover:text-amber-300"
                    data-cta="patient-guide-next-sample-report"
                    data-cta-destination="/demo-report"
                    data-patient-guide={articleSlug}
                  >
                    {PUBLIC_CTAS.viewSampleReport}
                  </Link>
                </li>
                <li className="sm:after:px-2 sm:after:text-muted-foreground sm:after:content-['·'] sm:last:after:content-none">
                  <Link
                    href="/faq"
                    className="font-medium text-amber-400 underline underline-offset-2 hover:text-amber-300"
                    data-cta="patient-guide-next-faq"
                    data-cta-destination="/faq"
                    data-patient-guide={articleSlug}
                  >
                    HairAudit FAQ
                  </Link>
                </li>
                <li>
                  <Link
                    href="/hair-transplant-problems"
                    className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    data-cta="patient-guide-next-hub"
                    data-cta-destination="/hair-transplant-problems"
                    data-patient-guide={articleSlug}
                  >
                    All patient guides
                  </Link>
                </li>
              </ul>
            </div>

            {article.keyTakeaways && article.keyTakeaways.length > 0 ? (
              <GeoKeyTakeaways items={article.keyTakeaways} spacing="tight" />
            ) : null}
            <PublicTrustArchitectureBlock surface="fi" className="mt-6" />
          </div>

          <div className="mx-auto mt-12 max-w-3xl space-y-14 sm:space-y-16">
            {article.sections.map((section) => (
              <section
                key={section.heading}
                id={section.id}
                className="scroll-mt-24 border-t border-border/40 pt-10 sm:pt-12"
              >
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{section.heading}</h2>
                <div className="mt-6 space-y-4">
                  {section.blocks.map((block, i) => (
                    <ArticleBodyBlock key={i} block={block} guideSlug={articleSlug} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mx-auto mt-16 max-w-3xl sm:mt-20">
            <div
              className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/10 to-transparent p-6 sm:p-8"
              data-analytics-region="patient-guide-primary-cta"
            >
              <h2 className="text-xl font-semibold text-foreground">
                {article.ctaLead ?? "Independent analysis on HairAudit"}
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {article.ctaSupporting ??
                  "If you want a structured, evidence-led read of your photos and timeline—independent of clinic marketing—begin your free HairAudit. You can also view a sample report or read the FAQ first."}
              </p>
              <div className="mt-6 flex flex-col flex-wrap gap-3 sm:flex-row">
                <Link
                  href={PATHWAY_CHOOSER_HREF}
                  className={fiHairauditPrimaryButtonClass("md")}
                  data-cta="patient-guide-cta-request-review"
                  data-cta-destination="/request-review"
                  data-patient-guide={articleSlug}
                >
                  {PUBLIC_CTAS.startFreeHairAudit}
                </Link>
                <Link
                  href="/demo-report"
                  className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
                  data-cta="patient-guide-cta-sample-report"
                  data-cta-destination="/demo-report"
                  data-patient-guide={articleSlug}
                >
                  {PUBLIC_CTAS.viewSampleReport}
                </Link>
                <Link
                  href="/faq"
                  className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
                  data-cta="patient-guide-cta-faq"
                  data-cta-destination="/faq"
                  data-patient-guide={articleSlug}
                >
                  HairAudit FAQ
                </Link>
              </div>
              <ReviewProcessReassurance className="mt-6 border-emerald-400/25 bg-emerald-400/5 text-foreground [&_h3]:text-emerald-200 [&_li]:text-emerald-50/90 [&_p]:text-emerald-100/80" />
            </div>
          </div>

          {related.length > 0 ? (
            <div
              className="max-w-3xl mx-auto mt-12 sm:mt-14"
              data-analytics-region="patient-guide-related-guides"
            >
              <h2 className="text-lg font-semibold text-foreground">Related guides</h2>
              <ul className="mt-4 space-y-3">
                {related.map((a) => (
                  <li key={a.pathname}>
                    <Link
                      href={a.pathname}
                      className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2"
                      data-cta="patient-guide-related"
                      data-patient-guide={articleSlug}
                      data-related-guide={a.pathname.replace(/^\//, "")}
                      data-cta-destination={a.pathname}
                    >
                      {a.h1}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.metaDescription}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div
            className="max-w-3xl mx-auto mt-12 sm:mt-14 pb-8"
            data-analytics-region="patient-guide-footer-links"
          >
            <h2 className="text-lg font-semibold text-foreground">More on HairAudit</h2>
            <ul className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap">
              <li>
                <Link
                  href="/how-it-works"
                  className="text-muted-foreground hover:text-foreground"
                  data-cta="patient-guide-footer-how-it-works"
                  data-patient-guide={articleSlug}
                  data-cta-destination="/how-it-works"
                >
                  How hair transplant audits work
                </Link>
              </li>
              <li>
                <Link
                  href="/methodology"
                  className="text-muted-foreground hover:text-foreground"
                  data-cta="patient-guide-footer-methodology"
                  data-patient-guide={articleSlug}
                  data-cta-destination="/methodology"
                >
                  Methodology
                </Link>
              </li>
              <li>
                <Link
                  href="/hair-transplant-problems"
                  className="text-muted-foreground hover:text-foreground"
                  data-cta="patient-guide-footer-hub"
                  data-patient-guide={articleSlug}
                  data-cta-destination="/hair-transplant-problems"
                >
                  Patient guides hub
                </Link>
              </li>
            </ul>
          </div>
        </article>
        </Section>
      </main>
    </HairAuditFiMarketingShell>
  );
}
