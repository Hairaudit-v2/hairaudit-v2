/**
 * Minimal PDF buffer for demo QA seed cases (pdf_path / download smoke tests).
 */

import PDFDocument from "pdfkit";

export function createDemoQaPdfBuffer(title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(16).text("HairAudit Demo QA Report", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(title);
    doc.moveDown();
    doc.fontSize(10).text("Synthetic demo case — not real patient data.");
    doc.text(`Generated: ${new Date().toISOString()}`);
    doc.end();
  });
}
