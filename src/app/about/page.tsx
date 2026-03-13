import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "About | HairAudit",
  description:
    "Learn how HairAudit delivers independent, evidence-based review for hair transplant patients and professionals.",
  pathname: "/about",
});

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
      </div>
      <SiteHeader />

      <main className="relative flex-1 px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              About HairAudit
            </h1>
            <p className="mt-4 text-slate-300 text-sm sm:text-base leading-relaxed">
              HairAudit was created to bring transparency, accountability, and clinical clarity to hair
              restoration review.
            </p>
          </ScrollReveal>

          <div className="mt-8 space-y-6">
            <ScrollReveal delay={0.06}>
              <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-white">What we do</h2>
                <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
                  We provide independent, evidence-based forensic reviews of hair transplant outcomes
                  using structured methodology across design, density, donor preservation, and evidence
                  confidence.
                </p>
              </section>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-white">What we do not do</h2>
                <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
                  HairAudit does not perform surgeries and does not promote clinics. Our role is
                  independent reporting that supports informed patient and professional decisions.
                </p>
              </section>
            </ScrollReveal>
            <ScrollReveal delay={0.14}>
              <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-white">Current platform status</h2>
                <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
                  Patient review requests are available now. Professional participation for clinics,
                  surgeons, and partners uses a dedicated onboarding pathway.
                </p>
                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/request-review"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
                  >
                    Request Review
                  </Link>
                  <Link
                    href="/professionals/apply"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                  >
                    Apply for Participation
                  </Link>
                </div>
              </section>
            </ScrollReveal>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
