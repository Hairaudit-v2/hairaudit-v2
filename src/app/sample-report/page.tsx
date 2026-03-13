import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ui/ScrollReveal";
import ReviewProcessReassurance from "@/components/seo/ReviewProcessReassurance";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import TrackedLink from "@/components/analytics/TrackedLink";

export const metadata = createPageMetadata({
  title: "Sample Audit Report | HairAudit",
  description:
    "Preview a premium HairAudit forensic-style report with score breakdowns, image evidence analysis, findings, and correction guidance.",
  pathname: "/sample-report",
});

const previewCards = [
  {
    title: "Audit Score Overview",
    detail:
      "Weighted scoring for planning, execution, design quality, and evidence integrity with clear confidence notes.",
  },
  {
    title: "Surgical Radar Graph",
    detail:
      "A domain-by-domain radar profile to reveal strengths and quality gaps in one clinical visual.",
  },
  {
    title: "Image-Based Analysis",
    detail:
      "Annotated scalp, hairline, and donor imagery with density zones, extraction patterns, and risk markers.",
  },
  {
    title: "Findings & Recommendations",
    detail:
      "Structured conclusions and realistic next-step actions patients can use for follow-up, repair planning, or dispute documentation.",
  },
];

const radarDomains = [
  { label: "Hairline Design", score: 74 },
  { label: "Density Planning", score: 58 },
  { label: "Recipient Execution", score: 67 },
  { label: "Donor Management", score: 52 },
  { label: "Naturalness", score: 63 },
  { label: "Evidence Quality", score: 86 },
];

const scoreBreakdown = [
  { label: "Design", score: 71 },
  { label: "Technique", score: 64 },
  { label: "Density", score: 57 },
  { label: "Donor Safety", score: 54 },
  { label: "Documentation", score: 88 },
];

const sampleFindings = [
  {
    title: "Hairline Design",
    insight:
      "Frontal line demonstrates asymmetry with abrupt angle transitions at temporal zones, reducing natural flow under direct light.",
    severity: "Moderate concern",
  },
  {
    title: "Density Distribution",
    insight:
      "Central forelock appears relatively preserved, while bilateral frontal thirds show under-density compared with expected graft allocation.",
    severity: "High concern",
  },
  {
    title: "Donor Management",
    insight:
      "Posterior donor extraction appears regionally concentrated with visible spacing inconsistency suggestive of over-harvest risk.",
    severity: "High concern",
  },
];

const sampleRecommendations = [
  "Obtain standardized 6-month and 12-month macro photography with matching angles and lighting for progression validation.",
  "Request operative records including graft count by zone and extraction map before considering corrective intervention.",
  "Perform in-person donor density quantification and elasticity assessment before repair planning.",
  "Prioritize conservative frontal refinement strategy to avoid compounding donor depletion.",
  "Preserve this report for second-opinion consultation, repair budgeting, or pre-dispute documentation workflow.",
];

const auditIncludes = [
  "Executive Summary",
  "Score Breakdown",
  "Image-Based Review",
  "Doctor / Clinic Assessment",
  "Correction Guidance",
  "Downloadable PDF Report",
];

const motivations = [
  "My result looks disappointing and I need a professional, independent quality review.",
  "I am concerned the graft count or achieved density does not match what was promised.",
  "I want an objective second opinion before committing to corrective surgery.",
  "I need structured documentation before a repair consult, complaint, or dispute.",
];

function toRadarPoint(value: number, index: number, count: number, radius: number, center: number) {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const scaled = (value / 100) * radius;
  return `${(center + Math.cos(angle) * scaled).toFixed(1)},${(center + Math.sin(angle) * scaled).toFixed(1)}`;
}

function radarAxisPoint(index: number, count: number, radius: number, center: number) {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function IncludeIcon({ idx }: { idx: number }) {
  const color = "text-cyan-300";
  if (idx % 3 === 0) {
    return (
      <svg viewBox="0 0 24 24" className={`size-5 ${color}`} aria-hidden>
        <path d="M5 5h14v14H5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (idx % 3 === 1) {
    return (
      <svg viewBox="0 0 24 24" className={`size-5 ${color}`} aria-hidden>
        <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={`size-5 ${color}`} aria-hidden>
      <path d="M12 3l8 4v5c0 5.4-3.3 8.2-8 9-4.7-.8-8-3.6-8-9V7l8-4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.3 12.2l1.8 1.8 3.8-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function SampleReportPage() {
  const center = 110;
  const radius = 78;
  const axisCount = radarDomains.length;
  const radarPolygon = radarDomains
    .map((domain, index) => toRadarPoint(domain.score, index, axisCount, radius, center))
    .join(" ");
  const evidenceIntegrity = 84;
  const confidenceStrength = 79;

  return (
    <div className="min-h-screen flex flex-col bg-[#070b14] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,rgba(34,211,238,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_35%_at_88%_20%,rgba(129,140,248,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_48%_28%_at_20%_88%,rgba(59,130,246,0.10),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1">
        <section className="px-4 sm:px-6 py-14 sm:py-18 lg:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <ScrollReveal>
              <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                Independent forensic review
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                See What a Real HairAudit Report Looks Like
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                This is a structured, independent review of hair transplant quality. Every conclusion
                is tied to visible evidence, scoring criteria, and confidence limits so patients can
                make high-stakes decisions with clarity.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <TrackedLink
                  href="#inside-report"
                  eventName="cta_view_sample_audit_hero"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:scale-[1.01]"
                >
                  View Sample Audit
                </TrackedLink>
                <TrackedLink
                  href="/request-review"
                  eventName="cta_request_my_audit_hero"
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:border-white/35 hover:bg-white/10"
                >
                  Request My Audit
                </TrackedLink>
              </div>
              <p className="mt-5 text-sm text-slate-400">
                Premium report format. Redacted sample content. No private patient data.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.08}>
              <div className="relative mx-auto h-[380px] w-full max-w-[420px]">
                <div className="absolute right-0 top-4 h-72 w-56 rotate-6 rounded-2xl border border-cyan-200/20 bg-slate-900/75 p-4 shadow-2xl shadow-cyan-950/40 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/90">Evidence Integrity</p>
                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[84%] rounded-full bg-gradient-to-r from-cyan-300 to-indigo-300" />
                  </div>
                  <p className="mt-2 text-xs text-slate-300">84% document confidence</p>
                  <div className="mt-6 space-y-2">
                    <div className="h-8 rounded-lg bg-white/5" />
                    <div className="h-8 rounded-lg bg-white/5" />
                    <div className="h-8 rounded-lg bg-white/5" />
                  </div>
                </div>
                <div className="absolute left-2 top-16 h-72 w-56 -rotate-3 rounded-2xl border border-indigo-200/20 bg-slate-900/75 p-4 shadow-2xl shadow-indigo-950/40 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-200/90">Surgical Scorecard</p>
                  <div className="mt-4 space-y-3">
                    {scoreBreakdown.slice(0, 4).map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>{item.label}</span>
                          <span>{item.score}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-white/10">
                          <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-indigo-300 to-cyan-300"
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute inset-x-8 bottom-2 rounded-2xl border border-white/15 bg-slate-900/80 p-4 shadow-2xl shadow-black/45 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200">Correction Priority</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-rose-400/20 px-2 py-2 text-center text-[11px] text-rose-100">High</div>
                    <div className="rounded-lg bg-amber-400/20 px-2 py-2 text-center text-[11px] text-amber-100">Medium</div>
                    <div className="rounded-lg bg-emerald-400/20 px-2 py-2 text-center text-[11px] text-emerald-100">Low</div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-8 sm:pb-10">
          <ScrollReveal>
            <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 rounded-2xl border border-white/12 bg-white/[0.04] px-6 py-6 text-center backdrop-blur sm:flex-row sm:justify-between sm:text-left">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/90">Independent documentation</p>
                <p className="mt-2 text-sm text-slate-300 sm:text-base">
                  Need clarity before corrective surgery or a formal complaint? Use an evidence-first audit.
                </p>
              </div>
              <TrackedLink
                href="/request-review"
                eventName="cta_get_independent_review_mid"
                className="inline-flex items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-300/15 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/25"
              >
                Get an Independent Review
              </TrackedLink>
            </div>
          </ScrollReveal>
        </section>

        <section id="inside-report" className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/90">Inside the report</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">What premium review includes</h2>
            </ScrollReveal>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {previewCards.map((card, index) => (
                <ScrollReveal key={card.title} delay={index * 0.05}>
                  <article className="rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-[0_14px_50px_rgba(2,6,23,0.45)] backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.17em] text-cyan-200/80">Preview {index + 1}</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">{card.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{card.detail}</p>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/90">Live sample visuals</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Interactive-style chart intelligence</h2>
            </ScrollReveal>
            <div className="mt-9 grid gap-6 lg:grid-cols-2">
              <ScrollReveal>
                <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 backdrop-blur">
                  <h3 className="text-base font-semibold text-white">Surgical Radar Graph</h3>
                  <p className="mt-1 text-sm text-slate-300">Performance domains mapped across design, density, execution, and donor safety.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]">
                    <svg viewBox="0 0 220 220" className="h-[220px] w-full">
                      {[100, 75, 50, 25].map((ring) => (
                        <polygon
                          key={ring}
                          points={radarDomains
                            .map((_, i) => toRadarPoint(ring, i, axisCount, radius, center))
                            .join(" ")}
                          fill="none"
                          stroke="rgba(148,163,184,0.22)"
                        />
                      ))}
                      {radarDomains.map((_, i) => {
                        const axis = radarAxisPoint(i, axisCount, radius, center);
                        return (
                          <line
                            key={i}
                            x1={center}
                            y1={center}
                            x2={axis.x}
                            y2={axis.y}
                            stroke="rgba(148,163,184,0.2)"
                            strokeWidth="1"
                          />
                        );
                      })}
                      <polygon points={radarPolygon} fill="rgba(56,189,248,0.24)" stroke="rgba(125,211,252,0.95)" strokeWidth="2" />
                      {radarDomains.map((domain, i) => {
                        const point = toRadarPoint(domain.score, i, axisCount, radius, center).split(",");
                        return <circle key={domain.label} cx={Number(point[0])} cy={Number(point[1])} r="3.2" fill="rgb(103,232,249)" />;
                      })}
                    </svg>
                    <div className="space-y-2">
                      {radarDomains.map((domain) => (
                        <div key={domain.label}>
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span>{domain.label}</span>
                            <span>{domain.score}</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-white/10">
                            <div className="h-1.5 rounded-full bg-gradient-to-r from-cyan-300 to-indigo-300" style={{ width: `${domain.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              </ScrollReveal>

              <ScrollReveal delay={0.05}>
                <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 backdrop-blur">
                  <h3 className="text-base font-semibold text-white">Audit Score Breakdown</h3>
                  <p className="mt-1 text-sm text-slate-300">Weighted bar chart aligned to report scoring categories.</p>
                  <div className="mt-5 space-y-3">
                    {scoreBreakdown.map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                          <span>{item.label}</span>
                          <span>{item.score}</span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-800">
                          <div
                            className="h-3 rounded-full bg-gradient-to-r from-sky-300 via-cyan-300 to-indigo-300 shadow-[0_0_18px_rgba(125,211,252,0.35)]"
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </ScrollReveal>

              <ScrollReveal>
                <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 backdrop-blur">
                  <h3 className="text-base font-semibold text-white">Confidence & Evidence Integrity Meter</h3>
                  <p className="mt-1 text-sm text-slate-300">Separates quality concerns from evidence limitations.</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Evidence integrity</p>
                      <p className="mt-1 text-3xl font-semibold text-cyan-200">{evidenceIntegrity}%</p>
                      <div className="mt-3 h-2 rounded-full bg-white/10">
                        <div className="h-2 rounded-full bg-cyan-300" style={{ width: `${evidenceIntegrity}%` }} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Conclusion confidence</p>
                      <p className="mt-1 text-3xl font-semibold text-indigo-200">{confidenceStrength}%</p>
                      <div className="mt-3 h-2 rounded-full bg-white/10">
                        <div className="h-2 rounded-full bg-indigo-300" style={{ width: `${confidenceStrength}%` }} />
                      </div>
                    </div>
                  </div>
                </article>
              </ScrollReveal>

              <ScrollReveal delay={0.05}>
                <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 backdrop-blur">
                  <h3 className="text-base font-semibold text-white">Correction Priority Visual</h3>
                  <p className="mt-1 text-sm text-slate-300">Prioritization grid for what to address first.</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-rose-300/25 bg-rose-400/10 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-rose-200">Immediate priority</p>
                      <p className="mt-2 text-sm text-slate-200">Donor over-harvest risk and asymmetrical frontal density.</p>
                    </div>
                    <div className="rounded-xl border border-amber-300/25 bg-amber-400/10 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-amber-200">Next stage</p>
                      <p className="mt-2 text-sm text-slate-200">Hairline irregularity refinement and zone-specific planning.</p>
                    </div>
                    <div className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Documentation first</p>
                      <p className="mt-2 text-sm text-slate-200">
                        Collect standardized images and operative records before any corrective commitments.
                      </p>
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Sample Findings</h2>
            </ScrollReveal>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {sampleFindings.map((finding, idx) => (
                <ScrollReveal key={finding.title} delay={idx * 0.05}>
                  <article className="rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.14em] text-cyan-200/90">{finding.severity}</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">{finding.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{finding.insight}</p>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-6xl rounded-3xl border border-white/12 bg-white/[0.03] p-6 sm:p-8">
            <ScrollReveal>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Sample Recommendations</h2>
              <ul className="mt-6 space-y-3">
                {sampleRecommendations.map((recommendation, idx) => (
                  <li key={recommendation} className="flex gap-3 rounded-xl border border-white/10 bg-slate-900/55 px-4 py-3">
                    <span className="mt-1 inline-block size-2 shrink-0 rounded-full bg-cyan-300" aria-hidden />
                    <span className="text-sm text-slate-200">
                      <span className="mr-1 font-semibold text-white">R{idx + 1}.</span>
                      {recommendation}
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">What Your Audit Includes</h2>
            </ScrollReveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {auditIncludes.map((item, idx) => (
                <ScrollReveal key={item} delay={idx * 0.03}>
                  <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex size-9 items-center justify-center rounded-lg border border-white/20 bg-white/[0.06]">
                        <IncludeIcon idx={idx} />
                      </span>
                      <h3 className="text-base font-semibold text-white">{item}</h3>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Why Patients Request an Audit</h2>
            </ScrollReveal>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {motivations.map((item, idx) => (
                <ScrollReveal key={item} delay={idx * 0.05}>
                  <article className="rounded-2xl border border-white/12 bg-slate-900/60 p-5">
                    <p className="text-sm leading-relaxed text-slate-200">{item}</p>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-14 sm:py-18">
          <div className="mx-auto max-w-5xl rounded-3xl border border-cyan-300/25 bg-gradient-to-r from-cyan-400/10 via-indigo-400/10 to-slate-900 p-8 text-center shadow-2xl shadow-cyan-950/35">
            <ScrollReveal>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">Case clarity starts here</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                See What Your Surgery Really Shows
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-200 sm:text-base">
                Move from uncertainty to structured evidence. Receive a premium independent report you can use for planning, consultations, and documentation.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <TrackedLink
                  href="/request-review"
                  eventName="cta_request_my_audit_footer"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Request My Audit
                </TrackedLink>
                <TrackedLink
                  href="/request-review"
                  eventName="cta_get_independent_review_footer"
                  className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Get an Independent Review
                </TrackedLink>
              </div>
              <div className="mx-auto mt-8 max-w-3xl text-left">
                <ReviewProcessReassurance />
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
