import Link from "next/link";
import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import PatientPathwayChooser from "@/components/marketing/PatientPathwayChooser";
import PatientPhotoChecklist from "@/components/marketing/PatientPhotoChecklist";
import PatientTrustPointsBlock from "@/components/marketing/PatientTrustPointsBlock";
import PublicTrustArchitectureBlock from "@/components/marketing/PublicTrustArchitectureBlock";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import MedicalProcedureFaqSchema from "@/components/seo/MedicalProcedureFaqSchema";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import TrackedLink from "@/components/analytics/TrackedLink";
import { GeoContextLine } from "@/components/patient-education/GeoContentBlocks";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import {
  PUBLIC_AUDIT_FLOW_STEPS,
  PUBLIC_CTAS,
} from "@/lib/marketing/publicMarketingCopy";
import { cn } from "@/lib/utils";
import { Badge, FeatureGrid, Section, networkButtonVariants } from "@/packages/ui";

export const metadata = createPageMetadata({
  title: "Begin Independent HairAudit | Secure Upload | HairAudit",
  description:
    "Upload your images and receive an independent evidence-led hair restoration analysis with a Clinical Intelligence Report.",
  pathname: "/request-review",
});

const requestFaqs = [
  {
    question: "How long does the upload take?",
    answer: "Most people finish in about 6 to 8 minutes if photos are ready. You can add missing details later.",
  },
  {
    question: "What do I need before I start?",
    answer:
      "Useful photos include the front hairline, left and right sides, top or crown, donor area, and early post-op photos if you have them. Graft counts or clinic papers also help when available.",
  },
  {
    question: "Is HairAudit independent from clinics?",
    answer: "Yes. HairAudit is independent and does not sell surgery, clinic referrals, or promotional placements.",
  },
];

export default function RequestReviewPage() {
  return (
    <HairAuditFiMarketingShell>
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "Begin Independent HairAudit", pathname: "/request-review" },
        ]}
      />
      <MedicalProcedureFaqSchema
        pageName="Begin Independent HairAudit"
        pageDescription="Upload images for independent hair restoration analysis and a Clinical Intelligence Report."
        faqs={requestFaqs}
      />

      <main id="main-content" className="relative flex-1 pb-28 lg:pb-0">
        <Section className="pt-10 sm:pt-14">
          <div className="mx-auto max-w-4xl space-y-6">
            <Badge tone="accent">Independent Analysis</Badge>
            <div className="space-y-4">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Begin Independent HairAudit
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Upload your images and receive an independent evidence-led hair restoration analysis.
              </p>
            </div>
            <PublicTrustArchitectureBlock surface="fi" />
            <div id="choose-pathway" className="scroll-mt-28 space-y-4">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {PUBLIC_CTAS.chooseYourReviewType}
              </h2>
              <PatientPathwayChooser className="mt-2" />
            </div>
            <div className="flex flex-col flex-wrap gap-3 sm:flex-row">
              <TrackedLink
                href="/demo-report"
                eventName="cta_view_sample_report_request_review_primary"
                className={cn(networkButtonVariants({ variant: "secondary", size: "lg" }))}
              >
                {PUBLIC_CTAS.viewSampleReport}
              </TrackedLink>
            </div>
          </div>
        </Section>

        <Section className="border-t border-border/30">
          <div className="space-y-8">
            <div className="max-w-3xl space-y-3">
              <Badge tone="neutral">How it works</Badge>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Four steps to your Clinical Intelligence Report
              </h2>
            </div>
            <FeatureGrid columnsClassName="md:grid-cols-2 lg:grid-cols-4">
              {PUBLIC_AUDIT_FLOW_STEPS.map(({ title, body }, index) => (
                <article
                  key={title}
                  className="rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </article>
              ))}
            </FeatureGrid>
          </div>
        </Section>

        <Section className="border-t border-border/30">
          <div className="mx-auto max-w-4xl space-y-8">
            <PatientTrustPointsBlock className="border-border/40 bg-card/60" />
            <PatientPhotoChecklist surface="fi" />
            <ReviewProcessReassurance className="border-emerald-400/25 bg-emerald-400/5 text-foreground [&_h3]:text-emerald-200 [&_li]:text-emerald-50/90 [&_p]:text-emerald-100/80" />
            <GeoContextLine label="What this page is for">
              <p>
                This is the patient audit path: upload images and add the evidence you have. Longer education and
                photo guidance live in the{" "}
                <Link href="/hair-transplant-problems" className="font-medium text-amber-400 hover:text-amber-300">
                  patient guides hub
                </Link>
                ; framework and limits are on{" "}
                <Link href="/methodology" className="font-medium text-amber-400 hover:text-amber-300">
                  methodology
                </Link>
                .
              </p>
            </GeoContextLine>
          </div>
        </Section>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/40 bg-background/95 px-4 py-3 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-4xl">
          <PatientPathwayChooser layout="hero" className="justify-center" />
        </div>
      </div>
    </HairAuditFiMarketingShell>
  );
}
