import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "What certification means | HairAudit",
  description:
    "HairAudit certification levels reflect independently audited surgical data and verified case submissions. Learn how Active, Silver, Gold, and Platinum recognition works.",
  pathname: "/certification-explained",
});

export default function CertificationExplainedPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <SiteHeader />
      <main className="relative flex-1 px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            What does certification mean?
          </h1>
          <p className="mt-4 text-slate-400 leading-relaxed">
            HairAudit certification is based on independently audited surgical data and verified case
            submissions. Clinics that actively participate demonstrate transparency, quality assurance,
            and confidence in their work. Recognition is not purchased — it is earned through
            documented case contribution, validated audit outcomes, and consistency.
          </p>
          <p className="mt-4 text-slate-400 leading-relaxed">
            Levels (Active, Silver, Gold, Platinum) reflect validated participation, documentation
            quality, and performance across reviewed cases. Public case count refers to cases the
            clinic has chosen to make visible on their profile and in discovery.
          </p>
          <p className="mt-6">
            <Link
              href="/clinics"
              className="text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              ← Explore clinics
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
