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
  images?: ReportImage[];
};

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
  const labelW = 130;
  const valueW = w - pad * 2 - labelW;

  const photoCount = Number.isFinite(cp.photoCount) ? Math.max(0, Math.round(cp.photoCount)) : 0;
  const confidencePct = Math.round(clamp(Number(cp.confidenceScore) || 0, 0, 1) * 100);
  const confidenceLabel = String(cp.confidenceLabel || "").trim() || "—";

  const missing = (cp.missingCategories ?? []).filter(Boolean);
  const missingText = missing.length ? compactJoin(missing, 120) : "None";
  const limitationsText = compactJoin(cp.limitations ?? [], 200);

  const rows: Array<{ k: string; v: string }> = [
    { k: "Photos", v: String(photoCount) },
    { k: "Missing categories", v: missingText },
    { k: "Model confidence", v: `${confidencePct}%` },
    { k: "Confidence label", v: confidenceLabel },
    { k: "Limitations", v: limitationsText },
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
  doc.restore();

  const cardH = pad + headerH + bodyH + pad - rowGap;

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
    doc.font("Helvetica-Bold").fillColor(SLATE_900);
    doc.text(`Overall Score: ${content.score}/100`, { continued: false });
    doc.font("Helvetica").fillColor(SLATE_600);
  }

  if (radarPng?.buffer) {
    const w = CONTENT_WIDTH;
    const h = Math.round(w * (radarPng.height / radarPng.width));
    doc.moveDown(0.9);
    const x = MARGIN;
    const y = doc.y;
    try {
      doc.image(radarPng.buffer, x, y, { width: w, height: h });
      doc.y = y + h + 14;
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

  doc.text("Notes:", { continued: false });
  doc.text(content.notes || "—", { indent: 10, align: "left" });

  if (content.findings?.length) {
    doc.moveDown(0.8);
    doc.text("Key Findings:", { continued: false });
    content.findings.forEach((f) => doc.text(`• ${f}`, { indent: 10, align: "left" }));
  }

  if (content.model || content.uploadCount != null) {
    doc.moveDown(0.8);
    doc.fontSize(META_SIZE).fillColor(SLATE_400);
    const parts: string[] = [];
    if (content.uploadCount != null) parts.push(`${content.uploadCount} uploads`);
    if (content.model) parts.push(`Model: ${content.model}`);
    doc.text(parts.join(" | ") || "");
    doc.fontSize(BODY_SIZE).fillColor(SLATE_600);
  }
  doc.moveDown(1.2);
}

function addScoreByArea(doc: PDFKit.PDFDocument, content: AuditReportContent) {
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
      radarImg = renderRadarChartPng({
        section_scores: content.radar.section_scores,
        overall_score: content.radar.overall_score,
        confidence: content.radar.confidence,
      });
    } catch {
      radarImg = null;
    }
  }

  addAuditSummary(doc, content, radarImg);
  addScoreByArea(doc, content);

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
