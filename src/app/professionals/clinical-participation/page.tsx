import ProfessionalsShell from "@/components/professionals/ProfessionalsShell";
import Link from "next/link";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Clinical Participation | HairAudit",
  description:
    "Learn how clinics participate in HairAudit documentation pathways and transparency-focused professional review.",
  pathname: "/professionals/clinical-participation",
});

export default function ClinicalParticipationPage() {
  return (
    <ProfessionalsShell
      currentPath="/professionals/clinical-participation"
      title="Clinical Participation"
      intro="Clinical participation is voluntary and designed to support documentation completeness, confidence, and quality-improvement pathways."
    >
      <div className="space-y-6 text-slate-300">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">How clinics can participate</h2>
          <p className="mt-3">
            Clinics can contribute documentation when a patient requests a review. This may increase
            evidence completeness and improve confidence in case interpretation.
          </p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Verified program context</h2>
          <p className="mt-3">
            Participation in structured documentation pathways can support transparent reporting and
            recognition-readiness over time.
          </p>
          <p className="mt-3">
            <Link href="/verified-surgeon-program" className="text-amber-400 hover:text-amber-300 transition-colors">
              Learn about the Verified Program →
            </Link>
          </p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Quality-improvement use case</h2>
          <p className="mt-3">
            Structured outputs may be used internally by clinics to identify consistency gaps,
            monitor documentation standards, and support evidence-informed process improvements.
          </p>
        </section>
      </div>
    </ProfessionalsShell>
  );
}
