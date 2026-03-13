import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import PublicCaseClient from "@/components/community/PublicCaseClient";

type Props = {
  params: Promise<{
    caseId: string;
  }>;
};

export default async function PublicCasePage({ params }: Props) {
  const { caseId } = await params;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.05),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1 px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Public Case Result</h1>
            <p className="mt-4 text-slate-300 max-w-3xl">
              Anonymous case page showing images, HairAudit Score, and community rating signal.
            </p>
            <div className="mt-5">
              <Link
                href="/community-results"
                className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
              >
                Back to Community Results
              </Link>
            </div>
          </ScrollReveal>

          <PublicCaseClient caseId={caseId} />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
