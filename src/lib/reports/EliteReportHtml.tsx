import type { ReportViewModel } from "@/lib/pdf/reportBuilder";

type AreaScoreItem = {
  title: string;
  score: number;
  outOf5: number;
  level: string;
};

export type EliteReportViewModel = {
  viewModel: ReportViewModel;
  caseId: string;
  caseStatus?: string | null;
  caseCreatedAt?: string;
  generatedAt: string;
  version?: number;
  grade?: string | null;
  confidenceLabel?: string | null;
  metrics: {
    donorQuality: string;
    graftSurvival: string;
    transectionRisk: string;
    implantationDensity: string;
    hairlineNaturalness: string;
    donorScarVisibility: string;
  };
  areaDomains: AreaScoreItem[];
  sectionScores: AreaScoreItem[];
  highlights: string[];
  risks: string[];
  radarDataUri?: string | null;
  photosByCategory: Record<string, { signedUrl: string | null; label: string }[]>;
  doctorBlockHtml?: string;
  debugFooter?: string;
};

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderEliteReportHtml(vm: EliteReportViewModel): string {
  const {
    caseId,
    caseStatus,
    caseCreatedAt,
    generatedAt,
    version,
    grade,
    confidenceLabel,
    metrics,
    areaDomains,
    sectionScores,
    highlights,
    risks,
    radarDataUri,
    photosByCategory,
    doctorBlockHtml,
    debugFooter,
  } = vm;

  const photoCategoryKeys = Object.keys(photosByCategory);

  const photosBlock =
    photoCategoryKeys.length > 0
      ? `
    <div class="section pageBreak">
      <h2>Case Photos</h2>
      <div class="subtitle" style="margin-top: 4px;">Grouped by upload category.</div>
      ${photoCategoryKeys
        .map((cat) => {
          const items = (photosByCategory[cat] ?? []).filter((x) => !!x.signedUrl);
          if (!items.length) return "";
          return `
        <div class="photoCat">
          <div class="photoCatTitle">${esc(String(cat).replaceAll("_", " "))}</div>
          <div class="photoGrid">
            ${items
              .map(
                (u) => `
              <figure class="photo">
                <img src="${esc(String(u.signedUrl))}" alt="${esc(String(u.label || "photo"))}" />
                <figcaption>${esc(String(u.label || ""))}</figcaption>
              </figure>`
              )
              .join("")}
          </div>
        </div>`;
        })
        .join("")}
    </div>
      `
      : "";

  const areaScoresBlock =
    areaDomains.length > 0 || sectionScores.length > 0
      ? `
    <div class="section pageBreak">
      <h2>Score by Area</h2>
      <div class="subtitle" style="margin-top: 4px;">Your score for each capture point (out of 5, with level).</div>
      ${
        areaDomains.length > 0
          ? `
      <div class="areaScoreGrid">
        ${areaDomains
          .map(
            (a) => `
          <div class="areaScoreCard">
            <div class="areaScoreTitle">${esc(a.title)}</div>
            <div class="areaScoreBar">
              <div class="areaScoreFill ${a.level.toLowerCase()}" style="width: ${a.score}%;"></div>
            </div>
            <div class="areaScoreMeta">
              <span>${a.outOf5}/5</span>
              <b>${esc(a.level)} level</b>
            </div>
          </div>`
          )
          .join("")}
      </div>
        `
          : `<div class="subtitle" style="margin-top: 8px;">Domain-level scores not available for this report.</div>`
      }

      ${
        sectionScores.length > 0
          ? `
      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line);">
        <div style="font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 8px;">Detailed section scores</div>
        <div class="areaScoreGrid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));">
          ${sectionScores
            .map(
              (a) => `
            <div class="areaScoreCard">
              <div class="areaScoreTitle" style="font-size: 11px;">${esc(a.title)}</div>
              <div class="areaScoreBar">
                <div class="areaScoreFill ${a.level.toLowerCase()}" style="width: ${a.score}%;"></div>
              </div>
              <div class="areaScoreMeta">
                <span>${a.outOf5}/5</span>
                <b>${esc(a.level)}</b>
              </div>
            </div>`
            )
            .join("")}
        </div>
      </div>
        `
          : ""
      }
    </div>
      `
      : "";

  const narrativeSummary =
    vm.viewModel.forensic?.summary && typeof vm.viewModel.forensic.summary === "string"
      ? `
    <div class="section pageBreak">
      <h2>Clinical Narrative</h2>
      <div class="subtitle" style="margin-top: 4px;">Clinical-grade audit narrative generated from available imagery.</div>
      <div class="prose">${esc(vm.viewModel.forensic.summary).replaceAll("\n", "<br/>")}</div>
    </div>
      `
      : "";

  const overallScore =
    typeof vm.viewModel.score === "number" && Number.isFinite(vm.viewModel.score)
      ? vm.viewModel.score
      : null;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>HairAudit Report</title>

  <style>
    @page { size: A4; margin: 16mm 14mm; }

    :root {
      --ink: #0b0d12;
      --muted: #5b6472;
      --line: #e6e8ee;
      --card: #f7f8fb;
      --soft: #fbfbfd;
    }

    * { box-sizing: border-box; }

    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: var(--ink);
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .wrap { max-width: 900px; margin: 0 auto; }
    .pageBreak { page-break-before: always; }

    .topbar {
      display:flex;
      justify-content:space-between;
      gap: 16px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: linear-gradient(180deg, #ffffff 0%, var(--soft) 100%);
      page-break-inside: avoid;
    }

    .brand { display:flex; gap: 12px; align-items:flex-start; }

    .mark {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: radial-gradient(circle at 30% 20%, #fff, #eef1f7);
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight: 900;
    }

    .title { margin: 0; font-size: 18px; font-weight: 800; }
    .subtitle { margin-top: 4px; font-size: 12px; color: var(--muted); }

    .meta {
      text-align:right;
      font-size: 11px;
      color: var(--muted);
      line-height: 1.4;
    }
    .meta b { color: var(--ink); }

    .section {
      margin-top: 18px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #fff;
      page-break-inside: avoid;
    }

    .sectionHead { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .pillRow { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }

    .pill {
      display:inline-flex; gap:6px; align-items:center;
      padding: 6px 10px; border-radius: 999px;
      border: 1px solid var(--line); background: #fff;
      font-size: 11px; color: var(--muted);
    }
    .pill b { color: var(--ink); }

    .scoreGrid { display:grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-top: 12px; }

    .scoreCard {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px;
      background: linear-gradient(180deg, #fff 0%, var(--soft) 100%);
    }
    .scoreLabel { font-size: 12px; color: var(--muted); }
    .scoreValue { font-size: 42px; font-weight: 900; letter-spacing: -0.03em; line-height: 1; margin-top: 6px; }
    .scoreSub { font-size: 11px; color: var(--muted); margin-top: 4px; }

    .metricCard { border: 1px solid var(--line); border-radius: 16px; padding: 14px; background:#fff; }
    .metricTitle { font-size: 12px; color: var(--muted); margin-bottom: 8px; font-weight: 700; }
    .metricList { display:grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
    .metricList div { display:flex; justify-content:space-between; gap:10px; font-size: 11px; }
    .metricList span { color: var(--muted); }
    .metricList b { color: var(--ink); }

    .twoCol { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .listCard { border: 1px solid var(--line); border-radius: 16px; padding: 14px; background:#fff; }
    .listTitle { font-size: 12px; font-weight: 800; margin-bottom: 8px; }
    .listCard ul { margin: 0; padding-left: 18px; }
    .listCard li { font-size: 11px; color: var(--ink); margin: 6px 0; }

    .areaScoreGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-top: 14px; }
    .areaScoreCard {
      border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: #fff;
      display: flex; flex-direction: column; gap: 8px;
    }
    .areaScoreTitle { font-size: 12px; font-weight: 700; color: var(--ink); }
    .areaScoreBar { height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; }
    .areaScoreFill { height: 100%; border-radius: 4px; }
    .areaScoreFill.high { background: #059669; }
    .areaScoreFill.medium { background: #d97706; }
    .areaScoreFill.low { background: #dc2626; }
    .areaScoreMeta { font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; }
    .areaScoreMeta b { color: var(--ink); }

    .footer {
      margin-top: 18px;
      font-size: 10px;
      color: var(--muted);
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }

    .footerDebug {
      margin-top: 4px;
      font-size: 10px;
      color: var(--muted);
    }

    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

    .prose { margin-top: 10px; font-size: 12px; line-height: 1.55; color: var(--ink); }

    .radarWrap { margin-top: 12px; display:flex; justify-content:center; }
    .radarImg {
      width: 100%;
      max-width: 560px;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: #0b1226;
      padding: 10px;
    }

    .photoCat { margin-top: 14px; page-break-inside: avoid; }
    .photoCatTitle { font-size: 12px; font-weight: 800; margin-bottom: 8px; color: var(--ink); text-transform: capitalize; }
    .photoGrid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .photo { margin: 0; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: #fff; }
    .photo img { display:block; width: 100%; height: 170px; object-fit: cover; }
    .photo figcaption { padding: 8px 10px; font-size: 10px; color: var(--muted); border-top: 1px solid var(--line); }

    @media print {
      .photo img { height: 165px; }
    }
  </style>
</head>

<body>
  <div class="wrap">

    <div class="topbar">
      <div class="brand">
        <div class="mark">HA</div>
        <div>
          <h1 class="title">HairAudit Report</h1>
          <div class="subtitle">Clinical report</div>
        </div>
      </div>

      <div class="meta">
        <div><b>Case:</b> <span class="mono">${esc(caseId)}</span></div>
        <div><b>Status:</b> ${esc(String(caseStatus ?? ""))}</div>
        <div><b>Created:</b> ${esc(caseCreatedAt ?? "")}</div>
        <div><b>Generated:</b> ${esc(generatedAt)}</div>
      </div>
    </div>

    <div class="section">
      <div class="sectionHead">
        <h2>Clinical Scorecard</h2>
        <div class="pillRow">
          <span class="pill">Grade: <b>${esc(String(grade ?? "Needs Review"))}</b></span>
          <span class="pill">Confidence: <b>${esc(String(confidenceLabel ?? "medium"))}</b></span>
          ${
            version
              ? `<span class="pill">Report: <b>v${esc(String(version))}</b></span>`
              : `<span class="pill">Report: <b>—</b></span>`
          }
        </div>
      </div>

      <div class="scoreGrid">
        <div class="scoreCard">
          <div class="scoreLabel">Overall Score</div>
          <div class="scoreValue">${overallScore === null ? "—" : esc(String(overallScore))}</div>
          <div class="scoreSub">out of 100</div>
        </div>

        <div class="metricCard">
          <div class="metricTitle">Key Metrics</div>
          <div class="metricList">
            <div><span>Donor quality</span><b>${esc(metrics.donorQuality)}</b></div>
            <div><span>Survival estimate</span><b>${esc(metrics.graftSurvival)}</b></div>
            <div><span>Transection risk</span><b>${esc(metrics.transectionRisk)}</b></div>
            <div><span>Implant density</span><b>${esc(metrics.implantationDensity)}</b></div>
            <div><span>Hairline naturalness</span><b>${esc(metrics.hairlineNaturalness)}</b></div>
            <div><span>Donor scar visibility</span><b>${esc(metrics.donorScarVisibility)}</b></div>
          </div>
        </div>
      </div>

      ${
        radarDataUri
          ? `
      <div style="margin-top: 12px;">
        <div style="font-size: 12px; font-weight: 800;">Audit Performance Signature</div>
        <div class="subtitle" style="margin-top: 4px;">“This visual signature represents structural balance across core transplant domains.”</div>
        <div class="radarWrap">
          <img class="radarImg" src="${radarDataUri}" alt="Radar chart" />
        </div>
      </div>
      `
          : ""
      }

      <div class="twoCol">
        <div class="listCard">
          <div class="listTitle">Highlights</div>
          ${
            highlights.length
              ? `<ul>${highlights.map((x) => `<li>${esc(String(x))}</li>`).join("")}</ul>`
              : `<div class="subtitle">No highlights captured yet.</div>`
          }
        </div>

        <div class="listCard">
          <div class="listTitle">Risks / Watch-outs</div>
          ${
            risks.length
              ? `<ul>${risks.map((x) => `<li>${esc(String(x))}</li>`).join("")}</ul>`
              : `<div class="subtitle">No risks flagged yet.</div>`
          }
        </div>
      </div>
    </div>

    ${areaScoresBlock}
    ${narrativeSummary}
    ${photosBlock}
    ${doctorBlockHtml ?? ""}

    <div class="footer">
      HairAudit is an audit/reporting platform. This report is informational and not a medical diagnosis.
      ${debugFooter ?? ""}
    </div>

  </div>
</body>
</html>`;

  return html;
}

