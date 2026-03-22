/**
 * Single source of truth for PDF pipeline environment flags and numeric tuning.
 * All values are sanitized/clamped here; callers should not read process.env.PDF_* directly.
 */

function readBool(name: string, defaultValue = false): boolean {
  const v = String(process.env[name] ?? "").trim().toLowerCase();
  if (!v) return defaultValue;
  return v === "true" || v === "1" || v === "yes";
}

function readTrimmed(name: string, fallback: string): string {
  const p = String(process.env[name] ?? "").trim();
  return p || fallback;
}

export const pdfEnvConfig = {
  /** Verbose step logs + response diagnostics headers (elite print route). */
  isInstrumentationEnabled(): boolean {
    return readBool("PDF_INSTRUMENTATION", false);
  },

  /** Extra benchmark ratios and raw pre-linearization size in logs. */
  isBenchmarkMode(): boolean {
    return readBool("PDF_BENCHMARK_MODE", false);
  },

  shouldEmitPdfDiagnostics(): boolean {
    return pdfEnvConfig.isInstrumentationEnabled() || pdfEnvConfig.isBenchmarkMode();
  },

  isLinearizationEnabled(): boolean {
    return readBool("PDF_ENABLE_LINEARIZATION", false);
  },

  getQpdfPath(): string {
    const p = readTrimmed("PDF_QPDF_PATH", "qpdf");
    return p || "qpdf";
  },

  /** Max long edge (px) before downscale; clamped 320–2400. */
  getPrintImageMaxEdge(): number {
    const n = Number(process.env.PDF_PRINT_IMAGE_MAX_EDGE ?? "960");
    if (!Number.isFinite(n)) return 960;
    return Math.min(2400, Math.max(320, Math.round(n)));
  },

  /** Returns null to use adaptive JPEG quality in optimizeRaster. */
  getPrintJpegQualityOverride(): number | null {
    const raw = process.env.PDF_PRINT_JPEG_QUALITY;
    if (raw === undefined || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.min(95, Math.max(60, Math.round(n)));
  },

  /** Max images per category key; null = unlimited. */
  getMaxImagesPerSection(): number | null {
    const raw = process.env.PDF_MAX_IMAGES_PER_SECTION;
    if (raw === undefined || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return null;
    return Math.floor(n);
  },

  /** Playwright page.pdf scale; clamped [0.82, 1]. */
  getPlaywrightScale(): number {
    const n = Number(process.env.PDF_PLAYWRIGHT_SCALE ?? "0.94");
    if (!Number.isFinite(n)) return 0.94;
    return Math.min(1, Math.max(0.82, n));
  },

  isPrintImageOptimizeEnabled(): boolean {
    const v = String(process.env.PDF_PRINT_IMAGE_OPTIMIZE ?? "true").trim().toLowerCase();
    return v !== "false" && v !== "0";
  },

  isPdfDebugEnabled(): boolean {
    return readBool("PDF_DEBUG", false);
  },

  getPdfRenderer(): "playwright" | "pdfkit" {
    return process.env.PDF_RENDERER === "pdfkit" ? "pdfkit" : "playwright";
  },
};
