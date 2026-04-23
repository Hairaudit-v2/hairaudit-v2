"use client";

import Link from "next/link";
import TrackedLink from "@/components/analytics/TrackedLink";

type SampleAuditReportSectionProps = {
  theme?: "light" | "dark";
  showCta?: boolean;
};

const SCORE_DOMAINS = [
  { label: "Design", score: 74, fullLabel: "Hairline design & planning" },
  { label: "Technique", score: 68, fullLabel: "Graft handling & execution" },
  { label: "Density", score: 58, fullLabel: "Recipient density" },
  { label: "Donor safety", score: 52, fullLabel: "Donor preservation" },
  { label: "Documentation", score: 86, fullLabel: "Evidence quality" },
] as const;

const RISK_ITEMS = [
  { id: "donor", label: "Donor integrity", status: "moderate", description: "Extraction distribution" },
  { id: "growth", label: "Growth potential", status: "review", description: "Based on imagery" },
  { id: "angle", label: "Implantation angle", status: "good", description: "Within natural range" },
  { id: "density", label: "Density consistency", status: "moderate", description: "Zone variation" },
] as const;

function ScoreGauge({ score, size = 100 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const stroke = 6;
  const offset = circumference - (score / 100) * circumference;
  const c = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[100px]" aria-hidden>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${c} ${c})`}
      />
    </svg>
  );
}

function DonorZoneDiagram({ theme }: { theme: "light" | "dark" }) {
  const stroke = theme === "light" ? "#64748b" : "#94a3b8";
  const safe = theme === "light" ? "#22c55e" : "#4ade80";
  const moderate = theme === "light" ? "#eab308" : "#facc15";
  const caution = theme === "light" ? "#f97316" : "#fb923c";
  return (
    <svg
      viewBox="0 0 200 140"
      className={`w-full ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}
      aria-hidden
    >
      <title>Donor zone analysis</title>
      {/* Simplified head outline - back/side view */}
      <ellipse cx="100" cy="72" rx="52" ry="58" fill="none" stroke={stroke} strokeWidth="1.5" opacity="0.6" />
      {/* Safe zone */}
      <path
        d="M 55 45 Q 100 30 145 45 Q 155 65 150 95 Q 100 105 50 95 Q 48 65 55 45"
        fill="none"
        stroke={safe}
        strokeWidth="2.5"
        strokeDasharray="4 3"
        opacity="0.9"
      />
      <text x="100" y="68" textAnchor="middle" className="text-[10px] fill-slate-500" fill="currentColor">Safe</text>
      {/* Moderate zone */}
      <path
        d="M 48 98 Q 100 115 152 98 Q 158 120 140 128 Q 100 132 60 128 Q 42 120 48 98"
        fill="none"
        stroke={moderate}
        strokeWidth="2"
        strokeDasharray="3 2"
        opacity="0.85"
      />
      <text x="100" y="118" textAnchor="middle" className="text-[10px] fill-slate-500" fill="currentColor">Moderate</text>
      {/* Caution zone */}
      <ellipse cx="100" cy="128" rx="35" ry="8" fill="none" stroke={caution} strokeWidth="1.5" opacity="0.8" />
      <text x="100" y="132" textAnchor="middle" className="text-[9px] fill-slate-500" fill="currentColor">Caution</text>
    </svg>
  );
}

function ImplantationAngleDiagram({ theme }: { theme: "light" | "dark" }) {
  const line = theme === "light" ? "#475569" : "#94a3b8";
  const good = theme === "light" ? "#16a34a" : "#22c55e";
  return (
    <svg
      viewBox="0 0 180 100"
      className={`w-full ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}
      aria-hidden
    >
      <title>Implantation angle range</title>
      {/* Scalp line */}
      <line x1="20" y1="75" x2="160" y2="75" stroke={line} strokeWidth="2" strokeLinecap="round" />
      {/* Natural range 30–45° */}
      <line x1="50" y1="75" x2="75" y2="38" stroke={good} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="90" y1="75" x2="90" y2="42" stroke={good} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="130" y1="75" x2="108" y2="38" stroke={good} strokeWidth="2.5" strokeLinecap="round" />
      {/* Label */}
      <text x="90" y="92" textAnchor="middle" className="text-[9px] fill-slate-500" fill="currentColor">30–45° natural range</text>
    </svg>
  );
}

function DensityMapGrid({ theme }: { theme: "light" | "dark" }) {
  const isLight = theme === "light";
  const high = isLight ? "bg-emerald-500/30" : "bg-emerald-500/40";
  const mid = isLight ? "bg-amber-500/25" : "bg-amber-500/35";
  const low = isLight ? "bg-rose-400/20" : "bg-rose-400/30";
  const border = isLight ? "border-slate-200/80" : "border-white/15";
  const textMain = isLight ? "text-slate-700" : "text-slate-200";
  const textSub = isLight ? "text-slate-600" : "text-slate-400";
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className={`rounded-lg ${high} border ${border} px-3 py-4 text-center`}>
        <p className={`text-xs font-semibold ${textMain}`}>72%</p>
        <p className={`text-[10px] ${textSub} mt-0.5`}>Frontal</p>
      </div>
      <div className={`rounded-lg ${mid} border ${border} px-3 py-4 text-center`}>
        <p className={`text-xs font-semibold ${textMain}`}>54%</p>
        <p className={`text-[10px] ${textSub} mt-0.5`}>Mid</p>
      </div>
      <div className={`rounded-lg ${low} border ${border} px-3 py-4 text-center`}>
        <p className={`text-xs font-semibold ${textMain}`}>38%</p>
        <p className={`text-[10px] ${textSub} mt-0.5`}>Crown</p>
      </div>
    </div>
  );
}

function RiskBadge({
  status,
  theme,
}: { status: "good" | "moderate" | "review"; theme: "light" | "dark" }) {
  const styles = {
    good: theme === "light" ? "bg-emerald-500/15 text-emerald-800 border-emerald-400/40" : "bg-emerald-500/20 text-emerald-200 border-emerald-400/50",
    moderate: theme === "light" ? "bg-amber-500/15 text-amber-800 border-amber-400/40" : "bg-amber-500/20 text-amber-200 border-amber-400/50",
    review: theme === "light" ? "bg-rose-500/10 text-rose-800 border-rose-400/40" : "bg-rose-500/20 text-rose-200 border-rose-400/50",
  };
  const label = { good: "Good", moderate: "Moderate", review: "Review" };
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[status]}`}>
      {label[status]}
    </span>
  );
}

export default function SampleAuditReportSection({
  theme = "light",
  showCta = true,
}: SampleAuditReportSectionProps) {
  const isLight = theme === "light";
  const overallScore = Math.round(
    SCORE_DOMAINS.reduce((acc, d) => acc + d.score, 0) / SCORE_DOMAINS.length
  );

  const sectionBg = isLight ? "bg-neutral-50" : "bg-slate-900/50";
  const borderClass = isLight ? "border-slate-200" : "border-white/10";
  const cardBg = isLight ? "bg-white" : "bg-white/5";
  const headingClass = isLight ? "text-slate-900" : "text-white";
  const bodyClass = isLight ? "text-slate-600" : "text-slate-300";
  const labelClass = isLight ? "text-slate-500" : "text-slate-400";
  const eyebrowClass = isLight ? "text-amber-700" : "text-amber-400";

  return (
    <section
      aria-labelledby="sample-audit-heading"
      className={`relative px-4 sm:px-6 py-20 sm:py-28 border-t ${borderClass} ${sectionBg}`}
    >
      <div className="max-w-6xl mx-auto">
        <div>
          <p className={`text-xs uppercase tracking-widest font-semibold ${eyebrowClass}`}>
            Sample audit report
          </p>
          <h2 id="sample-audit-heading" className={`mt-3 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight ${headingClass}`}>
            See what you get — your report at a glance
          </h2>
          <p className={`mt-4 max-w-2xl text-lg ${bodyClass}`}>
            Every audit includes a structured score, evidence-based visuals, and clear risk indicators. 
            This is a preview of the same format you receive.
          </p>
        </div>

        {/* Primary score + domain breakdown */}
        <div className="mt-12 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div>
            <div className={`rounded-2xl border ${borderClass} ${cardBg} p-6 flex flex-col items-center`}>
              <p className={`text-xs uppercase tracking-wider font-semibold ${labelClass}`}>
                Overall score
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className={`text-4xl font-bold tabular-nums ${headingClass}`}>{overallScore}</span>
                <span className={`text-lg ${bodyClass}`}>/ 100</span>
              </div>
              <div className="mt-4 w-full max-w-[120px]">
                <ScoreGauge score={overallScore} size={120} />
              </div>
              <p className={`mt-3 text-sm ${bodyClass}`}>
                Weighted across all domains
              </p>
            </div>
          </div>
          <div>
            <div className={`rounded-2xl border ${borderClass} ${cardBg} p-6`}>
              <p className={`text-xs uppercase tracking-wider font-semibold ${labelClass}`}>
                Score breakdown by domain
              </p>
              <div className="mt-4 space-y-4">
                {SCORE_DOMAINS.map((d) => (
                  <div key={d.label}>
                    <div className="flex justify-between text-sm">
                      <span className={isLight ? "text-slate-700" : "text-slate-200"}>{d.label}</span>
                      <span className={`font-semibold tabular-nums ${headingClass}`}>{d.score}</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-200/80 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${d.score}%` }}
                        aria-hidden
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Donor, angles, density — 3-column */}
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <div>
            <div className={`rounded-2xl border ${borderClass} ${cardBg} p-5`}>
              <p className={`text-xs uppercase tracking-wider font-semibold ${labelClass}`}>
                Donor analysis
              </p>
              <p className={`mt-1 text-sm ${bodyClass}`}>
                Zone safety and extraction distribution
              </p>
              <div className="mt-4 flex justify-center [&_svg]:max-h-[140px]">
                <DonorZoneDiagram theme={theme} />
              </div>
            </div>
          </div>
          <div>
            <div className={`rounded-2xl border ${borderClass} ${cardBg} p-5`}>
              <p className={`text-xs uppercase tracking-wider font-semibold ${labelClass}`}>
                Implantation angles
              </p>
              <p className={`mt-1 text-sm ${bodyClass}`}>
                Natural range vs. your result
              </p>
              <div className="mt-4 flex justify-center [&_svg]:max-h-[100px]">
                <ImplantationAngleDiagram theme={theme} />
              </div>
            </div>
          </div>
          <div>
            <div className={`rounded-2xl border ${borderClass} ${cardBg} p-5`}>
              <p className={`text-xs uppercase tracking-wider font-semibold ${labelClass}`}>
                Density mapping
              </p>
              <p className={`mt-1 text-sm ${bodyClass}`}>
                By zone (frontal, mid, crown)
              </p>
              <div className="mt-4">
                <DensityMapGrid theme={theme} />
              </div>
            </div>
          </div>
        </div>

        {/* Before/after + risk indicators */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <div className={`rounded-2xl border ${borderClass} ${cardBg} p-6`}>
              <p className={`text-xs uppercase tracking-wider font-semibold ${labelClass}`}>
                Before / after comparison
              </p>
              <p className={`mt-1 text-sm ${bodyClass}`}>
                Your report includes annotated pre- and post-op imagery with consistent angles.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className={`rounded-xl border ${borderClass} aspect-[4/3] flex flex-col items-center justify-center ${isLight ? "bg-slate-100" : "bg-slate-800/50"}`}>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}>Before</span>
                  <span className={`mt-1 text-[10px] ${bodyClass}`}>Baseline</span>
                </div>
                <div className={`rounded-xl border ${borderClass} aspect-[4/3] flex flex-col items-center justify-center ${isLight ? "bg-slate-100" : "bg-slate-800/50"}`}>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}>After</span>
                  <span className={`mt-1 text-[10px] ${bodyClass}`}>Outcome</span>
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className={`rounded-2xl border ${borderClass} ${cardBg} p-6`}>
              <p className={`text-xs uppercase tracking-wider font-semibold ${labelClass}`}>
                Risk indicators
              </p>
              <p className={`mt-1 text-sm ${bodyClass}`}>
                Clear flags so you know where to focus or seek follow-up.
              </p>
              <ul className="mt-5 space-y-3">
                {RISK_ITEMS.map((item) => (
                  <li key={item.id} className={`flex items-center justify-between gap-3 rounded-xl border ${borderClass} px-4 py-3 ${isLight ? "bg-neutral-50/80" : "bg-white/5"}`}>
                    <div>
                      <p className={`text-sm font-medium ${headingClass}`}>{item.label}</p>
                      <p className={`text-xs ${bodyClass}`}>{item.description}</p>
                    </div>
                    <RiskBadge status={item.status} theme={theme} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {showCta && (
          <div>
            <div className={`mt-14 rounded-2xl border ${borderClass} ${cardBg} p-8 sm:p-10 text-center`}>
              <p className={`text-lg font-semibold ${headingClass}`}>
                This is what an independent audit looks like.
              </p>
              <p className={`mt-2 text-sm ${bodyClass} max-w-xl mx-auto`}>
                Get your own score breakdown, donor analysis, density mapping, and risk indicators — plus plain-language next steps.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <TrackedLink
                  href="/request-review"
                  eventName="cta_get_audit_sample_section"
                  className="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-amber-500 text-slate-900 font-semibold text-lg hover:bg-amber-600 transition-colors border border-amber-600/20"
                >
                  Get Your Surgery Audited
                </TrackedLink>
                <Link
                  href="/demo-report"
                  className={`inline-flex items-center justify-center px-8 py-4 rounded-2xl border-2 ${isLight ? "border-slate-300 text-slate-700 hover:bg-slate-50" : "border-white/20 text-slate-200 hover:bg-white/10"} transition-colors font-medium`}
                >
                  View full sample report
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
