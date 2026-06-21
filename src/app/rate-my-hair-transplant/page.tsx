import Link from "next/link";
import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import PublicMarketingCtaPanel from "@/components/marketing/PublicMarketingCtaPanel";
import PublicMarketingHero from "@/components/marketing/PublicMarketingHero";
import RateMyHairTransplantClient from "@/components/community/RateMyHairTransplantClient";
import ScrollReveal from "@/components/ui/ScrollReveal";
import HairAuditScoreVisual from "@/components/seo/HairAuditScoreVisual";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import MedicalProcedureFaqSchema from "@/components/seo/MedicalProcedureFaqSchema";
import { validationFunnelPages } from "@/lib/validationFunnelPages";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { cn } from "@/lib/utils";
import { Section, networkButtonVariants } from "@/packages/ui";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

const faqs = [
  {
    question: "What do I need for this post-surgery review pathway?",
    answer:
      "At least one before-surgery photo, at least one after-surgery or current photo, and (recommended) approximately how many months since your procedure. Together they support a structured before-and-after comparison.",
  },
  {
    question: "Is this the same as a full HairAudit Clinical Intelligence Report?",
    answer:
      "No. This pathway offers a lighter before-and-after snapshot. Start Post-Surgery Audit or Start Free HairAudit when you want structured intake, independent analysis, and a documented Clinical Intelligence Report.",
  },
  {
    question: "Can I share my summary online?",
    answer:
      "Yes. Share your summary card and crop or hide identifying details in any before-and-after photos you post.",
  },
];

export const metadata = createPageMetadata({
  title: "Post-Surgery Hair Transplant Review | Independent Analysis | HairAudit",
  description:
    "Independent post-surgery hair transplant review: compare before and after photos with structured clinical intelligence guidance—not a simplistic rating or guaranteed judgement.",
  pathname: "/rate-my-hair-transplant",
});

export default function RateMyHairTransplantPage() {
  return (
    <HairAuditFiMarketingShell>
      <MedicalProcedureFaqSchema
        pageName="Post-Surgery Hair Transplant Review"
        pageDescription="Compares before-surgery photos with after-surgery or current photos for independent post-surgery analysis."
        faqs={faqs}
      />

      <main id="main-content" className="relative flex-1">
        <PublicMarketingHero
          badge="Post-surgery pathway"
          title="Independent post-surgery review—not a casual rating"
          description={
            <>
              Add <strong className="font-medium text-foreground">before-surgery photos</strong>,{" "}
              <strong className="font-medium text-foreground">after-surgery or current photos</strong>,
              and approximately how long it has been since your procedure. You receive structured
              before-and-after guidance—not a simplistic score or guaranteed judgement. For full
              independent analysis, use{" "}
              <Link
                href="/request-review"
                className="font-medium text-amber-400 hover:text-amber-300"
              >
                Start Post-Surgery Audit
              </Link>
              .
            </>
          }
        >
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/request-review" className={fiHairauditPrimaryButtonClass("lg")}>
              {PUBLIC_CTAS.startPostSurgeryAudit}
            </Link>
            <Link
              href="/request-review"
              className={cn(networkButtonVariants({ variant: "secondary", size: "lg" }))}
            >
              {PUBLIC_CTAS.startFreeHairAudit}
            </Link>
          </div>
        </PublicMarketingHero>

        <Section className="border-t border-border/30">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel">
                  <h2 className="text-xl font-semibold text-foreground text-balance">
                    What this pathway examines
                  </h2>
                  <ul className="mt-4 space-y-2 text-muted-foreground text-pretty break-words">
                    <li>How before-surgery photos compare to after-surgery or current photos</li>
                    <li>Hairline design and natural appearance visible in those photos</li>
                    <li>Density and placement suggested by the photos you upload</li>
                    <li>Donor area where visible, read alongside time since surgery</li>
                  </ul>
                  <p className="mt-4 text-sm text-muted-foreground text-pretty break-words">
                    This is a lighter pathway. For structured independent analysis and a Clinical
                    Intelligence Report, use{" "}
                    <Link
                      href="/request-review"
                      className="font-medium text-amber-400 hover:text-amber-300"
                    >
                      Start Post-Surgery Audit
                    </Link>
                    .
                  </p>
                </div>
                <HairAuditScoreVisual score={88} label="Example summary tone" />
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.08}>
              <div className="mt-8">
                <RateMyHairTransplantClient />
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.085}>
              <section className="mt-6 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 to-card/80 p-6 sm:p-7 shadow-fi-panel">
                <h2 className="text-xl font-semibold text-foreground text-balance">
                  Want documented independent analysis?
                </h2>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted-foreground text-pretty break-words">
                  When detail and credibility matter, Start Post-Surgery Audit provides fuller intake,
                  consistent methodology, and a Clinical Intelligence Report you can use with your
                  clinician. Use this page for a lighter snapshot; use the full pathway when you need
                  depth.
                </p>
                <Link
                  href="/request-review"
                  className={cn(fiHairauditPrimaryButtonClass("md"), "mt-5 inline-flex")}
                >
                  {PUBLIC_CTAS.startPostSurgeryAudit}
                </Link>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.09}>
              <section className="mt-6 rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel">
                <h2 className="text-xl font-semibold text-foreground text-balance">What happens next</h2>
                <ol className="mt-4 space-y-2 text-muted-foreground text-sm text-pretty break-words">
                  <li>
                    Upload before-surgery photos, after-surgery or current photos, and months since
                    procedure.
                  </li>
                  <li>HairAudit structures your before-and-after set for review.</li>
                  <li>You see a compact summary—lighter than the full Clinical Intelligence Report pathway.</li>
                  <li>
                    Optional: download or share your card. For full analysis,{" "}
                    <Link
                      href="/request-review"
                      className="font-medium text-amber-400 hover:text-amber-300"
                    >
                      Start Post-Surgery Audit
                    </Link>
                    .
                  </li>
                </ol>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <section className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-6">
                <h2 className="text-xl font-semibold text-cyan-100 text-balance">
                  Share with privacy in mind
                </h2>
                <p className="mt-3 text-cyan-50/90 text-pretty break-words">
                  If you post online, lead with the summary card and keep identifying details out of
                  photos you share.
                </p>
                <ul className="mt-4 space-y-2 text-cyan-50/90 text-pretty break-words">
                  <li>Crop or hide face and tattoos before posting before-and-after photos.</li>
                  <li>Share summary highlights, not full private report details.</li>
                  <li>Keep procedure dates and private clinic notes confidential.</li>
                </ul>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <section className="mt-8">
                <h2 className="text-xl font-semibold text-foreground">Explore education pages</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Link
                    href="/is-my-hair-transplant-normal"
                    className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-fi-panel hover:border-emerald-300/60 transition-colors"
                  >
                    <h3 className="font-semibold text-foreground">Is My Hair Transplant Normal?</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      What may still be normal, what can look worse before it looks better, and when
                      review may help.
                    </p>
                  </Link>
                  {validationFunnelPages.map((page) => (
                    <Link
                      key={page.slug}
                      href={`/${page.slug}`}
                      className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-fi-panel hover:border-emerald-300/60 transition-colors"
                    >
                      <h3 className="font-semibold text-foreground">{page.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
                    </Link>
                  ))}
                </div>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <section className="mt-8 rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel">
                <h2 className="text-xl font-semibold text-foreground">Still deciding?</h2>
                <p className="mt-3 text-muted-foreground text-pretty break-words">
                  Use the form above for a lighter before-and-after snapshot. When you need independent
                  reassurance with structured documentation,{" "}
                  <Link
                    href="/request-review"
                    className="font-medium text-amber-400 hover:text-amber-300"
                  >
                    Start Post-Surgery Audit
                  </Link>
                  .
                </p>
                <ReviewProcessReassurance className="mt-6" />
              </section>
            </ScrollReveal>
          </div>
        </Section>

        <PublicMarketingCtaPanel
          title="Ready for full independent analysis?"
          description="Start Post-Surgery Audit for a Clinical Intelligence Report, or preview a sample report first."
          actions={[
            {
              href: "/request-review",
              label: PUBLIC_CTAS.startPostSurgeryAudit,
              variant: "primary",
              eventName: "cta_start_post_surgery_audit_rate_my",
              useStartFreeAuditButton: true,
            },
            {
              href: "/demo-report",
              label: PUBLIC_CTAS.viewSampleReport,
              variant: "secondary",
              eventName: "cta_view_sample_report_rate_my",
            },
          ]}
        />
      </main>
    </HairAuditFiMarketingShell>
  );
}
