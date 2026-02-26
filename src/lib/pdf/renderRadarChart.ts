import { createCanvas } from "@napi-rs/canvas";
import {
  Chart,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
  type Plugin,
} from "chart.js";

let chartJsRegistered = false;
function ensureChartJsRegistered() {
  if (chartJsRegistered) return;
  Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);
  chartJsRegistered = true;
}

export type RadarChartRenderInput = {
  /** Section scores 0–100 (each axis). */
  section_scores: Record<string, number>;
  /** Overall score 0–100 (center watermark). */
  overall_score: number;
  /** Confidence 0–1 (small label). */
  confidence: number;
  /** Render size (px). */
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

// Optional extra axes (if present in inputs). Kept separate so the primary 8 remain stable.
const OPTIONAL_AXES: Array<{ key: string; label: string }> = [{ key: "complications_and_risks", label: "Complications & Risks" }];

function wrapLabel(label: string, maxLength: number): string[] {
  const s = String(label ?? "").trim();
  if (!s) return [""];
  if (s.length <= maxLength) return [s];
  const words = s.split(/\s+/g).filter(Boolean);
  if (words.length <= 1) return [s.slice(0, maxLength).trim(), s.slice(maxLength).trim()].filter(Boolean).slice(0, 2);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxLength) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
    if (lines.length >= 2) break;
  }
  if (lines.length < 2 && cur) lines.push(cur);
  if (lines.length > 2) return lines.slice(0, 2);
  // Ensure max 2 lines; if overflow, compact the remainder into line 2.
  if (lines.length === 2 && words.join(" ").length > lines.join(" ").length) {
    const used = lines.join(" ");
    const rest = words.join(" ").slice(used.length).trim();
    if (rest) lines[1] = `${lines[1]} ${rest}`.trim();
  }
  return lines.slice(0, 2);
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clamp100(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function confidenceLabel(c01: number) {
  if (c01 >= 0.8) return "High";
  if (c01 >= 0.55) return "Medium";
  return "Low";
}

export function renderRadarChartPng(input: RadarChartRenderInput): RadarChartRenderOutput {
  ensureChartJsRegistered();

  const width = Math.max(420, Math.floor(input.width ?? 900));
  const height = Math.max(280, Math.floor(input.height ?? 520));

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  // Ensure high-quality rendering (server-side, no DOM).
  try {
    (ctx as any).imageSmoothingEnabled = true;
  } catch {
    /* ignore */
  }

  const scores = input.section_scores ?? {};
  // Render only available axes (6–10). Primary axes first; optionally add extras.
  const available = new Set(Object.keys(scores ?? {}).filter(Boolean));
  const ordered = [
    ...PRIMARY_AXES.filter((a) => available.has(a.key)),
    ...OPTIONAL_AXES.filter((a) => available.has(a.key)),
  ].slice(0, 10);

  const labels = ordered.map((x) => x.label);
  const values = ordered.map((x) => clamp100(Number(scores[x.key] ?? 0)));

  const overall = clamp100(Number(input.overall_score));
  const conf01 = clamp01(Number(input.confidence));
  const confPct = Math.round(conf01 * 100);
  const conf = confidenceLabel(conf01);

  const bgA = "#081225"; // dark navy
  const bgB = "#042a2a"; // deep teal
  const teal = "rgba(45, 212, 191, 0.95)"; // teal-400
  const tealFill = "rgba(45, 212, 191, 0.25)";
  const gold = "rgba(251, 191, 36, 0.95)"; // amber-400
  const grid = "rgba(148, 163, 184, 0.08)"; // faint premium rings
  const axis = "rgba(255, 255, 255, 0.15)"; // subtle spokes
  const label = "#cbd5e1"; // slate-300

  const bgPlugin: Plugin<"radar"> = {
    id: "ha_bg",
    beforeDraw(chart) {
      const { ctx, chartArea } = chart;
      ctx.save();
      // Dark navy -> deep teal gradient background.
      const bgGrad = ctx.createLinearGradient(0, 0, chart.width, chart.height);
      bgGrad.addColorStop(0, bgA);
      bgGrad.addColorStop(1, bgB);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, chart.width, chart.height);

      // Subtle radial glow
      const cx = (chartArea?.left ?? 0) + (chartArea?.right ?? chart.width) / 2;
      const cy = (chartArea?.top ?? 0) + (chartArea?.bottom ?? chart.height) / 2;
      const r = Math.max(chart.width, chart.height) * 0.55;
      const glowGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, r);
      glowGrad.addColorStop(0, "rgba(45, 212, 191, 0.10)");
      glowGrad.addColorStop(0.6, "rgba(251, 191, 36, 0.05)");
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    },
  };

  const glowPlugin: Plugin<"radar"> = {
    id: "ha_glow",
    beforeDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.shadowBlur = 18;
      ctx.shadowColor = "rgba(45, 212, 191, 0.55)";
    },
    afterDatasetsDraw(chart) {
      chart.ctx.restore();
    },
  };

  const centerPlugin: Plugin<"radar"> = {
    id: "ha_center",
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Watermark score
      ctx.globalAlpha = 0.11;
      ctx.fillStyle = "rgba(226, 232, 240, 1)";
      ctx.font = `800 ${Math.round(chart.height * 0.16)}px Arial`;
      ctx.fillText(String(Math.round(overall)), cx, cy - 6);

      // Confidence label
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(226, 232, 240, 0.86)";
      ctx.font = `600 ${Math.round(chart.height * 0.035)}px Arial`;
      ctx.fillText(`Confidence: ${conf} (${confPct}%)`, cx, cy + Math.round(chart.height * 0.10));

      ctx.restore();
    },
  };

  // If no section scores provided at all, render an empty but styled card.
  if (!scores || typeof scores !== "object" || Object.keys(scores).length === 0) {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, bgA);
    grad.addColorStop(1, bgB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = label;
    ctx.font = "600 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Section score breakdown unavailable", width / 2, height / 2);
    return { buffer: canvas.toBuffer("image/png"), width, height };
  }

  // Auto-scale label font size if many axes.
  const axisCount = labels.length;
  const pointLabelFontSize = axisCount > 8 ? (axisCount > 10 ? 9 : 10) : 12;
  const maxLabelLen = axisCount > 8 ? 12 : 14;

  const chart = new Chart(ctx as any, {
    type: "radar",
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderColor: teal,
          backgroundColor: tealFill,
          pointBackgroundColor: gold,
          pointBorderColor: "#0b1226",
          pointRadius: 3,
          pointHoverRadius: 3,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      maintainAspectRatio: false,
      // More padding so pointLabels can render without clipping in PDF.
      layout: { padding: { top: 26, right: 34, bottom: 26, left: 34 } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        r: {
          suggestedMin: 0,
          suggestedMax: 100,
          min: 0,
          max: 100,
          ticks: {
            display: false,
            stepSize: 25, // faint circular markers at 25/50/75/100 (and 0)
            backdropColor: "rgba(0,0,0,0)",
          },
          grid: {
            circular: true,
            // Emphasize 25/50/75/100 rings slightly without numeric labels.
            color: (c: any) => {
              const v = Number(c?.tick?.value);
              if (!Number.isFinite(v)) return grid;
              if (v === 100) return "rgba(148, 163, 184, 0.12)";
              if (v === 75) return "rgba(148, 163, 184, 0.10)";
              if (v === 50) return "rgba(148, 163, 184, 0.09)";
              if (v === 25) return "rgba(148, 163, 184, 0.085)";
              return "rgba(148, 163, 184, 0.06)";
            },
          },
          angleLines: { color: axis },
          pointLabels: {
            display: true,
            color: label,
            padding: 10,
            font: { size: pointLabelFontSize, weight: "500" as any },
            callback: (raw: any) => {
              const s = String(raw ?? "");
              const lines = wrapLabel(s, maxLabelLen);
              return lines.length ? lines : [s];
            },
          },
        },
      },
      elements: {
        line: { tension: 0.25 },
      },
    },
    plugins: [bgPlugin, glowPlugin, centerPlugin],
  });

  chart.update();
  const buffer = canvas.toBuffer("image/png");
  chart.destroy();
  return { buffer, width, height };
}

