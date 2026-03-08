import type { ReportViewModel } from "@/lib/pdf/reportBuilder";
import { buildSurgicalFingerprintSummary } from "@/lib/reports/surgicalFingerprint";

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
  const { caseId, generatedAt, version, metrics, areaDomains, sectionScores, highlights, risks, radar, photosByCategory, doctorBlockHtml, debugFooter } = vm;
  const overallScore = typeof vm.viewModel.score === "number" && Number.isFinite(vm.viewModel.score) ? vm.viewModel.score : null;

  const viewModelWithConfidence = vm.viewModel as ReportViewModel & {
    confidencePanel?: { confidenceScore?: number };
    forensic?: {
      summary?: string;
      key_findings?: Array<{
        title?: string;
        impact?: string;
        recommended_next_step?: string;
        evidence?: Array<{ observation?: string }>;
      }>;
      surgical_fingerprint?: {
        donor_extraction_pattern?: {
          label?: string;
          confidence?: "high" | "moderate" | "low";
          observation?: string;
          why_it_matters?: string;
        };
        recipient_site_distribution?: {
          label?: string;
          confidence?: "high" | "moderate" | "low";
          observation?: string;
          why_it_matters?: string;
        };
        hairline_transition_pattern?: {
          label?: string;
          confidence?: "high" | "moderate" | "low";
          observation?: string;
          why_it_matters?: string;
        };
        density_consistency_signature?: {
          label?: string;
          confidence?: "high" | "moderate" | "low";
          observation?: string;
          why_it_matters?: string;
        };
        direction_angle_coherence?: {
          label?: string;
          confidence?: "high" | "moderate" | "low";
          observation?: string;
          why_it_matters?: string;
        };
      };
    };
  };
  const confidenceNumeric =
    typeof viewModelWithConfidence.confidencePanel?.confidenceScore === "number"
      ? viewModelWithConfidence.confidencePanel.confidenceScore
      : typeof radar?.confidence === "number"
        ? radar.confidence
        : null;
  const confidenceScorePct = confidenceNumeric == null ? "N/A" : `${Math.round(clamp01(confidenceNumeric) * 100)}%`;

  const scoreBand = (() => {
    if (overallScore == null) return { label: "Review", color: "#F6C46D" };
    if (overallScore >= 90) return { label: "Platinum", color: "#DDE7F5" };
    if (overallScore >= 80) return { label: "Gold", color: "#F5E6A7" };
    if (overallScore >= 70) return { label: "Silver", color: "#E6E6E6" };
    if (overallScore >= 60) return { label: "Bronze", color: "#E9D0B3" };
    return { label: "Review", color: "#F6C46D" };
  })();

  const forensic = viewModelWithConfidence.forensic;
  const keyFindings = Array.isArray(forensic?.key_findings) ? forensic.key_findings : [];
  const narrativeText = String(forensic?.summary ?? "").trim();
  const norm = (s: string) => s.toLowerCase();
  const average = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);

  const findScore = (matchers: string[]) => {
    const domainScores = areaDomains
      .filter((d) => matchers.some((m) => norm(d.title).includes(m)))
      .map((d) => d.score);
    if (domainScores.length) return average(domainScores);
    const secScores = sectionScores
      .filter((s) => matchers.some((m) => norm(s.title).includes(m)))
      .map((s) => s.score);
    return average(secScores);
  };

  const domains = [
    {
      title: "Donor Management",
      match: ["donor"],
      clinical: "Even donor extraction patterns are important to reduce long-term donor thinning or visible patchiness risk.",
      monitoring: "Monitor donor density and pattern uniformity over the next 6-12 months.",
    },
    {
      title: "Recipient Site Design",
      match: ["recipient", "hairline", "naturalness", "design"],
      clinical: "Recipient site design affects frontal naturalness, transition softness, and long-term visual balance.",
      monitoring: "Track symmetry, transition softness, and zone blending during maturation.",
    },
    {
      title: "Graft Handling",
      match: ["graft", "hydrat", "viability", "storage", "out-of-body"],
      clinical: "Graft handling conditions can influence viability and growth consistency.",
      monitoring: "If concerns persist, request more detailed handling documentation and follow-up context.",
    },
    {
      title: "Implantation Technique",
      match: ["implant", "placement", "spacing", "angle", "density"],
      clinical: "Implantation spacing and angle consistency influence achieved density and natural appearance.",
      monitoring: "Monitor maturation density and pattern consistency in frontal and mid-scalp zones.",
    },
    {
      title: "Documentation Quality",
      match: ["document", "aftercare", "safety", "evidence", "photo"],
      clinical: "Documentation quality determines how confidently procedural quality can be interpreted.",
      monitoring: "Request additional follow-up imagery or records where evidence remains limited.",
    },
  ];

  const domainBlocks = domains
    .map((domain) => {
      const score = findScore(domain.match);
      const matchingFindings = keyFindings.filter((f) =>
        domain.match.some((m) => norm(String(f?.title ?? "")).includes(m) || norm(String(f?.impact ?? "")).includes(m))
      );
      const narrative =
        String(matchingFindings[0]?.impact ?? "").trim() ||
        (score == null
          ? "Evidence was insufficient to produce a high-confidence explanatory narrative for this domain."
          : score >= 80
            ? "Observed indicators are generally consistent with strong execution in this domain."
            : score >= 65
              ? "Observed indicators are mixed, with acceptable features and some uncertainty."
              : "Observed indicators suggest this domain may require closer clinical follow-up.");
      const evidence = matchingFindings
        .flatMap((f) => (Array.isArray(f?.evidence) ? f.evidence : []))
        .map((e) => String(e?.observation ?? "").trim())
        .filter(Boolean)
        .slice(0, 3);
      const guidance = String(matchingFindings[0]?.recommended_next_step ?? "").trim() || domain.monitoring;

      const scoreWidth = score == null ? 12 : Math.max(5, Math.min(100, Math.round(score)));
      const scoreClass = score == null ? "low" : score >= 80 ? "high" : score >= 60 ? "medium" : "low";
      const scoreLabel = score == null ? "Insufficient evidence" : `${Math.round(score)} / 100`;

      return `
      <div class="domainBlock">
        <h3>${esc(domain.title)}</h3>
        <div class="domainScoreRow">
          <div class="domainScoreText">${esc(scoreLabel)}</div>
          <div class="areaScoreBar"><div class="areaScoreFill ${scoreClass}" style="width:${scoreWidth}%;"></div></div>
        </div>
        <div class="prose">${esc(narrative)}</div>
        <div class="subhead">Supporting Evidence</div>
        <ul class="miniList">
          ${(evidence.length ? evidence : ["Insufficient evidence for detailed supporting observations in this domain."])
            .map((e) => `<li>${esc(e)}</li>`)
            .join("")}
        </ul>
        <div class="subhead">Clinical Relevance</div>
        <p class="miniText">${esc(domain.clinical)}</p>
        <div class="subhead">Monitoring Guidance</div>
        <p class="miniText">${esc(guidance)}</p>
      </div>`;
    })
    .join("");

  const photoCategoryKeys = Object.keys(photosByCategory ?? {});
  const photoCatsWithItems = photoCategoryKeys.filter((cat) => (photosByCategory[cat] ?? []).some((x) => !!x?.signedUrl));
  const allPhotos = photoCatsWithItems.flatMap((cat) => (photosByCategory[cat] ?? []).filter((x) => !!x?.signedUrl));
  const catLower = photoCatsWithItems.map((x) => x.toLowerCase());
  const donorViews = catLower.filter((x) => x.includes("donor")).length;
  const recipientViews = catLower.filter((x) => x.includes("recipient") || x.includes("front") || x.includes("top") || x.includes("crown")).length;
  const intraViews = catLower.filter((x) => x.includes("intra")).length;

  const photoBlock =
    photoCatsWithItems.length === 0
      ? `<div class="subtitle">No image groups available.</div>`
      : photoCatsWithItems
          .map((cat) => {
            const items = (photosByCategory[cat] ?? []).filter((x) => !!x?.signedUrl);
            const confidenceTag = items.length >= 3 ? "High confidence" : items.length === 2 ? "Moderate confidence" : "Low confidence";
            const observation = cat.toLowerCase().includes("donor")
              ? "Donor region appears reviewed for extraction distribution and overharvesting pattern signals."
              : cat.toLowerCase().includes("recipient")
                ? "Recipient region appears reviewed for spacing consistency and density distribution cues."
                : cat.toLowerCase().includes("intra")
                  ? "Intra-operative images provide procedural context where available."
                  : "Image group contributes contextual pattern evidence.";
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
              <p class="miniText"><b>AI Observations:</b> ${esc(observation)} <span class="confTag">${esc(confidenceTag)}</span></p>
            </div>`;
          })
          .join("");

  const patientGuidance = domains.map((d) => d.monitoring).slice(0, 4);
  const predictiveOutlook =
    metrics.graftSurvival.toLowerCase().includes("insufficient")
      ? "Based on currently submitted evidence, graft survival projection remains low-confidence and should be interpreted cautiously."
      : `Based on available visual density patterns, observed implantation quality appears broadly consistent with a ${esc(metrics.graftSurvival)} graft survival expectation range.`;

  const fingerprintSummary = buildSurgicalFingerprintSummary({
    areaDomains,
    sectionScores,
    findings: keyFindings,
    highlights,
    risks,
    photosByCategory,
    confidence01: confidenceNumeric,
    surgicalFingerprint: forensic?.surgical_fingerprint,
  });
  const fingerprintCards = fingerprintSummary.cards
    .map((card) => {
      const confidenceClass =
        card.confidence === "high" ? "fpPillHigh" : card.confidence === "moderate" ? "fpPillModerate" : "fpPillLow";
      const confidenceText = card.confidence.charAt(0).toUpperCase() + card.confidence.slice(1);
      const stripe = [0, 1, 2, 3, 4]
        .map((idx) => {
          const threshold = (idx + 1) * 20;
          const active = card.strength >= threshold;
          return `<span class="fpStripDot ${active ? "active" : ""}"></span>`;
        })
        .join("");
      return `
      <div class="fpCard">
        <div class="fpHead">
          <div class="fpTitleWrap">
            <span class="fpIcon">${esc(card.icon)}</span>
            <h3 class="fpTitle">${esc(card.title)}</h3>
          </div>
          <span class="fpPill ${confidenceClass}">${esc(confidenceText)}</span>
        </div>
        <div class="fpLabel">${esc(card.label)}</div>
        <p class="miniText"><b>AI Observation:</b> ${esc(card.observation)}</p>
        <p class="miniText"><b>Why It Matters:</b> ${esc(card.whyItMatters)}</p>
        ${card.limitation ? `<p class="miniText"><b>Limitation:</b> ${esc(card.limitation)}</p>` : ""}
        <div class="fpStrip" aria-hidden="true">${stripe}</div>
      </div>`;
    })
    .join("");

  const radarBlock =
    radar && Array.isArray(radar.labels) && Array.isArray(radar.values) && radar.labels.length >= 3
      ? `
      <div style="margin-top: 12px;">
        <div style="font-size: 12px; font-weight: 800;">Audit Performance Signature</div>
        <div class="subtitle" style="margin-top: 4px;">Structural balance across core transplant domains.</div>
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
        <div class="miniText">Primary axes: Donor Management, Recipient Site Design, Graft Handling, Implantation Technique, Documentation Quality.</div>
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
      background: linear-gradient(180deg, #ffffff 0%, #f3f8ff 100%);
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
      background: radial-gradient(circle at 25% 20%, #ffffff 0%, #eef6ff 100%);
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
    .domainBlock { border: 1px solid var(--line); border-radius: var(--card-radius); padding: 12px; margin-top: 10px; background: #fff; }
    .domainBlock h3 { margin: 0 0 8px; font-size: 14px; }
    .domainScoreRow { display: grid; grid-template-columns: 140px 1fr; gap: 10px; align-items: center; margin-bottom: 8px; }
    .domainScoreText { font-size: 12px; font-weight: 800; }
    .subhead { margin-top: 8px; font-size: 11px; font-weight: 800; color: var(--muted); }
    .miniList { margin: 6px 0 0; padding-left: 18px; }
    .miniList li { font-size: 11px; margin: 4px 0; }
    .miniText { margin: 6px 0 0; font-size: 11px; color: var(--ink); line-height: 1.45; }
    .confTag { margin-left: 8px; font-size: 10px; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; background: #fff; }
    .execGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .bandBadge { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--line); font-size: 11px; font-weight: 800; margin-top: 8px; }
    .limitPanel { margin-top: 12px; border: 1px solid var(--line); border-radius: 12px; padding: 10px; background: #f6fbff; font-size: 11px; }
    .fingerprintSection {
      margin-top: 18px;
      border: 1px solid rgba(56, 189, 248, 0.22);
      border-radius: 16px;
      background:
        radial-gradient(circle at 10% 5%, rgba(125, 211, 252, 0.12), rgba(255,255,255,0) 45%),
        radial-gradient(circle at 90% 10%, rgba(45, 212, 191, 0.08), rgba(255,255,255,0) 45%),
        linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      padding: 14px;
      page-break-inside: avoid;
    }
    .fpGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    .fpCard {
      border: 1px solid rgba(148, 163, 184, 0.32);
      border-radius: 12px;
      padding: 10px;
      background: linear-gradient(180deg, #ffffff 0%, #f9fcff 100%);
      box-shadow: 0 0 0 1px rgba(125, 211, 252, 0.08), 0 8px 24px rgba(15, 23, 42, 0.04);
    }
    .fpHead { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .fpTitleWrap { display: flex; align-items: center; gap: 6px; }
    .fpIcon {
      width: 20px; height: 20px; border-radius: 999px; border: 1px solid var(--line);
      display: inline-flex; align-items: center; justify-content: center; font-size: 11px;
      background: #fff;
    }
    .fpTitle { margin: 0; font-size: 12px; font-weight: 800; }
    .fpLabel { margin-top: 6px; font-size: 12px; font-weight: 700; color: #0f172a; }
    .fpPill { font-size: 10px; font-weight: 800; border-radius: 999px; padding: 3px 8px; border: 1px solid transparent; }
    .fpPillHigh { background: #dcfce7; color: #166534; border-color: #86efac; }
    .fpPillModerate { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
    .fpPillLow { background: #e2e8f0; color: #334155; border-color: #cbd5e1; }
    .fpStrip { margin-top: 8px; display: flex; gap: 4px; }
    .fpStripDot { width: 14px; height: 5px; border-radius: 999px; background: #e2e8f0; display: inline-block; }
    .fpStripDot.active { background: #38bdf8; }

    @media print {
      .wrap { padding: 0; }
      .section { margin-top: 14px; padding: 12px 14px; }
      .topbar { padding: 12px 14px; }
      .fpGrid { grid-template-columns: 1fr; }
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
          <h1 class="title">HairAudit AI Surgical Analysis</h1>
          <div class="subtitle">AI-assisted visual analysis of hair transplant surgical outcomes and documentation quality.</div>
          <div class="kicker">Powered by Follicle Intelligence</div>
        </div>
      </div>

      <div class="meta">
        <div><b>Case ID:</b> <span class="mono">${esc(caseId)}</span></div>
        <div><b>Report version:</b> ${version ? `v${esc(String(version))}` : "—"}</div>
        <div><b>AI confidence level:</b> ${esc(confidenceScorePct)}</div>
        <div><b>Audit date:</b> ${esc(generatedAt)}</div>
      </div>
    </div>

    <div class="section">
      <div class="sectionHead">
        <h2>Executive AI Summary</h2>
        <div class="pillRow">
          <span class="pill">Overall Surgical Quality Score</span>
          ${
            version
              ? `<span class="pill">Report: <b>v${esc(String(version))}</b></span>`
              : `<span class="pill">Report: <b>—</b></span>`
          }
        </div>
      </div>

      <div class="scoreGrid">
        <div class="scoreCard">
          <div class="scoreLabel">AI Score</div>
          <div class="scoreValue">${overallScore === null ? "—" : esc(String(overallScore))}</div>
          <div class="scoreSub">out of 100</div>
          <div class="bandBadge" style="background:${scoreBand.color};">${esc(scoreBand.label)} band</div>
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

      <div class="execGrid">
        <div class="listCard">
          <div class="listTitle">Data Integrity Summary</div>
          <ul>
            <li>Images analysed: ${allPhotos.length}</li>
            <li>Donor views: ${donorViews}</li>
            <li>Recipient views: ${recipientViews}</li>
            <li>Intra-operative images: ${intraViews}</li>
          </ul>
          <div class="miniText">
            This analysis is generated using a multi-layer visual pattern recognition engine that evaluates donor extraction patterns, recipient site design, graft distribution, and documentation completeness. The confidence score reflects the quality and completeness of the submitted evidence.
          </div>
        </div>
        <div class="listCard">
          <div class="listTitle">Risk Indicators</div>
          <ul>
            <li>✔ Strong indicators: ${highlights.length}</li>
            <li>⚠ Areas requiring review: ${risks.length}</li>
            <li>ℹ Limited evidence: ${allPhotos.length === 0 ? 1 : 0}</li>
          </ul>
          <div class="miniText">
            Confidence reflects the amount and clarity of visual evidence available. Higher confidence indicates more comprehensive documentation and clearer imagery.
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

    <div class="section pageBreak">
      <h2>Detailed Section Analysis</h2>
      <div class="subtitle">Why this score was assigned, what it means, and what to monitor.</div>
      ${domainBlocks}
    </div>

    <div class="section pageBreak">
      <h2>Photo Evidence Analysis</h2>
      <div class="subtitle">Grouped visual evidence with confidence context.</div>
      ${photoBlock}
      <div class="limitPanel">
        <b>Evidence Limitations:</b>
        ${
          allPhotos.length === 0
            ? " Limited evidence was available for visual assessment."
            : " Limited or missing viewpoints may reduce confidence for graft handling and procedural detail interpretation."
        }
      </div>
    </div>

    <div class="fingerprintSection">
      <h2>AI Surgical Fingerprint Analysis</h2>
      <div class="subtitle">Pattern-based visual review of extraction, implantation, spacing, and density consistency.</div>
      <div class="fpGrid">${fingerprintCards}</div>
      ${
        fingerprintSummary.limitedEvidence
          ? `<div class="limitPanel"><b>Evidence note:</b> Pattern interpretation is limited by available image quality or angle coverage in one or more domains.</div>`
          : ""
      }
    </div>

    <div class="section">
      <h2>Findings, Risks, and Recommendations</h2>
      <div class="twoCol">
        <div class="listCard">
          <div class="listTitle">Key Positive Indicators</div>
          ${
            highlights.length > 0
              ? `<ul>${highlights.map((x) => `<li class="wrapText">✔ ${esc(String(x))}</li>`).join("")}</ul>`
              : `<div class="subtitle">No strong indicators identified with high confidence.</div>`
          }
        </div>
        <div class="listCard">
          <div class="listTitle">Areas Requiring Attention</div>
          ${
            risks.length > 0
              ? `<ul>${risks.map((x) => `<li class="wrapText">⚠ ${esc(String(x))}</li>`).join("")}</ul>`
              : `<div class="subtitle">No major concerns flagged from current evidence.</div>`
          }
        </div>
      </div>
      <div class="listCard" style="margin-top:12px;">
        <div class="listTitle">Patient Guidance</div>
        <ul>${patientGuidance.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
      <div class="listCard" style="margin-top:12px;">
        <div class="listTitle">Predictive Outlook</div>
        <div class="miniText">${predictiveOutlook}</div>
      </div>
      ${
        narrativeText.length > 0
          ? `<div class="listCard" style="margin-top:12px;"><div class="listTitle">Clinical Narrative</div><div class="prose">${esc(narrativeText).replaceAll("\n", "<br/>")}</div></div>`
          : ""
      }
    </div>

    ${(vm.viewModel.auditMode === "doctor" || vm.viewModel.auditMode === "auditor") && doctorBlockHtml ? doctorBlockHtml : ""}

    <div class="footer">
      This report provides an AI-assisted visual assessment based on the submitted images and available metadata.
      It does not represent a definitive graft count or medical diagnosis.
      ${typeof debugFooter === "string" && debugFooter.trim().length > 0 ? `<div class="footerDebug">${debugFooter}</div>` : ""}
    </div>

  </div>
</body>
</html>`;

  return html;
}

