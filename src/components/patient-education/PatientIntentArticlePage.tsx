import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import FaqPageSchema from "@/components/seo/FaqPageSchema";
import { getBaseUrl } from "@/lib/seo/baseUrl";
import { getPatientIntentArticle } from "@/lib/seo/patient-intent-articles";
import type { PatientIntentArticleBlock } from "@/lib/seo/patient-intent-articles/types";
import { resolvePatientGuideLink } from "@/lib/seo/resolvePatientGuideLink";
import { PatientEducationLinkedText } from "@/components/patient-education/PatientEducationLinkedText";
import { GeoKeyTakeaways, GeoShortAnswer } from "@/components/patient-education/GeoContentBlocks";

function ArticleBodyBlock({ block, guideSlug }: { block: PatientIntentArticleBlock; guideSlug: string }) {
  if (block.type === "p") {
    return (
      <p className="text-slate-300 leading-relaxed">
        <PatientEducationLinkedText text={block.text} guideSlug={guideSlug} />
      </p>
    );
  }
  if (block.type === "h3") {
    return <h3 className="text-lg font-semibold text-white mt-6 mb-2">{block.text}</h3>;
  }
  return (
    <ul className="mt-4 space-y-2 text-slate-300 list-none pl-0">
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
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
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

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1">
        <article
          className="px-4 sm:px-6 py-12 sm:py-16 lg:py-20"
          data-analytics-scope="patient-intent-guide"
          data-patient-guide={articleSlug}
        >
          <div className="max-w-3xl mx-auto">
            <nav className="mb-8" aria-label="Breadcrumb">
              <Link
                href="/"
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Home
              </Link>
              <span className="text-slate-600 mx-2">/</span>
              <Link
                href="/hair-transplant-problems"
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                data-cta="patient-guide-breadcrumb-hub"
                data-patient-guide={articleSlug}
                data-cta-destination="/hair-transplant-problems"
              >
                Patient guides
              </Link>
              <span className="text-slate-600 mx-2">/</span>
              <span className="text-slate-400 text-sm">{article.h1}</span>
            </nav>

            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Patient guide
            </p>
            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-[2.5rem] font-bold tracking-tight text-white leading-[1.15]">
              {article.h1}
            </h1>
            <p className="mt-6 text-lg text-slate-300 leading-relaxed">{article.intro}</p>
            {article.shortAnswer ? (
              <GeoShortAnswer>
                <PatientEducationLinkedText text={article.shortAnswer} guideSlug={articleSlug} />
              </GeoShortAnswer>
            ) : null}
            {article.keyTakeaways && article.keyTakeaways.length > 0 ? (
              <GeoKeyTakeaways items={article.keyTakeaways} />
            ) : null}

            <div
              className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5 sm:py-5"
              data-analytics-region="patient-guide-next-steps"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Next steps</p>
              <ul className="mt-3 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-x-1 sm:gap-y-2 text-sm text-slate-300">
                <li className="sm:after:content-['·'] sm:after:px-2 sm:after:text-slate-600 sm:last:after:content-none">
                  <Link
                    href="/request-review"
                    className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2"
                    data-cta="patient-guide-next-request-review"
                    data-cta-destination="/request-review"
                    data-patient-guide={articleSlug}
                  >
                    Request a hair transplant audit
                  </Link>
                </li>
                <li className="sm:after:content-['·'] sm:after:px-2 sm:after:text-slate-600 sm:last:after:content-none">
                  <Link
                    href="/sample-report"
                    className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2"
                    data-cta="patient-guide-next-sample-report"
                    data-cta-destination="/sample-report"
                    data-patient-guide={articleSlug}
                  >
                    Sample hair transplant audit report
                  </Link>
                </li>
                <li className="sm:after:content-['·'] sm:after:px-2 sm:after:text-slate-600 sm:last:after:content-none">
                  <Link
                    href="/faq"
                    className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2"
                    data-cta="patient-guide-next-faq"
                    data-cta-destination="/faq"
                    data-patient-guide={articleSlug}
                  >
                    Hair transplant audit FAQ
                  </Link>
                </li>
                <li>
                  <Link
                    href="/hair-transplant-problems"
                    className="text-slate-400 hover:text-slate-200 underline underline-offset-2"
                    data-cta="patient-guide-next-hub"
                    data-cta-destination="/hair-transplant-problems"
                    data-patient-guide={articleSlug}
                  >
                    All patient guides
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="max-w-3xl mx-auto mt-12 space-y-14 sm:space-y-16">
            {article.sections.map((section) => (
              <section
                key={section.heading}
                id={section.id}
                className="scroll-mt-24 border-t border-white/10 pt-10 sm:pt-12"
              >
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {section.heading}
                </h2>
                <div className="mt-6 space-y-4">
                  {section.blocks.map((block, i) => (
                    <ArticleBodyBlock key={i} block={block} guideSlug={articleSlug} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="max-w-3xl mx-auto mt-16 sm:mt-20">
            <div
              className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-500/10 to-transparent p-6 sm:p-8"
              data-analytics-region="patient-guide-primary-cta"
            >
              <h2 className="text-xl font-semibold text-white">
                {article.ctaLead ?? "Independent review on HairAudit"}
              </h2>
              <p className="mt-3 text-slate-300 leading-relaxed">
                {article.ctaSupporting ??
                  "If you want a structured, evidence-based read of your photos and timeline—independent of clinic marketing—submit your case for review. You can also view a sample report or read the FAQ first."}
              </p>
              <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
                <Link
                  href="/request-review"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
                  data-cta="patient-guide-cta-request-review"
                  data-cta-destination="/request-review"
                  data-patient-guide={articleSlug}
                >
                  Request a hair transplant audit
                </Link>
                <Link
                  href="/sample-report"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                  data-cta="patient-guide-cta-sample-report"
                  data-cta-destination="/sample-report"
                  data-patient-guide={articleSlug}
                >
                  Sample hair transplant audit report
                </Link>
                <Link
                  href="/faq"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                  data-cta="patient-guide-cta-faq"
                  data-cta-destination="/faq"
                  data-patient-guide={articleSlug}
                >
                  Hair transplant audit FAQ
                </Link>
              </div>
              <ReviewProcessReassurance className="mt-6" />
            </div>
          </div>

          {related.length > 0 ? (
            <div
              className="max-w-3xl mx-auto mt-12 sm:mt-14"
              data-analytics-region="patient-guide-related-guides"
            >
              <h2 className="text-lg font-semibold text-white">Related guides</h2>
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
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{a.metaDescription}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div
            className="max-w-3xl mx-auto mt-12 sm:mt-14 pb-8"
            data-analytics-region="patient-guide-footer-links"
          >
            <h2 className="text-lg font-semibold text-white">More on HairAudit</h2>
            <ul className="mt-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 text-sm">
              <li>
                <Link
                  href="/how-it-works"
                  className="text-slate-400 hover:text-slate-200"
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
                  className="text-slate-400 hover:text-slate-200"
                  data-cta="patient-guide-footer-methodology"
                  data-patient-guide={articleSlug}
                  data-cta-destination="/methodology"
                >
                  Hair transplant audit methodology
                </Link>
              </li>
              <li>
                <Link
                  href="/hair-transplant-problems"
                  className="text-slate-400 hover:text-slate-200"
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
      </main>

      <SiteFooter />
    </div>
  );
}
