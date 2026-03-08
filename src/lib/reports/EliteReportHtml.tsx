import type { ReportViewModel } from "@/lib/pdf/reportBuilder";

type AreaScoreItem = {
  title: string;
  score: number;
  outOf5: number;
  level: string;
};

type EliteRadarVm = {
  labels: string[];
  values: number[]; // 0-100
  overall: number; // 0-100
  confidence: number; // 0-1
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
  radar?: EliteRadarVm;
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

function clamp01(n: number) {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

function clamp100(n: number) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
}

function escapeXml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapLabel(label: string, maxLen: number): string[] {
  const s = String(label ?? "").trim();
  if (!s || s.length <= maxLen) return [s || ""];
  const words = s.split(/\s+/g).filter(Boolean);
  if (words.length <= 1) return [s.slice(0, maxLen), s.slice(maxLen)].filter(Boolean).slice(0, 2);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxLen) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
    if (lines.length >= 2) break;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

// Radar is rendered as inline SVG (not server-side PNG) to avoid serverless wasm bundling issues.
function renderRadarSvg(opts: {
  labels: string[];
  values: number[];
  size: number;
  levels: number;
  overall: number;
  confidence: number;
}): string {
  const size = Math.max(360, Math.floor(opts.size));
  const levels = Math.max(3, Math.min(7, Math.floor(opts.levels)));

  // Best-effort cap (labels stay readable for print).
  const maxAxes = 10;
  const hardCapAxes = opts.labels.length > maxAxes ? 8 : maxAxes;
  const labels = opts.labels.slice(0, hardCapAxes);
  const values = opts.values.slice(0, labels.length);

  const n = labels.length;
  const width = size;
  const height = size;
  const cx = width / 2;
  const cy = height / 2;
  const padding = 98; // room for labels, avoid clipping in print
  const rMax = Math.max(60, Math.min(width, height) / 2 - padding);
  const angleStep = (2 * Math.PI) / Math.max(1, n);

  const labelFontSize = n > 8 ? 10 : 12;
  const maxLabelLen = n > 8 ? 12 : 14;

  const pointsFor = (r: number) =>
    Array.from({ length: n }, (_, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x},${y}`;
    }).join(" ");

  const ringPolys = Array.from({ length: levels }, (_, idx) => {
    const pct = (idx + 1) / levels;
    const r = rMax * pct;
    const opacity = idx === levels - 1 ? 0.14 : 0.09;
    return `<polygon points="${pointsFor(r)}" fill="none" stroke="rgba(148,163,184,${opacity})" stroke-width="1"/>`;
  }).join("\n  ");

  const spokes = Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const x = cx + rMax * Math.cos(angle);
    const y = cy + rMax * Math.sin(angle);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>`;
  }).join("\n  ");

  const valuePts = values.map((raw, i) => {
    const v = clamp100(Number(raw));
    const angle = -Math.PI / 2 + i * angleStep;
    const r = (v / 100) * rMax;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { x, y };
  });

  const allZeros = values.every((v) => !Number.isFinite(v) || Number(v) === 0);
  const polygon = allZeros
    ? ""
    : `<polygon points="${valuePts.map((p) => `${p.x},${p.y}`).join(" ")}" fill="rgba(45,212,191,0.23)" stroke="rgba(45,212,191,0.95)" stroke-width="2"/>`;
  const dots = allZeros
    ? ""
    : valuePts
        .map(
          (p) =>
            `<circle cx="${p.x}" cy="${p.y}" r="3.2" fill="rgba(251,191,36,0.96)" stroke="#0b1226" stroke-width="1"/>`
        )
        .join("\n  ");

  const labelElems = labels
    .map((label, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const tx = cx + (rMax + 30) * Math.cos(angle);
      const ty = cy + (rMax + 30) * Math.sin(angle);
      const anchor =
        Math.abs(Math.cos(angle)) < 0.28 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
      const lines = wrapLabel(label, maxLabelLen);
      return lines
        .map((line, j) => {
          const dy = (j - (lines.length - 1) / 2) * (labelFontSize + 2);
          return `<text x="${tx}" y="${ty + dy}" fill="rgba(226,232,240,0.82)" font-size="${labelFontSize}" font-weight="600" font-family="Arial,sans-serif" text-anchor="${anchor}" dominant-baseline="middle">${escapeXml(line)}</text>`;
        })
        .join("\n  ");
    })
    .join("\n  ");

  const overall = Math.round(clamp100(opts.overall));
  const conf01 = clamp01(opts.confidence);
  const confPct = Math.round(conf01 * 100);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible">
  <defs>
    <linearGradient id="eliteRadarBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#081225"/>
      <stop offset="1" stop-color="#042a2a"/>
    </linearGradient>
    <radialGradient id="eliteRadarGlow" cx="50%" cy="45%" r="60%">
      <stop offset="0" stop-color="rgba(45,212,191,0.10)"/>
      <stop offset="0.55" stop-color="rgba(251,191,36,0.06)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" rx="16" ry="16" fill="url(#eliteRadarBg)"/>
  <rect x="0" y="0" width="${width}" height="${height}" rx="16" ry="16" fill="url(#eliteRadarGlow)"/>

  ${ringPolys}
  ${spokes}
  ${polygon}
  ${dots}

  <text x="${cx}" y="${cy - 6}" fill="rgba(226,232,240,0.12)" font-size="${Math.round(
    height * 0.18
  )}" font-weight="800" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">${overall}</text>
  <text x="${cx}" y="${cy + Math.round(height * 0.11)}" fill="rgba(226,232,240,0.88)" font-size="${Math.round(
    height * 0.04
  )}" font-weight="700" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">Confidence: ${confPct}%</text>
  ${allZeros ? `<text x="${cx}" y="${cy + Math.round(height * 0.18)}" fill="rgba(226,232,240,0.6)" font-size="11" font-weight="600" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">Performance data will populate as sections are scored</text>` : ""}
  <text x="${cx}" y="${height - 18}" fill="rgba(226,232,240,0.72)" font-size="11" font-weight="600" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">Audit Performance Signature</text>

  ${labelElems}
</svg>`;
}

export function renderEliteReportHtml(vm: EliteReportViewModel): string {
  const {
    caseId,
    generatedAt,
    version,
    grade,
    confidenceLabel,
    metrics,
    areaDomains,
    sectionScores,
    highlights,
    risks,
    radar,
    photosByCategory,
    doctorBlockHtml,
    debugFooter,
  } = vm;

  const photoCategoryKeys = Object.keys(photosByCategory ?? {});
  const photoCatsWithItems = photoCategoryKeys.filter(
    (cat) => (photosByCategory[cat] ?? []).filter((x) => !!x?.signedUrl).length > 0
  );

  const photosBlock =
    photoCatsWithItems.length > 0
      ? `
    <div class="section pageBreak">
      <h2>Case Photos</h2>
      <div class="subtitle" style="margin-top: 4px;">Grouped by upload category.</div>
      ${photoCatsWithItems
        .map((cat) => {
          const items = (photosByCategory[cat] ?? []).filter((x) => !!x?.signedUrl);
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

  const hasAreaScores = (areaDomains?.length ?? 0) > 0 || (sectionScores?.length ?? 0) > 0;
  const areaScoresBlock = hasAreaScores
      ? `
    <div class="section pageBreak">
      <h2>Score by Area</h2>
      <div class="subtitle" style="margin-top: 4px;">Your score for each capture point (out of 5, with level).</div>
      ${
        (areaDomains?.length ?? 0) > 0
          ? `
      <div class="areaScoreGrid">
        ${(areaDomains ?? [])
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
        (sectionScores?.length ?? 0) > 0
          ? `
      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line);">
        <div style="font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 8px;">Detailed section scores</div>
        <div class="areaScoreGrid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));">
          ${(sectionScores ?? [])
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

  const narrativeText = (vm.viewModel.forensic?.summary ?? "").toString().trim();
  const narrativeSummary =
    narrativeText.length > 0
      ? `
    <div class="section pageBreak">
      <h2>Clinical Narrative</h2>
      <div class="subtitle" style="margin-top: 4px;">Clinical-grade audit narrative generated from available imagery.</div>
      <div class="prose">${esc(narrativeText).replaceAll("\n", "<br/>")}</div>
    </div>
      `
      : "";

  const overallScore =
    typeof vm.viewModel.score === "number" && Number.isFinite(vm.viewModel.score)
      ? vm.viewModel.score
      : null;
  const confidenceScorePct = (() => {
    const confFromPanel = Number((vm.viewModel as any)?.confidencePanel?.confidenceScore);
    const confFromRadar = Number(radar?.confidence);
    const conf = Number.isFinite(confFromPanel) ? confFromPanel : Number.isFinite(confFromRadar) ? confFromRadar : null;
    if (conf === null) return "N/A";
    return `${Math.round(clamp01(conf) * 100)}%`;
  })();

  const radarBlock =
    radar && Array.isArray(radar.labels) && Array.isArray(radar.values) && radar.labels.length >= 3
      ? `
      <div style="margin-top: 12px;">
        <div style="font-size: 12px; font-weight: 800;">Audit Performance Signature</div>
        <div class="subtitle" style="margin-top: 4px;">“This visual signature represents structural balance across core transplant domains.”</div>
        <div class="radarWrap">
          ${renderRadarSvg({
            labels: radar.labels,
            values: radar.values,
            size: 520,
            levels: 5,
            overall: radar.overall,
            confidence: radar.confidence,
          })}
        </div>
      </div>
      `
      : "";

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
      --card-radius: 14px;
      --card-padding: 14px;
      --card-gap: 12px;
    }

    * { box-sizing: border-box; }

    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: var(--ink);
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .wrap { max-width: 900px; margin: 0 auto; padding: 0 4px; }
    .pageBreak { page-break-before: always; }
    h2 { page-break-after: avoid; }

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
    .brandLogo {
      width: 54px;
      height: 54px;
      object-fit: contain;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: #fff;
      padding: 6px;
    }
    .title { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.01em; }
    .subtitle { margin-top: 2px; font-size: 12px; color: var(--muted); }
    .kicker { margin-top: 2px; font-size: 11px; color: #334155; font-weight: 700; }

    .meta {
      text-align:right;
      font-size: 11px;
      color: var(--muted);
      line-height: 1.4;
    }
    .meta b { color: var(--ink); }

    .section {
      margin-top: 18px;
      padding: var(--card-padding) 16px;
      border: 1px solid var(--line);
      border-radius: var(--card-radius);
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

    .scoreGrid { display:grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-top: 12px; page-break-inside: avoid; }

    .scoreCard {
      border: 1px solid var(--line);
      border-radius: var(--card-radius);
      padding: var(--card-padding);
      background: linear-gradient(180deg, #fff 0%, var(--soft) 100%);
    }
    .scoreLabel { font-size: 12px; color: var(--muted); }
    .scoreValue { font-size: 42px; font-weight: 900; letter-spacing: -0.03em; line-height: 1; margin-top: 6px; }
    .scoreSub { font-size: 11px; color: var(--muted); margin-top: 4px; }

    .metricCard { border: 1px solid var(--line); border-radius: var(--card-radius); padding: var(--card-padding); background:#fff; }
    .metricTitle { font-size: 12px; color: var(--muted); margin-bottom: 8px; font-weight: 700; }
    .metricList { display:grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
    .metricList div { display:flex; justify-content:space-between; gap:10px; font-size: 11px; flex-wrap: wrap; }
    .metricList span { color: var(--muted); }
    .metricList b { color: var(--ink); word-break: break-word; overflow-wrap: break-word; max-width: 65%; text-align: right; }

    .twoCol { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .listCard { border: 1px solid var(--line); border-radius: var(--card-radius); padding: var(--card-padding); background:#fff; page-break-inside: avoid; }
    .listTitle { font-size: 12px; font-weight: 800; margin-bottom: 8px; }
    .listCard ul { margin: 0; padding-left: 18px; }
    .listCard li { font-size: 11px; color: var(--ink); margin: 6px 0; }
    .wrapText { word-break: break-word; overflow-wrap: break-word; }

    .areaScoreGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-top: 14px; }
    .areaScoreCard {
      border: 1px solid var(--line); border-radius: var(--card-radius); padding: var(--card-padding); background: #fff;
      display: flex; flex-direction: column; gap: 8px;
      page-break-inside: avoid;
    }
    .areaScoreTitle { font-size: 12px; font-weight: 700; color: var(--ink); word-break: break-word; overflow-wrap: break-word; }
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

    .prose { margin-top: 10px; font-size: 12px; line-height: 1.55; color: var(--ink); word-break: break-word; overflow-wrap: break-word; }

    .radarWrap { margin-top: 12px; display:flex; justify-content:center; page-break-inside: avoid; }
    .radarWrap svg { max-width: 100%; height: auto; border-radius: 16px; border: 1px solid rgba(14,165,233,0.2); }

    .photoCat { margin-top: 14px; page-break-inside: avoid; }
    .photoCatTitle { font-size: 12px; font-weight: 800; margin-bottom: 8px; color: var(--ink); text-transform: capitalize; }
    .photoGrid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .photo { margin: 0; border: 1px solid var(--line); border-radius: var(--card-radius); overflow: hidden; background: #fff; page-break-inside: avoid; }
    .photo img { display:block; width: 100%; height: 170px; object-fit: cover; max-width: 100%; }
    .photo figcaption { padding: 8px 10px; font-size: 10px; color: var(--muted); border-top: 1px solid var(--line); word-break: break-word; overflow-wrap: break-word; min-height: 1.4em; line-height: 1.3; }

    @media print {
      .wrap { padding: 0; }
      .section { margin-top: 14px; padding: 12px 14px; }
      .topbar { padding: 12px 14px; }
      .photo img { height: 165px; }
      .photoGrid { gap: 8px; }
      .footer { page-break-inside: avoid; margin-top: 14px; padding-top: 6px; }
    }
  </style>
</head>

<body>
  <div class="wrap">

    <div class="topbar">
      <div class="brand">
        <img class="brandLogo" src="/hairaudit-logo.svg" alt="HairAudit logo" />
        <div>
          <h1 class="title">HairAudit™</h1>
          <div class="subtitle">AI Clinical Hair Transplant Audit</div>
          <div class="kicker">Powered by Follicle Intelligence</div>
        </div>
      </div>

      <div class="meta">
        <div><b>Case ID:</b> <span class="mono">${esc(caseId)}</span></div>
        <div><b>Report version:</b> ${version ? `v${esc(String(version))}` : "—"}</div>
        <div><b>Confidence score:</b> ${esc(confidenceScorePct)}</div>
        <div><b>Audit date:</b> ${esc(generatedAt)}</div>
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

      ${radarBlock}

      ${
        (highlights?.length ?? 0) > 0 || (risks?.length ?? 0) > 0
          ? `
      <div class="twoCol">
        <div class="listCard">
          <div class="listTitle">Highlights</div>
          ${
            (highlights?.length ?? 0) > 0
              ? `<ul>${(highlights ?? []).map((x) => `<li class="wrapText">${esc(String(x))}</li>`).join("")}</ul>`
              : `<div class="subtitle">None captured.</div>`
          }
        </div>

        <div class="listCard">
          <div class="listTitle">Risks / Watch-outs</div>
          ${
            (risks?.length ?? 0) > 0
              ? `<ul>${(risks ?? []).map((x) => `<li class="wrapText">${esc(String(x))}</li>`).join("")}</ul>`
              : `<div class="subtitle">None flagged.</div>`
          }
        </div>
      </div>
      `
          : ""
      }
    </div>

    ${areaScoresBlock}
    ${narrativeSummary}
    ${photosBlock}
    ${(vm.viewModel.auditMode === "doctor" || vm.viewModel.auditMode === "auditor") && doctorBlockHtml ? doctorBlockHtml : ""}

    <div class="footer">
      HairAudit is an audit/reporting platform. This report is informational and not a medical diagnosis.
      ${typeof debugFooter === "string" && debugFooter.trim().length > 0 ? `<div class="footerDebug">${debugFooter}</div>` : ""}
    </div>

  </div>
</body>
</html>`;

  return html;
}

