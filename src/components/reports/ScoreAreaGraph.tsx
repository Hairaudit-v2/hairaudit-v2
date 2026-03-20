"use client";

/**
 * ScoreAreaGraph — Renders per-domain/section scores as bar charts with X/5 and level (High/Medium/Low).
 * Use for showing patients where their score sits across capture points.
 */

import { formatTemplate } from "@/lib/i18n/formatTemplate";
import { useI18n } from "@/components/i18n/I18nProvider";

type AreaScore = {
  title: string;
  score: number;
  outOf5: number;
  level: "High" | "Medium" | "Low";
};

function scoreToDisplay(s: number): { outOf5: number; level: "High" | "Medium" | "Low" } {
  const outOf5 = Math.round((s / 100) * 5);
  const clamped = Math.max(0, Math.min(5, outOf5));
  const level = s >= 80 ? "High" : s >= 50 ? "Medium" : "Low";
  return { outOf5: clamped, level };
}

export type ScoreAreaGraphProps = {
  domains?: Record<string, number>;
  sections?: Record<string, number>;
  domainTitles?: Record<string, string>;
  sectionTitles?: Record<string, string>;
  /** If true, show compact section scores only when domains missing */
  compact?: boolean;
};

export default function ScoreAreaGraph({
  domains = {},
  sections = {},
  domainTitles = {},
  sectionTitles = {},
  compact = false,
}: ScoreAreaGraphProps) {
  const { t } = useI18n();

  const levelLabel = (l: "High" | "Medium" | "Low") =>
    l === "High" ? t("reports.chrome.levelHigh") : l === "Medium" ? t("reports.chrome.levelMedium") : t("reports.chrome.levelLow");

  const domainOrder = [
    "consultation_indication",
    "donor_management",
    "extraction_quality",
    "graft_handling",
    "recipient_implantation",
    "safety_documentation_aftercare",
    "case_context",
    "documentation_transparency",
  ];

  const areaScores: AreaScore[] = domainOrder
    .filter((id) => domains[id] != null)
    .map((id) => {
      const s = Number(domains[id]);
      const { outOf5, level } = scoreToDisplay(s);
      return {
        title: domainTitles[id] ?? id.replace(/[._]/g, " "),
        score: s,
        outOf5,
        level,
      };
    });

  const sectionScoresList: AreaScore[] = Object.entries(sections)
    .filter(([, v]) => v != null)
    .map(([id, v]) => {
      const s = Number(v);
      const { outOf5, level } = scoreToDisplay(s);
      return {
        title: sectionTitles[id] ?? id.replace(/[._]/g, " "),
        score: s,
        outOf5,
        level,
      };
    });

  if (areaScores.length === 0 && sectionScoresList.length === 0) return null;

  const levelColor = (l: string) =>
    l === "High" ? "bg-emerald-500" : l === "Medium" ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-900 mb-1">{t("reports.chrome.scoreByAreaTitle")}</h2>
      <p className="text-xs text-slate-500 mb-3">{t("reports.chrome.scoreByAreaSubtitle")}</p>

      {areaScores.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {areaScores.map((a) => (
            <div
              key={a.title}
              className="rounded-lg border border-slate-100 p-3 flex flex-col gap-2"
            >
              <div className="font-medium text-sm text-slate-900 truncate" title={a.title}>
                {a.title}
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${levelColor(a.level)} transition-all`}
                  // Use the 0–5 rating for width so 4/5 vs 5/5 is visually distinct.
                  style={{ width: `${(a.outOf5 / 5) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>{a.outOf5}/5</span>
                <span className={`font-semibold ${
                  a.level === "High" ? "text-emerald-600" : a.level === "Medium" ? "text-amber-600" : "text-red-600"
                }`}>
                  {formatTemplate(t("reports.chrome.scoreLevelSuffix"), { level: levelLabel(a.level) })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {sectionScoresList.length > 0 && !compact && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-500 mb-2">{t("reports.chrome.detailedSectionScores")}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {sectionScoresList.map((a) => (
              <div
                key={a.title}
                className="rounded-lg border border-slate-100 p-2 flex flex-col gap-1"
              >
                <div className="font-medium text-xs text-slate-800 truncate" title={a.title}>
                  {a.title}
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${levelColor(a.level)}`}
                    style={{ width: `${(a.outOf5 / 5) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{a.outOf5}/5</span>
                  <span className="font-medium">{levelLabel(a.level)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { buildRubricTitles } from "@/lib/audit/rubricTitles";
