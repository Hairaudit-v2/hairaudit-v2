import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import MedicalProcedureFaqSchema from "@/components/seo/MedicalProcedureFaqSchema";

export const metadata = {
  title: "Request Review | HairAudit",
  description:
    "Request a hair transplant review with secure photo upload, independent assessment, and clear next-step reporting.",
};

const requestFaqs = [
  {
    question: "How long does submission take?",
    answer:
      "Most patients finish the upload and details form in about 6 to 8 minutes if photos are ready.",
  },
  {
    question: "What do I need before I start?",
    answer:
      "Prepare pre-op, post-op, donor, and recipient photos with your timeline information for best review quality.",
  },
  {
    question: "Is HairAudit independent from clinics?",
    answer:
      "Yes. HairAudit is independent and does not sell surgery or clinic referrals.",
  },
];

export default function RequestReviewPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <MedicalProcedureFaqSchema
        pageName="Request a Hair Transplant Review"
        pageDescription="Submit your case for independent hair transplant evidence review and reporting."
        faqs={requestFaqs}
      />

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1 px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Request a Hair Transplant Review
            </h1>
            <p className="mt-4 text-slate-300 max-w-2xl">
              Send your surgery photos and details for an independent medical review, whether you
              are concerned about problems or want quality validation.
            </p>
            <p className="mt-3 text-xs text-amber-300 font-medium">Independent Surgery Assessment</p>
            <p className="mt-2 text-sm text-emerald-200 font-medium">Estimated completion time: 6 to 8 minutes</p>
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="text-lg font-semibold text-white">Your photos are private and secure</h2>
              <p className="mt-3 text-sm text-slate-300">
                They are only used for your HairAudit review and are never shared publicly without permission.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="text-lg font-semibold text-white">Helpful photos include</h2>
              <ul className="mt-4 grid sm:grid-cols-2 gap-3 text-slate-300 text-sm">
                {[
                  "front hairline",
                  "left side",
                  "right side",
                  "top view",
                  "crown",
                  "donor area",
                ].map((item) => (
                  <li key={item} className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
              >
                Continue to Secure Upload
              </Link>
              <Link
                href="/sample-report"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
              >
                See an Example Report
              </Link>
            </div>
            <ReviewProcessReassurance className="mt-6" />
            <p className="mt-5 text-sm text-slate-400">
              Many patients only realise something may be wrong months after surgery. HairAudit helps
              you understand whether your result is normal — or if something went wrong.
            </p>
            <p className="mt-3 text-sm text-slate-400">
              Looking for a validation-first pathway?{" "}
              <Link href="/rate-my-hair-transplant" className="text-emerald-300 hover:text-emerald-200 transition-colors">
                How Good Is My Hair Transplant?
              </Link>
            </p>
            <p className="mt-4 text-sm text-slate-500">
              Looking for our technical standards?{" "}
              <Link href="/professionals" className="text-amber-400 hover:text-amber-300 transition-colors">
                Visit For Professionals
              </Link>
              .
            </p>
          </ScrollReveal>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
