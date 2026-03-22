import { pdfEnvConfig } from "@/lib/pdf/pdfEnvConfig";
import type { QpdfReadiness } from "@/lib/pdf/qpdfReadiness";

export type PdfGenerationBenchmarkPayload = {
  event: "pdf_generation_complete";
  template: "elite" | "demo";
  caseId: string | null;
  reportId: string | null;
  imageCount: number;
  sourceBytes: number;
  optimizedBytes: number;
  skippedReencode: number;
  processedFull: number;
  truncated: number;
  fallbackCount: number;
  preflightHtmlBytes: number | null;
  rawPdfBytes: number;
  finalPdfBytes: number;
  durationMs: number;
  linearized: boolean;
  linearizationRequested: boolean;
  qpdfAvailable: boolean;
  qpdfVersion: string | null;
  scale: number;
  ts: string;
};

export type PdfGenerationBenchmarkInput = Omit<PdfGenerationBenchmarkPayload, "ts" | "qpdfAvailable" | "qpdfVersion">;

function parseHeaderInt(h: Headers, name: string): number {
  const v = h.get(name);
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parsePrintStatsFromPreflightHeaders(headers: Headers): {
  imageCount: number;
  sourceBytes: number;
  optimizedBytes: number;
  fallbackCount: number;
  skippedReencode: number;
  processedFull: number;
  truncated: number;
  preflightHtmlBytes: number | null;
} {
  const htmlRaw = headers.get("x-pdf-print-html-bytes");
  const preflightHtmlBytes =
    htmlRaw != null && htmlRaw !== "" ? (Number.isFinite(Number(htmlRaw)) ? Number(htmlRaw) : null) : null;

  return {
    imageCount: parseHeaderInt(headers, "x-pdf-print-image-count"),
    sourceBytes: parseHeaderInt(headers, "x-pdf-print-source-bytes"),
    optimizedBytes: parseHeaderInt(headers, "x-pdf-print-optimized-bytes"),
    fallbackCount: parseHeaderInt(headers, "x-pdf-print-fallback-count"),
    skippedReencode: parseHeaderInt(headers, "x-pdf-print-skipped-reencode"),
    processedFull: parseHeaderInt(headers, "x-pdf-print-processed-full"),
    truncated: parseHeaderInt(headers, "x-pdf-print-truncated"),
    preflightHtmlBytes,
  };
}

/**
 * Single-line JSON log, grep: `[pdf-benchmark]`
 */
export function logPdfGenerationBenchmark(
  base: PdfGenerationBenchmarkInput,
  readiness: QpdfReadiness,
  benchmarkMode: boolean
): void {
  const payload: PdfGenerationBenchmarkPayload = {
    ...base,
    qpdfAvailable: readiness.available,
    qpdfVersion: readiness.version,
    ts: new Date().toISOString(),
  };

  console.info("[pdf-benchmark]", JSON.stringify(payload));

  if (benchmarkMode) {
    const src = Math.max(0, payload.sourceBytes);
    const opt = Math.max(0, payload.optimizedBytes);
    const embedDelta = src > 0 ? Math.round((1 - opt / src) * 10000) / 100 : null;
    const linearizeDelta =
      payload.rawPdfBytes > 0
        ? Math.round((1 - payload.finalPdfBytes / payload.rawPdfBytes) * 10000) / 100
        : null;

    console.info(
      "[pdf-benchmark-detail]",
      JSON.stringify({
        ...payload,
        embedBytesSavedVsSource: src > 0 ? Math.max(0, src - opt) : null,
        embedReductionPctVsSource: embedDelta,
        bytesAfterPlaywright: payload.rawPdfBytes,
        bytesAfterPostProcess: payload.finalPdfBytes,
        linearizeSizeDeltaPct: linearizeDelta,
      })
    );
  }
}

export function shouldLogPdfBenchmark(): boolean {
  return pdfEnvConfig.shouldEmitPdfDiagnostics();
}
