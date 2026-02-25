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

const KEY_LABELS: Array<{ key: string; label: string }> = [
  { key: "donor_management", label: "Donor" },
  { key: "extraction_quality", label: "Extraction" },
  { key: "recipient_placement", label: "Implantation" },
  { key: "hairline_design", label: "Hairline" },
  { key: "density_distribution", label: "Density" },
  { key: "graft_handling_and_viability", label: "Graft care" },
  { key: "post_op_course_and_aftercare", label: "Aftercare" },
  { key: "complications_and_risks", label: "Risks" },
  { key: "naturalness_and_aesthetics", label: "Aesthetics" },
];

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

  const scores = input.section_scores ?? {};
  // Always render all domains/axes (8+ visible) for a stable "signature" chart.
  const ordered = KEY_LABELS;

  const labels = ordered.map((x) => x.label);
  const values = ordered.map((x) => clamp100(Number(scores[x.key] ?? 0)));

  const overall = clamp100(Number(input.overall_score));
  const conf01 = clamp01(Number(input.confidence));
  const confPct = Math.round(conf01 * 100);
  const conf = confidenceLabel(conf01);

  const bg = "#0f172a"; // slate-900
  const teal = "rgba(45, 212, 191, 0.95)"; // teal-400
  const tealFill = "rgba(45, 212, 191, 0.20)";
  const gold = "rgba(251, 191, 36, 0.95)"; // amber-400
  const grid = "rgba(148, 163, 184, 0.16)"; // slate-400-ish
  const axis = "rgba(148, 163, 184, 0.12)";
  const label = "rgba(226, 232, 240, 0.92)"; // slate-200

  const bgPlugin: Plugin<"radar"> = {
    id: "ha_bg",
    beforeDraw(chart) {
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, chart.width, chart.height);

      // Subtle radial glow
      const cx = (chartArea?.left ?? 0) + (chartArea?.right ?? chart.width) / 2;
      const cy = (chartArea?.top ?? 0) + (chartArea?.bottom ?? chart.height) / 2;
      const r = Math.max(chart.width, chart.height) * 0.55;
      const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, r);
      grad.addColorStop(0, "rgba(45, 212, 191, 0.10)");
      grad.addColorStop(0.6, "rgba(251, 191, 36, 0.05)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
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
      ctx.globalAlpha = 0.16;
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
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = label;
    ctx.font = "600 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Section score breakdown unavailable", width / 2, height / 2);
    return { buffer: canvas.toBuffer("image/png"), width, height };
  }

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
          pointBorderColor: bg,
          pointRadius: 3,
          pointHoverRadius: 3,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      layout: { padding: { top: 18, right: 18, bottom: 18, left: 18 } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false },
          grid: { color: grid, circular: true },
          angleLines: { color: axis },
          pointLabels: {
            color: label,
            font: { size: 12, weight: "600" as any },
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

