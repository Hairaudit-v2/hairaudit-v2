import ProfessionalsShell from "@/components/professionals/ProfessionalsShell";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Evidence Standards | HairAudit",
  description:
    "See HairAudit evidence requirements, sufficiency criteria, and confidence interpretation standards.",
  pathname: "/professionals/evidence-standards",
});

export default function EvidenceStandardsPage() {
  return (
    <ProfessionalsShell
      currentPath="/professionals/evidence-standards"
      title="Evidence Standards"
      intro="Evidence standards define what image sets and contextual data are needed for reliable interpretation and confidence grading."
    >
      <div className="space-y-6 text-slate-300">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Required image types</h2>
          <ul className="mt-3 space-y-2">
            <li>- frontal hairline and frontal oblique views</li>
            <li>- top and crown views</li>
            <li>- bilateral donor views</li>
            <li>- time-sequenced follow-up where available</li>
          </ul>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Evidence sufficiency and confidence grading</h2>
          <p className="mt-3">
            Confidence is influenced by evidence completeness, image quality, standardization, and
            contextual detail. Missing views may reduce confidence without automatically implying low
            surgical quality.
          </p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Image-only limitations</h2>
          <p className="mt-3">
            Image-based review has known limitations. Procedural context and documentation, when
            available, are used to improve defensibility and interpretive confidence.
          </p>
        </section>
      </div>
    </ProfessionalsShell>
  );
}
