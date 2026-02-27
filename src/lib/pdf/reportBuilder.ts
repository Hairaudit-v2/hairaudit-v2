/**
 * Shared PDF report builder for HairAudit.
 * Uses brand colours (slate-900, amber-500) and supports logo + embedded images.
 */

import type PDFKit from "pdfkit";

// Brand colours (from globals.css)
const SLATE_900 = "#0f172a";
const SLATE_600 = "#475569";
const SLATE_400 = "#94a3b8";
const AMBER_500 = "#f59e0b";
const AMBER_600 = "#d97706";

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Typography hierarchy (premium)
const H1_SIZE = 28; // bold
const H2_SIZE = 18; // "semi" (Helvetica-Bold is closest available)
const BODY_SIZE = 12;
const META_SIZE = 9;

const PAGE_TOP_CONTENT_Y = 95;

function setOpacity(doc: PDFKit.PDFDocument, value: number) {
  try {
    (doc as any).opacity?.(value);
  } catch {
    /* ignore */
  }
}

function drawNeuralWatermark(doc: PDFKit.PDFDocument) {
  const pageW = (doc.page as any).width as number;
  const pageH = (doc.page as any).height as number;

  // Very subtle "Follicle Intelligence" neural-style pattern.
  // Draw behind content; do not change doc.x/doc.y.
  doc.save();
  try {
    // Keep it extremely light
    (doc as any).opacity?.(0.06);
  } catch {
    /* opacity may not exist in older pdfkit; safe to ignore */
  }

  const dot = "#38bdf8"; // sky-ish
  const line = "#2dd4bf"; // teal-ish

  // Confine pattern mostly to body area (avoid header block)
  const top = 86;
  const bottom = pageH - 60;
  const left = 26;
  const right = pageW - 26;

  const stepX = 84;
  const stepY = 70;

  const nodes: Array<{ x: number; y: number }> = [];
  let row = 0;
  for (let y = top; y <= bottom; y += stepY) {
    let col = 0;
    for (let x = left; x <= right; x += stepX) {
      // deterministic "jitter"
      const jx = ((row * 17 + col * 23) % 11) - 5;
      const jy = ((row * 29 + col * 13) % 9) - 4;
      nodes.push({ x: x + jx, y: y + jy });
      col += 1;
    }
    row += 1;
  }

  // Connect sparse edges
  doc.strokeColor(line).lineWidth(0.6);
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]!;
    // connect to next few nodes to create a neural network feel
    for (let j = 1; j <= 2; j++) {
      const b = nodes[i + j];
      if (!b) continue;
      // only connect if close-ish vertically
      if (Math.abs(b.y - a.y) <= stepY + 10) {
        doc.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke();
      }
    }
  }

  // Draw nodes
  doc.fillColor(dot);
  for (const n of nodes) {
    doc.circle(n.x, n.y, 1.3).fill();
  }

  // A faint brand wordmark watermark
  doc.fillColor("#f59e0b");
  doc.font("Helvetica-Bold").fontSize(26);
  try {
    (doc as any).opacity?.(0.035);
  } catch {}
  doc.text("Follicle Intelligence", 0, pageH * 0.56, { width: pageW, align: "center" });
  doc.restore();
}

export type ReportImage = { buffer: Buffer; label: string; type?: string };

export type AuditReportContent = {
  caseId: string;
  version: number;
  generatedAt: string;
  isManual?: boolean;
  score?: number | null;
  donorQuality?: string;
  graftSurvival?: string;
  notes?: string;
  findings?: string[];
  model?: string;
  uploadCount?: number;
  confidencePanel?: {
    photoCount: number;
    missingCategories?: string[];
    confidenceScore: number; // 0–1
    confidenceLabel: string;
    limitations?: string[];
  };
  /** Radar chart inputs (rendered server-side to PNG, embedded under Overall Score). */
  radar?: {
    section_scores: Record<string, number>;
    overall_score: number;
    confidence: number;
  };
  areaScores?: {
    domains?: Record<string, number>;
    sections?: Record<string, number>;
  };
  forensic?: {
    summary?: string;
    key_findings?: Array<{
      title: string;
      severity: "low" | "medium" | "high" | "critical";
      impact: string;
      recommended_next_step: string;
      evidence: Array<{ source_type: string; source_key: string; observation: string; confidence: number }>;
    }>;
    red_flags?: Array<{
      flag: string;
      why_it_matters: string;
      evidence: Array<{ source_type: string; source_key: string; observation: string; confidence: number }>;
    }>;
    non_medical_disclaimer?: string;
    domain_scores_v1?: {
      version?: number;
      domains?: Array<{
        domain_id: string;
        title: string;
        raw_score: number;
        confidence: number;
        evidence_grade: string;
        weighted_score: number;
      }>;
    };
    benchmark?: { eligible?: boolean; gate_version?: string; reasons?: string[] };
    completeness_index_v1?: { version?: number; score?: number; breakdown?: any };
    confidence_model_v1?: { version?: number; evidence_grade?: string; confidence_multiplier?: number; base_multiplier?: number; penalties?: any[]; inputs?: any };
    overall_scores_v1?: { version?: number; performance_score?: number; confidence_grade?: string; confidence_multiplier?: number; benchmark_score?: number; domain_weights?: any };
    tiers_v1?: Array<{ tier_id?: string; title?: string; eligible?: boolean; reasons?: string[] }>;
  };
  /** patient = patient-only audit; omit doctor-style sections (benchmark, v1 domains, completeness) */
  auditMode?: "patient" | "full";
  graftIntegrity?: {
    auditor_status: "approved" | "pending" | "needs_more_evidence" | "rejected";
    claimed_grafts: number | null;
    estimated_extracted: { min: number | null; max: number | null };
    estimated_implanted: { min: number | null; max: number | null };
    variance_claimed_vs_implanted_pct: { min: number | null; max: number | null };
    confidence: number;
    confidence_label: "low" | "medium" | "high";
    limitations: string[];
  } | null;
  images?: ReportImage[];
};

function scoreTier(score: number) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s <= 49) return { label: "High Concern", color: "#ef4444" };
  if (s <= 69) return { label: "Moderate Risk", color: "#f59e0b" };
  if (s <= 84) return { label: "Clinically Acceptable", color: "#22c55e" };
  return { label: "High Standard Execution", color: "#10b981" };
}

function addScoreBadge(doc: PDFKit.PDFDocument, score: number) {
  const x = MARGIN;
  const w = CONTENT_WIDTH;
  const h = 128;
  const y0 = doc.y;

  const s = Math.max(0, Math.min(100, Math.round(score)));
  const tier = scoreTier(s);

  // Premium backing card (dark, subtle)
  const card = doc.linearGradient(x, y0, x + w, y0 + h);
  card.stop(0, "#0b1226").stop(1, "#111827");

  doc.save();
  doc.roundedRect(x, y0, w, h, 18).fillColor(card).fill();
  setOpacity(doc, 0.35);
  doc.roundedRect(x, y0, w, h, 18).strokeColor(AMBER_500).lineWidth(1).stroke();
  setOpacity(doc, 1);

  // Circular badge
  const r = 44;
  const cx = x + 22 + r;
  const cy = y0 + 20 + r;

  // Radial gradient (fallback to linear if radial not available)
  const radial = (doc as any).radialGradient?.(cx - 10, cy - 12, 6, cx, cy, r) ?? doc.linearGradient(cx - r, cy - r, cx + r, cy + r);
  // PDFKit gradients do not accept CSS rgba() strings. Use hex + explicit opacity.
  radial.stop(0, "#2dd4bf", 0.35).stop(0.55, SLATE_900, 0.95).stop(1, "#020617", 1);

  // Outer glow ring
  setOpacity(doc, 0.35);
  doc.circle(cx, cy, r + 2).strokeColor("#2dd4bf").lineWidth(2).stroke();
  setOpacity(doc, 1);

  doc.circle(cx, cy, r).fillColor(radial).fill();
  setOpacity(doc, 0.35);
  doc.circle(cx, cy, r).strokeColor(AMBER_500).lineWidth(1).stroke();
  setOpacity(doc, 1);

  // Score text (dominant)
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(54);
  doc.text(String(s), cx - r, cy - 22, { width: r * 2, align: "center" });
  setOpacity(doc, 0.88);
  doc.fillColor("#e2e8f0").font("Helvetica").fontSize(12);
  doc.text("/100", cx - r, cy + 20, { width: r * 2, align: "center" });
  setOpacity(doc, 1);

  // Right-side label stack
  const rx = cx + r + 22;
  const rw = x + w - rx - 18;

  setOpacity(doc, 0.9);
  doc.fillColor("#e2e8f0").font("Helvetica-Bold").fontSize(12);
  doc.text("AI Score", rx, y0 + 26, { width: rw });
  setOpacity(doc, 1);

  setOpacity(doc, 0.9);
  doc.fillColor("#2dd4bf").font("Helvetica-Bold").fontSize(10);
  doc.text("Executive Intelligence Layer", rx, y0 + 44, { width: rw });
  setOpacity(doc, 1);

  setOpacity(doc, 0.92);
  doc.fillColor("#e2e8f0").font("Helvetica").fontSize(11);
  doc.text("Audit Classification:", rx, y0 + 70, { width: rw, continued: true });
  doc.fillColor(tier.color).font("Helvetica-Bold").text(` ${tier.label}`);
  setOpacity(doc, 1);

  // Tier hint (small)
  setOpacity(doc, 0.9);
  doc.fillColor(SLATE_400).font("Helvetica").fontSize(9);
  doc.text("Tier bands: 0–49 / 50–69 / 70–84 / 85+", rx, y0 + 92, { width: rw });
  setOpacity(doc, 1);

  doc.restore();
  doc.y = y0 + h + 16;
}

function severityStyle(sev: string) {
  const s = String(sev || "").toLowerCase();
  if (s === "critical") return { fill: "#7f1d1d", text: "#fee2e2", stroke: "#ef4444" };
  if (s === "high") return { fill: "#991b1b", text: "#fee2e2", stroke: "#f87171" };
  if (s === "medium") return { fill: "#78350f", text: "#fffbeb", stroke: "#f59e0b" };
  return { fill: "#0f172a", text: "#e2e8f0", stroke: "#38bdf8" }; // low/default
}

function addClinicalNarrative(doc: PDFKit.PDFDocument, content: AuditReportContent) {
  const f = content.forensic;
  if (!f) return;

  // Start narrative on a fresh page for authority + whitespace.
  doc.addPage();
  doc.x = MARGIN;
  doc.y = MARGIN;

  addSectionHeading(doc, "Clinical Narrative");
  doc.fillColor(SLATE_900).font("Helvetica").fontSize(BODY_SIZE);
  const summary = String(f.summary ?? content.notes ?? "").trim();
  doc.text(summary || "—", { width: CONTENT_WIDTH });
  doc.moveDown(1.0);

  const keyFindings = Array.isArray(f.key_findings) ? f.key_findings : [];
  if (keyFindings.length) {
    addSectionHeading(doc, "Key Findings (Clinical Rationale)");

    const pageH = (doc.page as any).height as number;
    const bottomLimit = pageH - MARGIN - 40;

    for (const kf of keyFindings.slice(0, 10)) {
      const title = String(kf.title ?? "").trim();
      const impact = String(kf.impact ?? "").trim();
      const next = String(kf.recommended_next_step ?? "").trim();
      const ev = Array.isArray(kf.evidence) ? kf.evidence : [];

      const evText = ev.slice(0, 3).map((e) => `• ${String(e.observation ?? "").trim()}`).join("\n");

      // Measure using the exact fonts + widths we render with.
      // This prevents overlap when PDFKit wraps differently than our estimate.
      const measureCardHeight = () => {
        const w = CONTENT_WIDTH;
        const pillW = 78;
        const pillH = 18;
        const innerW = w - 28; // x+14 padding both sides
        const titleW = w - 14 - pillW - 18; // matches render width for title
        const nextLabelW = 58;
        const nextW = Math.max(40, innerW - nextLabelW);
        const evW = w - 36; // matches render width at x+22

        doc.save();

        doc.font("Helvetica-Bold").fontSize(12);
        const hTitle = doc.heightOfString(title || "Key finding", { width: titleW });

        doc.font("Helvetica").fontSize(11);
        const hImpact = doc.heightOfString(impact || "—", { width: innerW });

        doc.font("Helvetica-Bold").fontSize(10);
        const hNextLabel = doc.heightOfString("Next step:", { width: nextLabelW });
        doc.font("Helvetica").fontSize(10);
        const hNext = doc.heightOfString(next || "—", { width: nextW });
        const hNextRow = Math.max(hNextLabel, hNext);

        let hEvidence = 0;
        if (evText) {
          doc.font("Helvetica-Bold").fontSize(9);
          const hSupport = doc.heightOfString("Support:", { width: innerW });
          doc.font("Helvetica").fontSize(9);
          const hEv = doc.heightOfString(evText, { width: evW });
          hEvidence = hSupport + 4 + hEv;
        }

        doc.restore();

        const topPad = 14;
        const headerBlock = Math.max(pillH, Math.max(16, hTitle));
        const gapAfterHeader = 6;
        const gapAfterImpact = 8;
        const gapAfterNext = 6;
        const bottomPad = 14;

        return topPad + headerBlock + gapAfterHeader + hImpact + gapAfterImpact + hNextRow + gapAfterNext + hEvidence + bottomPad;
      };

      const needed = measureCardHeight();

      if (doc.y + needed > bottomLimit && doc.y > MARGIN + 30) {
        doc.addPage();
        doc.x = MARGIN;
        doc.y = MARGIN;
        addSectionHeading(doc, "Key Findings (continued)");
      }

      // Card
      const x = MARGIN;
      const w = CONTENT_WIDTH;
      const y0 = doc.y;

      const bg = doc.linearGradient(x, y0, x, y0 + needed);
      bg.stop(0, "#ffffff").stop(1, "#f8fafc");
      doc.roundedRect(x, y0, w, needed, 14).fillColor(bg).fill();
      doc.roundedRect(x, y0, w, needed, 14).strokeColor("#e2e8f0").lineWidth(1).stroke();

      // Severity pill (right)
      const sev = severityStyle(kf.severity);
      const pillW = 78;
      const pillH = 18;
      const pillX = x + w - pillW - 14;
      const pillY = y0 + 14;
      doc.roundedRect(pillX, pillY, pillW, pillH, 9).fillColor(sev.fill).fill();
      doc.roundedRect(pillX, pillY, pillW, pillH, 9).strokeColor(sev.stroke).lineWidth(0.8).stroke();
      doc.fillColor(sev.text).font("Helvetica-Bold").fontSize(9);
      doc.text(String(kf.severity ?? "low").toUpperCase(), pillX, pillY + 4, { width: pillW, align: "center" });

      // Title
      doc.fillColor(SLATE_900).font("Helvetica-Bold").fontSize(12);
      doc.text(title || "Key finding", x + 14, y0 + 14, { width: w - 14 - pillW - 18 });

      // Use measured heights/widths (no guessing) to avoid overlap.
      const innerW = w - 28;
      const nextLabelW = 58;
      const nextW = Math.max(40, innerW - nextLabelW);
      const evW = w - 36;

      doc.save();
      doc.font("Helvetica-Bold").fontSize(12);
      const hTitle = doc.heightOfString(title || "Key finding", { width: w - 14 - pillW - 18 });
      doc.font("Helvetica").fontSize(11);
      const hImpact = doc.heightOfString(impact || "—", { width: innerW });
      doc.font("Helvetica-Bold").fontSize(10);
      const hNextLabel = doc.heightOfString("Next step:", { width: nextLabelW });
      doc.font("Helvetica").fontSize(10);
      const hNext = doc.heightOfString(next || "—", { width: nextW });
      const hNextRow = Math.max(hNextLabel, hNext);
      doc.restore();

      let y = y0 + 14 + Math.max(16, hTitle) + 6;

      // Impact (clinical-grade explanation)
      doc.fillColor(SLATE_600).font("Helvetica").fontSize(11);
      doc.text(impact || "—", x + 14, y, { width: w - 28 });
      y += hImpact + 8;

      // Next step
      doc.fillColor(SLATE_900).font("Helvetica-Bold").fontSize(10);
      doc.text("Next step:", x + 14, y, { continued: false });
      doc.fillColor(SLATE_600).font("Helvetica").fontSize(10);
      doc.text(next || "—", x + 14 + nextLabelW, y, { width: nextW });
      y += hNextRow + 6;

      // Evidence snippets (1–3)
      if (evText) {
        doc.fillColor(SLATE_400).font("Helvetica-Bold").fontSize(9);
        doc.text("Support:", x + 14, y);
        // Advance by actual support label height (prevents overlap on font fallback)
        doc.save();
        doc.font("Helvetica-Bold").fontSize(9);
        const hSupport = doc.heightOfString("Support:", { width: innerW });
        doc.restore();
        y += hSupport + 4;
        doc.fillColor(SLATE_600).font("Helvetica").fontSize(9);
        doc.text(evText, x + 22, y, { width: evW });
      }

      doc.y = y0 + needed + 12;
    }
  }

  const redFlags = Array.isArray(f.red_flags) ? f.red_flags : [];
  if (redFlags.length) {
    addSectionHeading(doc, "Red Flags");
    doc.fillColor(SLATE_600).font("Helvetica").fontSize(11);
    for (const rf of redFlags.slice(0, 8)) {
      doc.fillColor("#991b1b").font("Helvetica-Bold").fontSize(11);
      doc.text(`• ${String(rf.flag ?? "").trim()}`);
      doc.fillColor(SLATE_600).font("Helvetica").fontSize(10);
      doc.text(String(rf.why_it_matters ?? "").trim(), { indent: 12 });
      doc.moveDown(0.6);
    }
  }

  if (f.non_medical_disclaimer) {
    doc.moveDown(0.6);
    doc.fillColor(SLATE_400).font("Helvetica").fontSize(META_SIZE);
    doc.text(String(f.non_medical_disclaimer).trim(), { width: CONTENT_WIDTH });
  }
}

/**
 * Add branded header. Pass logoBuffer (PNG/JPEG) to embed a logo.
 */
function addHeader(doc: PDFKit.PDFDocument, logoBuffer?: Buffer) {
  doc.save();
  doc.rect(0, 0, PAGE_WIDTH, 80).fill(SLATE_900);
  let x = MARGIN;
  if (logoBuffer && logoBuffer.length > 0) {
    try {
      doc.image(logoBuffer, MARGIN, 12, { width: 50, height: 50 });
      x = MARGIN + 58;
    } catch {
      /* ignore */
    }
  }
  doc.fillColor("#ffffff");
  doc.fontSize(H1_SIZE).font("Helvetica-Bold");
  doc.text("HairAudit", x, 28, { width: 300 });
  doc.fontSize(11).font("Helvetica");
  doc.fillColor(SLATE_400);
  doc.text("Professional Hair Transplant Audit Report", x, 55);
  doc.restore();
  doc.moveDown(3.6);
}

/**
 * Add metadata block.
 */
function addMeta(doc: PDFKit.PDFDocument, content: AuditReportContent) {
  doc.fillColor(SLATE_600);
  doc.fontSize(META_SIZE);
  doc.text(`Case ID: ${content.caseId}`, { continued: false });
  doc.text(`Version: v${content.version}`);
  doc.text(`Generated: ${content.generatedAt}${content.isManual ? " (manual audit)" : ""}`);
  doc.moveDown(2.1);
}

/**
 * Add section heading with amber accent.
 */
function addSectionHeading(doc: PDFKit.PDFDocument, title: string) {
  doc.save();
  doc.moveDown(0.9);
  doc.fillColor(AMBER_600);
  doc.rect(MARGIN, doc.y, 4, 16).fill();
  doc.fillColor(SLATE_900);
  doc.fontSize(H2_SIZE).font("Helvetica-Bold");
  const y0 = doc.y;
  doc.text(title, MARGIN + 10, y0 - 1, { width: CONTENT_WIDTH - 14 });
  // Gold accent line under header (premium)
  const lineY = y0 + 20;
  doc
    .moveTo(MARGIN + 10, lineY)
    .lineTo(MARGIN + 10 + CONTENT_WIDTH - 14, lineY)
    .lineWidth(1)
    .strokeColor(AMBER_500)
    .stroke();
  doc.y = lineY + 10;
  doc.restore();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function compactJoin(lines: string[] | undefined, maxLen: number) {
  const s = (lines ?? []).filter(Boolean).join(" • ").replace(/\s+/g, " ").trim();
  if (!s) return "None";
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
}

function addConfidencePanel(doc: PDFKit.PDFDocument, content: AuditReportContent) {
  const cp = content.confidencePanel;
  if (!cp) return;

  const x = MARGIN;
  const w = CONTENT_WIDTH;
  const pad = 12;
  const labelW = 148;
  const valueW = w - pad * 2 - labelW;

  const photoCount = Number.isFinite(cp.photoCount) ? Math.max(0, Math.round(cp.photoCount)) : 0;

  // If confidence is 0/undefined, derive a defensible minimum confidence (never show 0%).
  const missing = (cp.missingCategories ?? []).filter(Boolean);
  const missingCount = missing.length;
  const deriveConfidence = () => {
    const photoFactor = clamp(photoCount / 6, 0, 1);
    const missingPenalty = clamp(missingCount / 6, 0, 1) * 0.25;
    // view classification success rate isn't always available at render time; assume moderate (0.7)
    const viewFactor = 0.7;
    const derived = 0.45 + 0.35 * photoFactor + 0.25 * viewFactor - missingPenalty;
    return clamp(derived, 0.45, 0.92);
  };

  const confRaw = Number(cp.confidenceScore);
  const conf01 = Number.isFinite(confRaw) && confRaw > 0 ? clamp(confRaw, 0, 1) : deriveConfidence();
  const confidencePct = Math.round(conf01 * 100);
  const confidenceLabel =
    String(cp.confidenceLabel || "").trim() ||
    (conf01 < 0.55 ? "low" : conf01 < 0.8 ? "medium" : "high");

  const missingText = missing.length ? compactJoin(missing, 120) : "None";
  // Keep this compact so the confidence panel can fit on page 1.
  const limitationsText = compactJoin(cp.limitations ?? [], 140);

  const rows: Array<{ k: string; v: string }> = [
    { k: "Photos", v: String(photoCount) },
    { k: "Missing categories", v: missingText },
    { k: "Model confidence", v: `${confidencePct}%` },
    { k: "Confidence label", v: confidenceLabel },
    { k: "Limitations", v: limitationsText },
  ];

  const interpTitle = "Confidence Level Interpretation";
  const interpLines = [
    "Low: limited input data",
    "Medium: moderate evidence coverage",
    "High: strong evidence coverage",
  ];

  // Measure height
  const headerH = 22;
  const rowGap = 6;
  const rowFont = 9;

  let bodyH = 0;
  doc.save();
  doc.fontSize(rowFont).font("Helvetica");
  for (const r of rows) {
    const hV = doc.heightOfString(r.v, { width: valueW });
    bodyH += Math.max(12, hV) + rowGap;
  }
  // interpretation block height
  bodyH += 10; // spacer
  bodyH += Math.max(12, doc.heightOfString(interpTitle, { width: w - pad * 2 }));
  for (const line of interpLines) {
    bodyH += Math.max(11, doc.heightOfString(line, { width: w - pad * 2 })) + 2;
  }
  doc.restore();

  const cardH = pad + headerH + bodyH + pad - rowGap;

  // Never let the panel split across pages (PDFKit will paginate text mid-line).
  const pageH = (doc.page as any).height as number;
  const bottomLimit = pageH - MARGIN - 24;
  if (doc.y + cardH > bottomLimit && doc.y > MARGIN + 20) {
    doc.addPage();
    doc.x = MARGIN;
    doc.y = MARGIN;
  }

  // Draw card background (subtle gradient) + border
  const g = doc.linearGradient(x, doc.y, x, doc.y + cardH);
  g.stop(0, "#f8fafc").stop(1, "#ffffff");
  doc.save();
  doc.roundedRect(x, doc.y, w, cardH, 12).fillColor(g).fill();
  doc.roundedRect(x, doc.y, w, cardH, 12).strokeColor("#e2e8f0").lineWidth(1).stroke();

  // Header with AI icon
  const y0 = doc.y;
  const iconR = 8;
  const iconCx = x + pad + iconR;
  const iconCy = y0 + pad + iconR;
  doc.circle(iconCx, iconCy, iconR).fillColor(AMBER_500).fill();
  doc.fillColor(SLATE_900).font("Helvetica-Bold").fontSize(8);
  doc.text("AI", iconCx - 6, iconCy - 4, { width: 12, align: "center" });

  doc.fillColor(SLATE_900).font("Helvetica-Bold").fontSize(11);
  doc.text("Data Integrity & Confidence", x + pad + iconR * 2 + 8, y0 + pad - 1, {
    width: w - pad * 2 - iconR * 2 - 8,
  });

  // Body rows
  let y = y0 + pad + headerH;
  for (const r of rows) {
    doc.fillColor(SLATE_600).font("Helvetica-Bold").fontSize(rowFont);
    doc.text(r.k, x + pad, y, { width: labelW });
    doc.fillColor(SLATE_900).font("Helvetica").fontSize(rowFont);
    doc.text(r.v, x + pad + labelW, y, { width: valueW });
    const hV = doc.heightOfString(r.v, { width: valueW });
    y += Math.max(12, hV) + rowGap;
  }

  // Interpretation block
  y += 4;
  doc.fillColor(SLATE_600).font("Helvetica-Bold").fontSize(9);
  doc.text(interpTitle, x + pad, y, { width: w - pad * 2 });
  y += 12;
  doc.fillColor(SLATE_600).font("Helvetica").fontSize(9);
  for (const line of interpLines) {
    doc.text(line, x + pad, y, { width: w - pad * 2 });
    y += 12;
  }

  doc.restore();
  doc.y = y0 + cardH + 10;
}

/**
 * Add audit summary section.
 */
function addAuditSummary(
  doc: PDFKit.PDFDocument,
  content: AuditReportContent,
  radarPng?: { buffer: Buffer; width: number; height: number } | null
) {
  addSectionHeading(doc, content.isManual ? "Audit Summary" : "AI Audit Summary");
  doc.fillColor(SLATE_600);
  doc.fontSize(BODY_SIZE).font("Helvetica");

  if (content.score != null) {
    addScoreBadge(doc, content.score);
  }

  if (radarPng?.buffer) {
    const w = CONTENT_WIDTH;
    const h = Math.round(w * (radarPng.height / radarPng.width));
    // Radar chart section header + caption
    doc.fillColor(SLATE_900).font("Helvetica-Bold").fontSize(12);
    doc.text("Audit Performance Signature", MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.25);

    doc.moveDown(0.7);
    const x = MARGIN;
    const y = doc.y;
    try {
      doc.image(radarPng.buffer, x, y, { width: w, height: h });
      doc.y = y + h + 8;

      doc.fillColor(SLATE_600).font("Helvetica").fontSize(META_SIZE);
      doc.text(
        "A balanced radar signature indicates consistent execution across transplant domains. Asymmetry highlights structural variance.",
        MARGIN,
        doc.y,
        { width: CONTENT_WIDTH }
      );
      doc.fontSize(BODY_SIZE).fillColor(SLATE_600);
      doc.y += 14;
    } catch {
      // If image embedding fails for any reason, continue with text-only report.
      doc.moveDown(0.4);
    }
  }

  // Data Integrity & Confidence panel (page 1)
  addConfidencePanel(doc, content);
  doc.moveDown(0.2);

  if (content.donorQuality)
    doc.text(`Donor Quality: ${content.donorQuality}`);
  if (content.graftSurvival)
    doc.text(`Graft Survival Estimate: ${content.graftSurvival}`);
  doc.moveDown(0.8);

  // Keep page 1 clean. Detailed narrative is rendered in later sections/pages.
  const microSummary = String(content.forensic?.summary ?? content.notes ?? "").trim();
  if (microSummary) {
    doc.fillColor(SLATE_600).font("Helvetica").fontSize(11);
    doc.text(microSummary, { width: CONTENT_WIDTH });
    doc.moveDown(0.6);
  }

  // AI signature footer (premium)
  if (content.model || content.uploadCount != null || content.confidencePanel || content.radar) {
    const conf01 =
      typeof content.confidencePanel?.confidenceScore === "number"
        ? content.confidencePanel.confidenceScore
        : typeof content.radar?.confidence === "number"
          ? content.radar.confidence
          : null;
    const confStr =
      conf01 != null && Number.isFinite(conf01)
        ? clamp(conf01, 0, 1).toFixed(2)
        : null;

    doc.moveDown(1.0);
    doc.fontSize(META_SIZE).fillColor(SLATE_400);

    // Use (TM) to avoid font glyph issues in PDFKit built-in fonts.
    doc.font("Helvetica-Bold").fillColor(SLATE_600);
    doc.text("Powered by Follicle Intelligence (TM)");
    doc.font("Helvetica").fillColor(SLATE_400);
    doc.text("Multi-Layer Visual Pattern Recognition Engine");

    const modelName = String(content.model ?? "").trim();
    if (modelName) doc.text(`Model: ${modelName}`);
    if (confStr) doc.text(`Confidence Score: ${confStr}`);

    doc.fontSize(BODY_SIZE).fillColor(SLATE_600);
  }
  doc.moveDown(1.2);
}

function addScoreByArea(doc: PDFKit.PDFDocument, content: AuditReportContent) {
  const v1Domains = content.forensic?.domain_scores_v1?.domains ?? null;
  if (Array.isArray(v1Domains) && v1Domains.length > 0) {
    addSectionHeading(doc, "Score by Domain (v1)");
    doc.fillColor(SLATE_600).fontSize(10).font("Helvetica");
    doc.text("Evidence-weighted domains. Weighted score = raw score × confidence.", { width: CONTENT_WIDTH });
    doc.moveDown(0.6);

    const items = v1Domains.slice(0, 10).map((d) => ({
      id: String(d.domain_id ?? "").trim(),
      title: String(d.title ?? "").trim(),
      raw: clamp(Number(d.raw_score ?? 0), 0, 100),
      conf: clamp(Number(d.confidence ?? 0), 0, 1),
      grade: String(d.evidence_grade ?? "").trim() || "—",
      weighted: clamp(Number(d.weighted_score ?? 0), 0, 100),
    }));

    const x = MARGIN;
    const w = CONTENT_WIDTH;
    const pad = 12;
    const rowH = 46;
    const pageH = (doc.page as any).height as number;
    const bottomLimit = pageH - MARGIN - 40;

    const header = () => {
      doc.fillColor(SLATE_400).font("Helvetica-Bold").fontSize(9);
      doc.text("Domain", x + pad, doc.y, { width: w * 0.52 });
      doc.text("Raw", x + w * 0.55, doc.y, { width: 40, align: "right" });
      doc.text("Conf", x + w * 0.64, doc.y, { width: 48, align: "right" });
      doc.text("Grade", x + w * 0.73, doc.y, { width: 48, align: "right" });
      doc.text("Weighted", x + w * 0.82, doc.y, { width: w * 0.18 - pad, align: "right" });
      doc.moveDown(0.6);
    };

    header();

    for (const it of items) {
      if (doc.y + rowH > bottomLimit && doc.y > MARGIN + 40) {
        doc.addPage();
        doc.x = MARGIN;
        doc.y = MARGIN;
        addSectionHeading(doc, "Score by Domain (continued)");
        doc.fillColor(SLATE_600).fontSize(10).font("Helvetica");
        doc.text("Evidence-weighted domains. Weighted score = raw score × confidence.", { width: CONTENT_WIDTH });
        doc.moveDown(0.6);
        header();
      }

      const y0 = doc.y;
      const cardH = 40;
      const g = doc.linearGradient(x, y0, x, y0 + cardH);
      g.stop(0, "#ffffff").stop(1, "#f8fafc");
      doc.roundedRect(x, y0, w, cardH, 12).fillColor(g).fill();
      doc.roundedRect(x, y0, w, cardH, 12).strokeColor("#e2e8f0").lineWidth(1).stroke();

      doc.fillColor(SLATE_900).font("Helvetica-Bold").fontSize(10);
      doc.text(`${it.id}`, x + pad, y0 + 10, { width: 26 });
      doc.fillColor(SLATE_900).font("Helvetica").fontSize(10);
      doc.text(it.title, x + pad + 30, y0 + 10, { width: w * 0.48 - 30, ellipsis: true });

      const confPct = Math.round(it.conf * 100);

      doc.fillColor(SLATE_600).font("Helvetica-Bold").fontSize(10);
      doc.text(String(Math.round(it.raw)), x + w * 0.55, y0 + 10, { width: 40, align: "right" });
      doc.text(`${confPct}%`, x + w * 0.64, y0 + 10, { width: 48, align: "right" });
      doc.text(it.grade, x + w * 0.73, y0 + 10, { width: 48, align: "right" });

      // Weighted emphasized
      const weightedColor =
        it.weighted >= 85 ? "#059669" : it.weighted >= 70 ? "#16a34a" : it.weighted >= 55 ? AMBER_600 : "#dc2626";
      doc.fillColor(weightedColor).font("Helvetica-Bold").fontSize(11);
      doc.text(String(Math.round(it.weighted)), x + w * 0.82, y0 + 9, { width: w * 0.18 - pad, align: "right" });

      // small subtitle
      doc.fillColor(SLATE_400).font("Helvetica").fontSize(8);
      doc.text("based on submitted documentation", x + pad, y0 + 24, { width: w - pad * 2 });

      doc.y = y0 + cardH + 6;
    }

    // Benchmark badge (if present)
    if (content.forensic?.benchmark) {
      const b = content.forensic.benchmark;
      const eligible = Boolean(b.eligible);
      const tag = eligible ? "Benchmark eligible" : "Not benchmark eligible";
      doc.moveDown(0.2);
      doc.fillColor(eligible ? "#065f46" : SLATE_600).font("Helvetica-Bold").fontSize(9);
      doc.text(tag);
      const reasons = Array.isArray(b.reasons) ? b.reasons.slice(0, 3) : [];
      if (reasons.length) {
        doc.fillColor(SLATE_600).font("Helvetica").fontSize(9);
        for (const r of reasons) doc.text(`• ${String(r).trim()}`, { indent: 12 });
      }
      doc.moveDown(0.8);
    }

    const ci = content.forensic?.completeness_index_v1;
    if (ci && typeof ci === "object") {
      const s = typeof (ci as any).score === "number" ? Math.max(0, Math.min(100, Math.round((ci as any).score))) : null;
      if (s !== null) {
        doc.fillColor(SLATE_600).font("Helvetica-Bold").fontSize(9);
        doc.text(`Completeness Index (v1): ${s}/100`);
        doc.fillColor(SLATE_400).font("Helvetica").fontSize(8);
        doc.text("Based on submitted documentation.", { indent: 12 });
        doc.moveDown(0.6);
      }
    }
    return;
  }

  const domains = content.areaScores?.domains ?? {};
  const sections = content.areaScores?.sections ?? {};
  const hasDomains = Object.keys(domains).length > 0;
  const hasSections = Object.keys(sections).length > 0;
  if (!hasDomains && !hasSections) {
    addSectionHeading(doc, "Score by Area");
    doc.fillColor(SLATE_600).fontSize(10).font("Helvetica");
    doc.text("Area breakdown unavailable for this report version.");
    doc.moveDown(0.8);
    return;
  }

  const domainTitles: Record<string, string> = {
    consultation_indication: "Consultation & Indication",
    donor_management: "Donor Management",
    extraction_quality: "Extraction Quality (Donor Extraction)",
    graft_handling: "Graft Handling & Preservation",
    recipient_implantation: "Recipient Implantation",
    safety_documentation_aftercare: "Safety, Documentation & Aftercare",
  };

  const order = [
    "consultation_indication",
    "donor_management",
    "extraction_quality",
    "graft_handling",
    "recipient_implantation",
    "safety_documentation_aftercare",
  ];

  addSectionHeading(doc, "Score by Area");
  doc.fillColor(SLATE_600).fontSize(10).font("Helvetica");
  doc.text("Area performance (0–100). Higher is better.");
  doc.moveDown(0.6);

  const items = order
    .filter((k) => domains[k] != null)
    .map((k) => ({ key: k, title: domainTitles[k] ?? k.replace(/[._]/g, " "), score: Number(domains[k]) }))
    .filter((x) => Number.isFinite(x.score));

  const pageH = (doc.page as any).height as number;
  const bottomLimit = pageH - MARGIN - 40;

  const renderHeading = (title: string) => {
    addSectionHeading(doc, title);
    doc.fillColor(SLATE_600).fontSize(10).font("Helvetica");
    doc.text("Area performance (0–100). Higher is better.");
    doc.moveDown(0.6);
  };

  const band = (s0: number) => {
    const s = Math.max(0, Math.min(100, s0));
    if (s < 40) {
      return { solid: "#dc2626", gradA: "#7f1d1d", gradB: "#dc2626" }; // red
    }
    if (s < 70) {
      return { solid: AMBER_600, gradA: "#92400e", gradB: "#f59e0b" }; // amber
    }
    if (s < 85) {
      return { solid: "#16a34a", gradA: "#166534", gradB: "#22c55e" }; // green
    }
    return { solid: "#059669", gradA: "#065f46", gradB: "#10b981" }; // emerald
  };

  const track = "#e5e7eb";
  const rowH = 34; // label + bar + spacing
  const barH = 10;
  const barR = 5;
  const x0 = MARGIN;
  const w0 = CONTENT_WIDTH;

  // Premium whitespace: if we're deep on page 1, start on a fresh page.
  if (doc.y > pageH * 0.62) {
    doc.addPage();
    doc.x = MARGIN;
    doc.y = MARGIN;
    renderHeading("Score by Area");
  }

  for (const it of items) {
    const score = Math.max(0, Math.min(100, Number(it.score)));

    // Page break (never mid-row)
    if (doc.y + rowH > bottomLimit && doc.y > MARGIN + 40) {
      doc.addPage();
      doc.x = MARGIN;
      doc.y = MARGIN;
      renderHeading("Score by Area (continued)");
    }

    const yLabel = doc.y;

    // Label (left)
    doc.fillColor(SLATE_900).font("Helvetica-Bold").fontSize(10);
    doc.text(it.title, x0, yLabel, { width: w0 - 52, ellipsis: true });

    // Percentage (right)
    const pct = `${Math.round(score)}%`;
    const c = band(score);
    doc.fillColor(c.solid).font("Helvetica-Bold").fontSize(10);
    doc.text(pct, x0, yLabel, { width: w0, align: "right" });

    // Bar (track + fill)
    const yBar = yLabel + 14;
    doc.roundedRect(x0, yBar, w0, barH, barR).fillColor(track).fill();

    const fillW = (w0 * score) / 100;
    if (fillW > 0.5) {
      const g = doc.linearGradient(x0, yBar, x0 + Math.max(1, fillW), yBar);
      g.stop(0, c.gradA).stop(1, c.gradB);
      doc.roundedRect(x0, yBar, fillW, barH, barR).fillColor(g).fill();
    }

    // Next row
    doc.y = yLabel + rowH;
  }

  if (hasSections) {
    doc.moveDown(0.5);
    doc.fillColor(SLATE_400).fontSize(9).font("Helvetica");
    doc.text("Detailed section scores are available in the web report view.");
  }

  doc.moveDown(0.8);
}

function addGraftIntegrityIndex(doc: PDFKit.PDFDocument, content: AuditReportContent) {
  // Always render a safe section; only include ranges if auditor-approved.
  addSectionHeading(doc, "Graft Integrity Index (TM)");

  const gi = content.graftIntegrity;
  const status = String(gi?.auditor_status ?? "pending");
  const approved = status === "approved";

  const safePendingText = "Graft Integrity analysis pending auditor validation.";

  const pageH = (doc.page as any).height as number;
  const bottomLimit = pageH - MARGIN - 40;
  const ensureSpace = (h: number) => {
    if (doc.y + h > bottomLimit && doc.y > MARGIN + 30) {
      doc.addPage();
      doc.x = MARGIN;
      doc.y = MARGIN;
      addSectionHeading(doc, "Graft Integrity Index (continued)");
    }
  };

  if (!gi || !approved) {
    ensureSpace(72);
    doc.fillColor(SLATE_600).font("Helvetica").fontSize(11);
    doc.text(safePendingText, { width: CONTENT_WIDTH });
    doc.moveDown(0.6);
    doc.fillColor(SLATE_400).font("Helvetica").fontSize(9);
    doc.text("Estimated range is based on available visual evidence; not a definitive graft count.", { width: CONTENT_WIDTH });
    doc.moveDown(0.8);
    return;
  }

  ensureSpace(220);

  const x = MARGIN;
  const w = CONTENT_WIDTH;
  const y0 = doc.y;
  const pad = 14;

  const cardH = 180;
  const g = doc.linearGradient(x, y0, x, y0 + cardH);
  g.stop(0, "#ffffff").stop(1, "#f8fafc");
  doc.roundedRect(x, y0, w, cardH, 14).fillColor(g).fill();
  doc.roundedRect(x, y0, w, cardH, 14).strokeColor("#e2e8f0").lineWidth(1).stroke();

  const fmtInt = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  const fmtRange = (min: number | null, max: number | null) => {
    if (min === null && max === null) return "—";
    if (min !== null && max !== null) return `${fmtInt(min)}–${fmtInt(max)}`;
    if (min !== null) return `≥ ${fmtInt(min)}`;
    return `≤ ${fmtInt(max as number)}`;
  };
  const fmtPct = (min: number | null, max: number | null) => {
    const f = (v: number) => {
      const n = Math.round(v * 10) / 10;
      const sign = n > 0 ? "+" : "";
      return `${sign}${n}%`;
    };
    if (min === null && max === null) return "—";
    if (min !== null && max !== null) return `${f(min)} to ${f(max)}`;
    if (min !== null) return `≥ ${f(min)}`;
    return `≤ ${f(max as number)}`;
  };

  // Header row
  doc.fillColor(SLATE_900).font("Helvetica-Bold").fontSize(12);
  doc.text("Auditor-approved estimate (range)", x + pad, y0 + pad, { width: w - pad * 2 });

  doc.fillColor(SLATE_600).font("Helvetica").fontSize(10);
  doc.text("Estimated range based on available visual evidence; not a definitive graft count.", x + pad, y0 + pad + 18, {
    width: w - pad * 2,
  });

  // Left metrics
  const leftX = x + pad;
  const rightX = x + w / 2 + 6;
  const rowY = y0 + pad + 44;

  const keyStyle = () => doc.fillColor(SLATE_600).font("Helvetica-Bold").fontSize(9);
  const valStyle = () => doc.fillColor(SLATE_900).font("Helvetica-Bold").fontSize(12);

  keyStyle(); doc.text("Claimed grafts", leftX, rowY);
  valStyle(); doc.text(gi.claimed_grafts != null ? fmtInt(gi.claimed_grafts) : "—", leftX, rowY + 12);

  keyStyle(); doc.text("Extracted range", leftX, rowY + 44);
  valStyle(); doc.text(fmtRange(gi.estimated_extracted.min, gi.estimated_extracted.max), leftX, rowY + 56);

  keyStyle(); doc.text("Implanted range", leftX, rowY + 88);
  valStyle(); doc.text(fmtRange(gi.estimated_implanted.min, gi.estimated_implanted.max), leftX, rowY + 100);

  // Right metrics: variance + confidence
  keyStyle(); doc.text("Variance vs claimed (implanted)", rightX, rowY);
  valStyle(); doc.text(fmtPct(gi.variance_claimed_vs_implanted_pct.min, gi.variance_claimed_vs_implanted_pct.max), rightX, rowY + 12);

  keyStyle(); doc.text("Confidence", rightX, rowY + 44);
  valStyle();
  const confPct = Math.round(clamp(gi.confidence, 0, 1) * 100);
  doc.text(`${String(gi.confidence_label).toUpperCase()} (${confPct}%)`, rightX, rowY + 56);

  // Neutral variance bar (right column, under variance)
  const barX = rightX;
  const barY = rowY + 30;
  const barW = w / 2 - pad - 10;
  const barH = 10;
  doc.roundedRect(barX, barY, barW, barH, 5).fillColor("#e5e7eb").fill();

  const vMin = gi.variance_claimed_vs_implanted_pct.min;
  const vMax = gi.variance_claimed_vs_implanted_pct.max;
  if (typeof vMin === "number" && typeof vMax === "number" && Number.isFinite(vMin) && Number.isFinite(vMax)) {
    // Map -50..+50 to bar width; clamp range inside.
    const clampPct = (v: number) => Math.max(-50, Math.min(50, v));
    const a = clampPct(Math.min(vMin, vMax));
    const b = clampPct(Math.max(vMin, vMax));
    const toX = (v: number) => barX + ((v + 50) / 100) * barW;
    const segX = toX(a);
    const segW = Math.max(2, toX(b) - segX);
    const segGrad = doc.linearGradient(segX, barY, segX + segW, barY);
    segGrad.stop(0, "#94a3b8").stop(1, "#64748b"); // neutral slate gradient
    doc.roundedRect(segX, barY, segW, barH, 5).fillColor(segGrad).fill();
    // center marker (0%)
    const midX = toX(0);
    doc.moveTo(midX, barY - 2).lineTo(midX, barY + barH + 2).strokeColor("#94a3b8").lineWidth(1).stroke();
  }

  // Limitations (2–3 bullets)
  const lim = (gi.limitations ?? []).filter(Boolean).slice(0, 3);
  const limY = y0 + cardH - 52;
  doc.fillColor(SLATE_600).font("Helvetica-Bold").fontSize(9);
  doc.text("Limitations", x + pad, limY);
  doc.fillColor(SLATE_600).font("Helvetica").fontSize(9);
  if (lim.length === 0) {
    doc.text("—", x + pad, limY + 12);
  } else {
    let yy = limY + 12;
    for (const line of lim) {
      doc.text(`• ${String(line).trim()}`, x + pad, yy, { width: w - pad * 2 });
      yy += 12;
    }
  }

  doc.y = y0 + cardH + 10;
}

/**
 * Build PDF buffer from content. For images, pass pre-fetched buffers in content.images.
 * (The previous addImageGallery expected supabase - we'll simplify to just use buffers.)
 */
export async function buildAuditReportPdf(
  content: AuditReportContent,
  opts?: { logoPath?: string }
): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ size: "A4", margin: MARGIN });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Background watermark pattern on every page (behind content)
  const drawBg = () => {
    const x = doc.x;
    const y = doc.y;
    drawNeuralWatermark(doc);
    doc.x = x;
    doc.y = y;
  };
  drawBg();
  doc.on("pageAdded", drawBg);

  let logoBuffer: Buffer | undefined;
  if (opts?.logoPath) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const full = path.join(process.cwd(), opts.logoPath);
      if (fs.existsSync(full)) logoBuffer = fs.readFileSync(full);
    } catch {
      /* ignore */
    }
  }

  doc.x = MARGIN;
  doc.y = 0;
  addHeader(doc, logoBuffer);
  doc.y = PAGE_TOP_CONTENT_Y;
  addMeta(doc, content);
  let radarImg: { buffer: Buffer; width: number; height: number } | null = null;
  if (content.radar?.section_scores && typeof content.radar.overall_score === "number") {
    try {
      const { renderRadarChartPng } = await import("./renderRadarChart");
      radarImg = await renderRadarChartPng({
        section_scores: content.radar.section_scores,
        overall_score: content.radar.overall_score,
        confidence: content.radar.confidence,
      });
    } catch {
      radarImg = null;
    }
  }

  addAuditSummary(doc, content, radarImg);
  addClinicalNarrative(doc, content);
  addScoreByArea(doc, content);
  addGraftIntegrityIndex(doc, content);

  // Add images if provided (with buffers already fetched)
  if (content.images?.length) {
    // Always start photos on a clean page so the grid isn't squeezed into whatever space remains.
    doc.addPage();
    doc.x = MARGIN;
    doc.y = MARGIN;

    addSectionHeading(doc, "Case Photos");

    const COLS = 3;
    const IMG_SIZE = 120;
    const GAP_X = 12;
    const GAP_Y = 14;
    const LABEL_H = 18;
    const cellW = IMG_SIZE;
    const rowH = IMG_SIZE + LABEL_H + GAP_Y;
    const usableW = CONTENT_WIDTH;
    const totalGridW = COLS * cellW + (COLS - 1) * GAP_X;
    const left = MARGIN + Math.max(0, (usableW - totalGridW) / 2);
    const bottomLimit = (doc.page as any).height - MARGIN - 24;

    let col = 0;
    let y = doc.y;

    for (let idx = 0; idx < content.images.length; idx++) {
      const img = content.images[idx]!;

      // Page break before starting a new row if it won't fit.
      if (col === 0 && y + IMG_SIZE + LABEL_H > bottomLimit) {
        doc.addPage();
        doc.x = MARGIN;
        doc.y = MARGIN;
        addSectionHeading(doc, "Case Photos (continued)");
        y = doc.y;
      }

      const x = left + col * (cellW + GAP_X);
      const drawY = y;

      try {
        const buf = Buffer.isBuffer(img.buffer) ? img.buffer : Buffer.from(img.buffer as ArrayBuffer);
        doc.image(buf, x, drawY, { width: IMG_SIZE, height: IMG_SIZE });
      } catch {
        doc.save();
        doc.roundedRect(x, drawY, IMG_SIZE, IMG_SIZE, 8).strokeColor("#e5e7eb").lineWidth(1).stroke();
        doc.fillColor(SLATE_400).fontSize(9);
        doc.text("Image unavailable", x + 10, drawY + IMG_SIZE / 2 - 6, { width: IMG_SIZE - 20, align: "center" });
        doc.restore();
      }

      doc.fillColor(SLATE_600).fontSize(8).font("Helvetica");
      const label = (img.label || img.type || `Photo ${idx + 1}`)
        .replace(/^patient_photo:|doctor_photo:/, "")
        .replace(/_/g, " ");
      doc.text(label, x, drawY + IMG_SIZE + 4, { width: IMG_SIZE, height: LABEL_H, ellipsis: true });

      col += 1;
      if (col >= COLS) {
        col = 0;
        y += rowH;
      }
    }

    doc.y = y + (col === 0 ? 0 : rowH);
    doc.moveDown(0.5);
  }

  // Footer
  doc.moveDown(2);
  doc.fillColor(SLATE_400).fontSize(9);
  doc.text("— HairAudit. Professional hair transplant audit and feedback.", MARGIN, doc.y);
  doc.text("https://hairaudit.com", MARGIN, doc.y + 14);
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ? String(process.env.VERCEL_GIT_COMMIT_SHA).slice(0, 7) : "";
  if (sha) {
    doc.text(`Build: ${sha}`, MARGIN, doc.y + 28);
  }

  doc.end();
  return done;
}

/**
 * Fetch image buffers from Supabase storage for given uploads.
 * Returns ReportImage[] for embedding in the PDF.
 */
export async function fetchReportImages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bucket: string,
  uploads: Array<{ type?: string; storage_path?: string }>
): Promise<ReportImage[]> {
  const results: ReportImage[] = [];
  for (const u of uploads) {
    const path = u.storage_path;
    if (!path || typeof path !== "string") continue;
    const type = String(u.type ?? "");
    try {
      const { data } = await supabase.storage.from(bucket).download(path);
      if (!data) continue;
      const buffer = Buffer.from(await data.arrayBuffer());
      const label = type.replace(/^patient_photo:|doctor_photo:/, "").replace(/_/g, " ");
      results.push({ buffer, label, type });
    } catch {
      // Skip failed downloads (wrong format or missing)
    }
  }
  return results;
}
