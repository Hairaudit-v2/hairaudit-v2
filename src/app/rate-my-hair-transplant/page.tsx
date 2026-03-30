import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import HairAuditScoreVisual from "@/components/seo/HairAuditScoreVisual";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import MedicalProcedureFaqSchema from "@/components/seo/MedicalProcedureFaqSchema";
import { validationFunnelPages } from "@/lib/validationFunnelPages";
import RateMyHairTransplantClient from "@/components/community/RateMyHairTransplantClient";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

const faqs = [
  {
    question: "What do I need for this quick review?",
    answer:
      "At least one before surgery photo, at least one after surgery / current photo, and (recommended) approximately how many months since your procedure. Together they power a clear before-and-after comparison.",
  },
  {
    question: "Is this the same as a full HairAudit quality review?",
    answer:
      "No. This page is a fast, AI-assisted before-and-after snapshot. Request a formal HairAudit quality review when you want structured intake, a thorough review, and a shareable score for more serious use.",
  },
  {
    question: "Can I share my score online?",
    answer:
      "Yes. Share your summary card and crop or hide identifying details in any before-and-after photos you post.",
  },
];

export const metadata = createPageMetadata({
  title: "Before & After Hair Transplant Review (Fast AI) | HairAudit",
  description:
    "Fast before-and-after hair transplant read: before surgery photos, after surgery / current photos, and approximate time since your procedure. Get a rapid HairAudit-style outcome summary.",
  pathname: "/rate-my-hair-transplant",
});

export default function RateMyHairTransplantPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <MedicalProcedureFaqSchema
        pageName="Before & After Hair Transplant Review (Fast AI)"
        pageDescription="Compares before surgery photos with after surgery / current photos, with approximate time since surgery, for a quick read."
        faqs={faqs}
      />

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1 px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight text-balance">
              Fast AI review: your before-and-after transplant result
            </h1>
            <p className="mt-5 text-slate-300 max-w-3xl leading-relaxed text-pretty break-words">
              Add <strong className="font-medium text-slate-200">before surgery photos</strong> (your
              starting point),{" "}
              <strong className="font-medium text-slate-200">after surgery / current photos</strong>{" "}
              (how you look now), and{" "}
              <strong className="font-medium text-slate-200">approximately how long it has been</strong>{" "}
              since your procedure. You get a rapid, reassuring AI-assisted before-and-after outcome
              summary—not the in-depth structured review on{" "}
              <Link
                href="/request-review"
                className="text-amber-200 hover:text-amber-100 underline-offset-2 hover:underline rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Request a formal HairAudit quality review
              </Link>
              .
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <section className="mt-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-white text-balance">
                  What this rapid outcome summary looks at
                </h2>
                <ul className="mt-4 space-y-2 text-slate-300 text-pretty break-words">
                  <li>- How your before surgery photos compare to your after surgery / current photos</li>
                  <li>- Hairline design and natural appearance visible in those before-and-after photos</li>
                  <li>- Density and placement suggested by the after surgery / current photos you upload</li>
                  <li>- Donor area where it appears in frame, read alongside approximate time since surgery</li>
                </ul>
                <p className="mt-4 text-sm text-slate-300 text-pretty break-words">
                  You receive a compact HairAudit-style breakdown—Hairline Design, Density, Donor
                  Preservation, Naturalness, and Overall Score—for this pathway. The full structured route
                  is{" "}
                  <Link
                    href="/request-review"
                    className="text-amber-200 hover:text-amber-100 underline-offset-2 hover:underline rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                  >
                    Request a formal HairAudit quality review
                  </Link>
                  .
                </p>
              </div>
              <HairAuditScoreVisual score={88} label="Example summary tone" />
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.08}>
            <RateMyHairTransplantClient />
          </ScrollReveal>

          <ScrollReveal delay={0.085}>
            <section className="mt-6 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 to-white/5 p-6 sm:p-7">
              <h2 className="text-xl font-semibold text-amber-100 text-balance">
                Want objective confirmation and a shareable formal score?
              </h2>
              <p className="mt-3 text-slate-200 text-sm sm:text-base leading-relaxed text-pretty break-words">
                Happy with how things look but want something more official? The dedicated quality pathway
                is the next level: fuller intake, consistent methodology, and a shareable HairAudit score
                you can use when detail and credibility matter. Use this page when you want speed; use the
                formal pathway when you want depth.
              </p>
              <Link
                href="/request-review"
                className="mt-5 inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors text-center text-balance max-w-full sm:max-w-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900/50"
              >
                Request a formal HairAudit quality review
              </Link>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed max-w-2xl text-pretty break-words">
                Same brand, more structure—ideal when you are ready to invest a little more time for a
                documented result.
              </p>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.09}>
            <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white text-balance">What happens next</h2>
              <ol className="mt-4 space-y-2 text-slate-300 text-sm text-pretty break-words">
                <li>
                  - You upload before surgery photos, after surgery / current photos, and (recommended) months
                  since your procedure.
                </li>
                <li>- We run the quick AI-assisted pass on that before-and-after set.</li>
                <li>
                  - You see scores and your rapid before-and-after outcome summary—still lighter than the full
                  HairAudit quality pathway.
                </li>
                <li className="leading-relaxed">
                  - Optional: download or share your card. When you want the full structured route,{" "}
                  <Link
                    href="/request-review"
                    className="text-amber-200 hover:text-amber-100 underline-offset-2 hover:underline rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                  >
                    Request a formal HairAudit quality review
                  </Link>
                  .
                </li>
              </ol>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <section className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-6">
              <h2 className="text-xl font-semibold text-cyan-100 text-balance">
                Share your summary with privacy in mind
              </h2>
              <p className="mt-3 text-cyan-50/90 text-pretty break-words">
                If you post online, lead with the summary card and keep identifying details out of any
                before-and-after photos you share.
              </p>
              <ul className="mt-4 space-y-2 text-cyan-50/90 text-pretty break-words">
                <li>- Crop or hide face and tattoos before posting before-and-after photos.</li>
                <li>- Share score summary, not full private report details.</li>
                <li>- Keep procedure dates and private clinic notes confidential.</li>
              </ul>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-white">Explore quality education pages</h2>
              <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link
                  href="/is-my-hair-transplant-normal"
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-emerald-300/60 transition-colors"
                >
                  <h3 className="font-semibold text-white">Is My Hair Transplant Normal?</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    What may still be normal, what can look worse before it looks better, and when review
                    may help.
                  </p>
                </Link>
                {validationFunnelPages.map((page) => (
                  <Link
                    key={page.slug}
                    href={`/${page.slug}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-emerald-300/60 transition-colors"
                  >
                    <h3 className="font-semibold text-white">{page.title}</h3>
                    <p className="mt-2 text-sm text-slate-300">{page.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Still deciding?</h2>
              <p className="mt-3 text-slate-300 text-pretty break-words">
                Use the form above for a rapid before-and-after outcome summary when you already have before
                surgery photos and after surgery / current photos. When you need independent reassurance with
                full structured documentation,{" "}
                <Link
                  href="/request-review"
                  className="text-amber-200 hover:text-amber-100 underline-offset-2 hover:underline rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  Request a formal HairAudit quality review
                </Link>
                .
              </p>
              <ReviewProcessReassurance className="mt-6" />
            </section>
          </ScrollReveal>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
