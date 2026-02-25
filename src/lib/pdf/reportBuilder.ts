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

  // Add images if provided (with buffers already fetched)
  if (content.images?.length) {
    addSectionHeading(doc, "Case Photos");
    const IMG_SIZE = 140;
    const GAP = 16;
    const COLS = 2;
    let col = 0;
    let rowStartY = doc.y;

    for (let i = 0; i < content.images.length; i++) {
      const img = content.images[i]!;
      const x = MARGIN + col * (IMG_SIZE + GAP);
      doc.y = rowStartY + Math.floor(i / COLS) * (IMG_SIZE + GAP + 28);

      try {
        const buf = Buffer.isBuffer(img.buffer) ? img.buffer : Buffer.from(img.buffer as ArrayBuffer);
        doc.image(buf, x, doc.y, { width: IMG_SIZE, height: IMG_SIZE });
        doc.fillColor(SLATE_600).fontSize(8);
        const label = (img.label || img.type || `Photo ${i + 1}`).replace(/^patient_photo:|doctor_photo:/, "");
        doc.text(label, x, doc.y + IMG_SIZE + 4, { width: IMG_SIZE });
      } catch {
        doc.fillColor(SLATE_400).fontSize(9);
        doc.text(`[${img.label || "Image"}]`, x, doc.y);
      }

      col++;
      if (col >= COLS) col = 0;
    }
    doc.y = rowStartY + Math.ceil(content.images.length / COLS) * (IMG_SIZE + GAP + 28);
    doc.moveDown(1);
  }

  // Footer
  doc.moveDown(2);
  doc.fillColor(SLATE_400).fontSize(9);
  doc.text("— HairAudit. Professional hair transplant audit and feedback.", MARGIN, doc.y);
  doc.text("https://hairaudit.com", MARGIN, doc.y + 14);

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
