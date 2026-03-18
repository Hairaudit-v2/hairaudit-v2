/**
 * Pure SVG radar chart → PNG via svg2png-wasm. No @napi-rs/canvas or chart.js.
 * Keeps Vercel serverless functions under 300MB.
 */
import { svg2png, initialize } from "svg2png-wasm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let wasmInitialized = false;
async function ensureWasm() {
  if (wasmInitialized) return;
  const wasmPath = join(process.cwd(), "node_modules", "svg2png-wasm", "svg2png_wasm_bg.wasm");
  await initialize(readFileSync(wasmPath));
  wasmInitialized = true;
}

export type RadarChartRenderInput = {
  section_scores: Record<string, number>;
  overall_score: number;
  confidence: number;
  width?: number;
  height?: number;
};

export type RadarChartRenderOutput = {
  buffer: Buffer;
  width: number;
  height: number;
};

const PRIMARY_AXES: Array<{ key: string; label: string }> = [
  { key: "donor_management", label: "Donor Management" },
  { key: "extraction_quality", label: "Extraction Quality" },
  { key: "graft_handling_and_viability", label: "Graft Handling" },
  { key: "recipient_placement", label: "Recipient Implantation" },
  { key: "density_distribution", label: "Density Distribution" },
  { key: "hairline_design", label: "Hairline Design" },
  { key: "post_op_course_and_aftercare", label: "Safety & Aftercare" },
  { key: "naturalness_and_aesthetics", label: "Naturalness" },
];

const OPTIONAL_AXES: Array<{ key: string; label: string }> = [{ key: "complications_and_risks", label: "Complications & Risks" }];

function clamp01(n: number) {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}
function clamp100(n: number) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
}

function confidenceLabel(c01: number) {
  if (c01 >= 0.8) return "High";
  if (c01 >= 0.55) return "Medium";
  return "Low";
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

function buildSvg(input: RadarChartRenderInput): string {
  const width = Math.max(420, Math.floor(input.width ?? 900));
  const height = Math.max(280, Math.floor(input.height ?? 520));

  const scores = input.section_scores ?? {};
  const available = new Set(Object.keys(scores).filter(Boolean));
  const ordered = [
    ...PRIMARY_AXES.filter((a) => available.has(a.key)),
    ...OPTIONAL_AXES.filter((a) => available.has(a.key)),
  ].slice(0, 10);

  const values = ordered.map((x) => clamp100(Number(scores[x.key] ?? 0)));
  const overall = clamp100(Number(input.overall_score));
  const conf01 = clamp01(Number(input.confidence));
  const confPct = Math.round(conf01 * 100);
  const conf = confidenceLabel(conf01);

  const cx = width / 2;
  const cy = height / 2;
  const rMax = Math.min(width, height) * 0.38;
  const n = ordered.length;
  const angleStep = (2 * Math.PI) / Math.max(1, n);

  const polyPoints = values.map((v, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = (v / 100) * rMax;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return `${x},${y}`;
  });

  const gridRings = [25, 50, 75, 100].map((pct) => {
    const r = (pct / 100) * rMax;
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const angle = -Math.PI / 2 + (i % n) * angleStep;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x},${y}`;
    });
    const opacity = pct === 100 ? 0.2 : pct === 75 ? 0.16 : pct === 50 ? 0.14 : 0.12;
    return `<polygon points="${pts.join(" ")}" fill="none" stroke="rgba(148,163,184,${opacity})" stroke-width="1"/>`;
  });

  const axisLines = ordered.map((_, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const x = cx + rMax * Math.cos(angle);
    const y = cy + rMax * Math.sin(angle);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>`;
  });

  // Readable labels for PDF/print: larger font, high-contrast solid color
  const labelFontSize = n > 8 ? (n > 10 ? 11 : 13) : 15;
  const maxLabelLen = n > 8 ? 12 : 14;
  const labelColor = "#f1f5f9";
  const labelDist = rMax + 28;
  const labelElems = ordered.map((ax, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const tx = cx + labelDist * Math.cos(angle);
    const ty = cy + labelDist * Math.sin(angle);
    const lines = wrapLabel(ax.label, maxLabelLen);
    const anchor = Math.abs(Math.cos(angle)) < 0.3 ? "middle" : angle > 0 ? "start" : "end";
    return lines.map((line, j) => {
      const dy = (j - (lines.length - 1) / 2) * (labelFontSize + 2);
      return `<text x="${tx}" y="${ty + dy}" fill="${labelColor}" font-size="${labelFontSize}" font-weight="700" font-family="Arial,sans-serif" text-anchor="${anchor}" dominant-baseline="middle">${escapeXml(line)}</text>`;
    }).join("\n    ");
  });

  function escapeXml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  if (n === 0 || values.every((v) => v === 0)) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06101c"/><stop offset="1" stop-color="#031f1f"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <text x="${cx}" y="${cy}" fill="#e2e8f0" font-size="18" font-weight="700" font-family="Arial" text-anchor="middle" dominant-baseline="middle">Section score breakdown unavailable</text>
</svg>`;
  }

  // Dark overlay behind center for score/confidence readability; toned-down glow
  const centerR = Math.min(width, height) * 0.12;
  const scoreFontSize = Math.round(height * 0.14);
  const confFontSize = Math.max(12, Math.round(height * 0.032));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06101c"/><stop offset="1" stop-color="#031f1f"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="55%">
      <stop offset="0" stop-color="rgba(45,212,191,0.06)"/>
      <stop offset="0.6" stop-color="rgba(251,191,36,0.03)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  ${gridRings.join("\n  ")}
  ${axisLines.join("\n  ")}
  <polygon points="${polyPoints.join(" ")}" fill="rgba(45,212,191,0.25)" stroke="rgba(45,212,191,0.95)" stroke-width="2"/>
  ${ordered.map((_, i) => {
    const [x, y] = polyPoints[i].split(",").map(Number);
    return `<circle cx="${x}" cy="${y}" r="3" fill="rgba(251,191,36,0.95)" stroke="#0b1226" stroke-width="1"/>`;
  }).join("\n  ")}
  <circle cx="${cx}" cy="${cy}" r="${centerR}" fill="rgba(0,0,0,0.35)"/>
  <text x="${cx}" y="${cy - 4}" fill="#f1f5f9" font-size="${scoreFontSize}" font-weight="800" font-family="Arial" text-anchor="middle" dominant-baseline="middle">${Math.round(overall)}</text>
  <text x="${cx}" y="${cy + Math.round(height * 0.1)}" fill="#e2e8f0" font-size="${confFontSize}" font-weight="700" font-family="Arial" text-anchor="middle" dominant-baseline="middle">Confidence: ${conf} (${confPct}%)</text>
  ${labelElems.join("\n  ")}
</svg>`;
}

export async function renderRadarChartPng(input: RadarChartRenderInput): Promise<RadarChartRenderOutput> {
  await ensureWasm();

  const width = Math.max(420, Math.floor(input.width ?? 900));
  const height = Math.max(280, Math.floor(input.height ?? 520));

  const svg = buildSvg(input);
  const png = await svg2png(svg, { width, height, backgroundColor: "#06101c" });

  return { buffer: Buffer.from(png), width, height };
}
