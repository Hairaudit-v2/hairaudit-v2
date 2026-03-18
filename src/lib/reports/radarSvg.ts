/**
 * Shared radar chart SVG renderer for HairAudit reports.
 * Used by both production EliteReportHtml and demo report for consistent, readable radar labels and center text.
 */

export function clamp01(n: number) {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

export function clamp100(n: number) {
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

export function renderRadarSvg(opts: {
  labels: string[];
  values: number[];
  size: number;
  levels: number;
  overall: number;
  confidence: number;
}): string {
  const size = Math.max(360, Math.floor(opts.size));
  const levels = Math.max(3, Math.min(7, Math.floor(opts.levels)));

  const maxAxes = 10;
  const hardCapAxes = opts.labels.length > maxAxes ? 8 : maxAxes;
  const labels = opts.labels.slice(0, hardCapAxes);
  const values = opts.values.slice(0, labels.length);

  const n = labels.length;
  const width = size;
  const height = size;
  const cx = width / 2;
  const cy = height / 2;
  const padding = n <= 5 ? 126 : n <= 7 ? 114 : 104;
  const rMax = Math.max(60, Math.min(width, height) / 2 - padding);
  const angleStep = (2 * Math.PI) / Math.max(1, n);

  const labelFontSize = n > 8 ? 14 : 18;
  const maxLabelLen = n > 8 ? 12 : 18;

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
    const opacity = idx === levels - 1 ? 0.2 : 0.12;
    return `<polygon points="${pointsFor(r)}" fill="none" stroke="rgba(148,163,184,${opacity})" stroke-width="1.1"/>`;
  }).join("\n  ");

  const spokes = Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const x = cx + rMax * Math.cos(angle);
    const y = cy + rMax * Math.sin(angle);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`;
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
    : `<polygon points="${valuePts.map((p) => `${p.x},${p.y}`).join(" ")}" fill="rgba(45,212,191,0.25)" stroke="rgba(45,212,191,0.96)" stroke-width="2.8"/>`;
  const dots = allZeros
    ? ""
    : valuePts
        .map(
          (p) =>
            `<circle cx="${p.x}" cy="${p.y}" r="3.2" fill="rgba(251,191,36,0.96)" stroke="#0b1226" stroke-width="1"/>`
        )
        .join("\n  ");

  const labelColor = "#f1f5f9";
  const labelElems = labels
    .map((label, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const labelDist = rMax + 38;
      const tx = cx + labelDist * Math.cos(angle);
      const ty = cy + labelDist * Math.sin(angle);
      const anchor =
        Math.abs(Math.cos(angle)) < 0.28 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
      const lines = wrapLabel(label, maxLabelLen);
      return lines
        .map((line, j) => {
          const dy = (j - (lines.length - 1) / 2) * (labelFontSize + 3);
          return `<text x="${tx}" y="${ty + dy}" fill="${labelColor}" font-size="${labelFontSize}" font-weight="700" font-family="Arial,sans-serif" text-anchor="${anchor}" dominant-baseline="middle">${escapeXml(line)}</text>`;
        })
        .join("\n  ");
    })
    .join("\n  ");

  const overall = Math.round(clamp100(opts.overall));
  const conf01 = clamp01(opts.confidence);
  const confPct = Math.round(conf01 * 100);

  const centerRadius = Math.round(Math.min(width, height) * 0.14);
  const scoreFontSize = Math.round(height * 0.2);
  const confFontSize = Math.max(14, Math.round(height * 0.045));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible">
  <defs>
    <linearGradient id="eliteRadarBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#06101c"/>
      <stop offset="1" stop-color="#031f1f"/>
    </linearGradient>
    <radialGradient id="eliteRadarGlow" cx="50%" cy="45%" r="60%">
      <stop offset="0" stop-color="rgba(45,212,191,0.06)"/>
      <stop offset="0.55" stop-color="rgba(251,191,36,0.03)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" rx="16" ry="16" fill="url(#eliteRadarBg)"/>
  <rect x="0" y="0" width="${width}" height="${height}" rx="16" ry="16" fill="url(#eliteRadarGlow)"/>

  ${ringPolys}
  ${spokes}
  ${polygon}
  ${dots}

  <circle cx="${cx}" cy="${cy}" r="${centerRadius}" fill="rgba(0,0,0,0.35)"/>
  <text x="${cx}" y="${cy - 4}" fill="#f1f5f9" font-size="${scoreFontSize}" font-weight="800" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">${overall}</text>
  <text x="${cx}" y="${cy + Math.round(height * 0.095)}" fill="#e2e8f0" font-size="${confFontSize}" font-weight="700" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">Confidence: ${confPct}%</text>
  ${allZeros ? `<text x="${cx}" y="${cy + Math.round(height * 0.16)}" fill="#cbd5e1" font-size="12" font-weight="600" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">Performance data will populate as sections are scored</text>` : ""}
  <text x="${cx}" y="${height - 14}" fill="#cbd5e1" font-size="12" font-weight="700" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">Audit Performance Signature</text>

  ${labelElems}
</svg>`;
}
