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
  doc.fontSize(28).font("Helvetica-Bold");
  doc.text("HairAudit", x, 28, { width: 300 });
  doc.fontSize(11).font("Helvetica");
  doc.fillColor(SLATE_400);
  doc.text("Professional Hair Transplant Audit Report", x, 55);
  doc.restore();
  doc.moveDown(3);
}

/**
 * Add metadata block.
 */
function addMeta(doc: PDFKit.PDFDocument, content: AuditReportContent) {
  doc.fillColor(SLATE_600);
  doc.fontSize(10);
  doc.text(`Case ID: ${content.caseId}`, { continued: false });
  doc.text(`Version: v${content.version}`);
  doc.text(`Generated: ${content.generatedAt}${content.isManual ? " (manual audit)" : ""}`);
  doc.moveDown(1.5);
}

/**
 * Add section heading with amber accent.
 */
function addSectionHeading(doc: PDFKit.PDFDocument, title: string) {
  doc.save();
  doc.moveDown(0.5);
  doc.fillColor(AMBER_600);
  doc.rect(MARGIN, doc.y, 4, 16).fill();
  doc.fillColor(SLATE_900);
  doc.fontSize(14).font("Helvetica-Bold");
  doc.text(title, MARGIN + 10, doc.y + 2, { width: CONTENT_WIDTH - 14 });
  doc.y += 22;
  doc.restore();
}

/**
 * Add audit summary section.
 */
function addAuditSummary(doc: PDFKit.PDFDocument, content: AuditReportContent) {
  addSectionHeading(doc, content.isManual ? "Audit Summary" : "AI Audit Summary");
  doc.fillColor(SLATE_600);
  doc.fontSize(11).font("Helvetica");

  if (content.score != null) {
    doc.font("Helvetica-Bold").fillColor(SLATE_900);
    doc.text(`Overall Score: ${content.score}/100`, { continued: false });
    doc.font("Helvetica").fillColor(SLATE_600);
  }
  if (content.donorQuality)
    doc.text(`Donor Quality: ${content.donorQuality}`);
  if (content.graftSurvival)
    doc.text(`Graft Survival Estimate: ${content.graftSurvival}`);
  doc.moveDown(0.5);

  doc.text("Notes:", { continued: false });
  doc.text(content.notes || "—", { indent: 10, align: "left" });

  if (content.findings?.length) {
    doc.moveDown(0.5);
    doc.text("Key Findings:", { continued: false });
    content.findings.forEach((f) => doc.text(`• ${f}`, { indent: 10, align: "left" }));
  }

  if (content.model || content.uploadCount != null) {
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor(SLATE_400);
    const parts: string[] = [];
    if (content.uploadCount != null) parts.push(`${content.uploadCount} uploads`);
    if (content.model) parts.push(`Model: ${content.model}`);
    doc.text(parts.join(" | ") || "");
    doc.fontSize(11).fillColor(SLATE_600);
  }
  doc.moveDown(1);
}

function scoreLevel(s: number): { outOf5: number; level: "High" | "Medium" | "Low"; color: string } {
  const outOf5 = Math.max(0, Math.min(5, Math.round((s / 100) * 5)));
  const level: "High" | "Medium" | "Low" = s >= 80 ? "High" : s >= 50 ? "Medium" : "Low";
  const color = level === "High" ? "#059669" : level === "Medium" ? AMBER_600 : "#dc2626";
  return { outOf5, level, color };
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
  doc.text("Where your score sits for each capture point (out of 5).");
  doc.moveDown(0.8);

  const gap = 14;
  const cardW = (CONTENT_WIDTH - gap) / 2;
  const cardH = 64;
  const barH = 8;
  const pad = 10;

  const items = order
    .filter((k) => domains[k] != null)
    .map((k) => ({ key: k, title: domainTitles[k] ?? k.replace(/[._]/g, " "), score: Number(domains[k]) }))
    .filter((x) => Number.isFinite(x.score));

  const bottomLimit = (doc.page as any).height - MARGIN - 40;
  const startY = doc.y;
  let i = 0;
  for (const it of items) {
    // If we're about to start a new row and it won't fit, break page and restart grid on new page.
    const isRowStart = i % 2 === 0;
    const rowIndex = Math.floor(i / 2);
    const y = startY + rowIndex * (cardH + gap);
    if (isRowStart && y + cardH > bottomLimit) {
      doc.addPage();
      doc.x = MARGIN;
      doc.y = MARGIN;
      // restart layout on the new page
      i = 0;
    }

    const col = i % 2;
    const x = MARGIN + col * (cardW + gap);
    const y2 = doc.y + Math.floor(i / 2) * (cardH + gap);

    doc.save();
    doc.roundedRect(x, y2, cardW, cardH, 10).strokeColor("#e5e7eb").lineWidth(1).stroke();

    // Title
    doc.fillColor(SLATE_900).font("Helvetica-Bold").fontSize(10);
    doc.text(it.title, x + pad, y2 + pad, { width: cardW - pad * 2 });

    // Bar
    const barY = y2 + pad + 20;
    doc.roundedRect(x + pad, barY, cardW - pad * 2, barH, 4).fillColor("#e5e7eb").fill();
    const { outOf5, level, color } = scoreLevel(it.score);
    doc.roundedRect(
      x + pad,
      barY,
      ((cardW - pad * 2) * Math.max(0, Math.min(100, it.score))) / 100,
      barH,
      4
    )
      .fillColor(color)
      .fill();

    // Meta row
    doc.fillColor(SLATE_600).font("Helvetica").fontSize(9);
    doc.text(`${outOf5}/5`, x + pad, barY + 14);
    doc.fillColor(color).font("Helvetica-Bold").text(`${level} level`, x + pad + 40, barY + 14);

    doc.restore();
    i += 1;
  }

  // Move cursor below the grid on the current page
  const rowsOnPage = Math.ceil((i || items.length) / 2);
  doc.y = doc.y + rowsOnPage * (cardH + gap);

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
  doc.y = 95;
  addMeta(doc, content);
  addAuditSummary(doc, content);
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
