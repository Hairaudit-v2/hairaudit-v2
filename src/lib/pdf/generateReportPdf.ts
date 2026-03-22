import { maybePostProcessAuditPdf } from "@/lib/pdf/maybePostProcessAuditPdf";
import { pdfEnvConfig } from "@/lib/pdf/pdfEnvConfig";
import { getQpdfReadiness } from "@/lib/pdf/qpdfReadiness";
import {
  logPdfGenerationBenchmark,
  parsePrintStatsFromPreflightHeaders,
  shouldLogPdfBenchmark,
} from "@/lib/pdf/pdfGenerationMetrics";

export async function generateReportPdfFromUrl(url: string): Promise<Buffer> {
  const startedAt = Date.now();

  // Hard guardrail: our PDF rendering MUST only ever print the dedicated print route.
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    // best-effort: allow relative URLs in dev, but still enforce route shape below
  }
  const path = parsed ? parsed.pathname : url;
  const isDemoReport = String(path).includes("/api/print/demo-report");
  const isEliteReport = String(path).includes("/api/print/report");

  let caseId: string | null = null;
  let reportId: string | null = null;
  let template: "elite" | "demo" = "demo";

  if (!isDemoReport && !isEliteReport) {
    throw new Error(
      `PDF render refused: non-print URL. Expected '/api/print/report' or '/api/print/demo-report', got '${String(path)}'`
    );
  }
  if (parsed && isEliteReport) {
    caseId = parsed.searchParams.get("caseId");
    reportId = parsed.searchParams.get("reportId");
    const auditMode = parsed.searchParams.get("auditMode");
    const token = parsed.searchParams.get("token");
    if (!caseId || !auditMode || !token) {
      throw new Error(
        `PDF render refused: missing required params (caseId/auditMode/token) in '${parsed.pathname}'`
      );
    }
    template = "elite";
  } else if (isDemoReport) {
    template = "demo";
  }

  console.log("[PDF] print url:", url);

  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.LAMBDA_TASK_ROOT
  );
  const vercelBypass = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim();
  const extraHTTPHeaders = vercelBypass
    ? {
        "x-vercel-protection-bypass": vercelBypass,
        "x-vercel-set-bypass-cookie": "true",
      }
    : undefined;

  const preflight = await fetch(url, {
    headers: extraHTTPHeaders as HeadersInit | undefined,
  }).catch((err: unknown) => {
    const msg = (err as Error)?.message ?? "Unknown error";
    throw new Error(`PDF preflight failed: ${msg}`);
  });

  if (!preflight.ok) {
    let bodyText = "";
    try {
      bodyText = await preflight.text();
    } catch {
      bodyText = "";
    }
    if (preflight.status === 409 || /AUDIT_NOT_READY/i.test(bodyText)) {
      throw Object.assign(new Error(bodyText || "AUDIT_NOT_READY"), { code: "AUDIT_NOT_READY" as const });
    }
    throw new Error(
      `PDF preflight failed: HTTP ${preflight.status} ${preflight.statusText || ""}`.trim()
    );
  }

  console.log("[PDF] preflight:", {
    status: preflight.status,
    xReportTemplate: preflight.headers.get("x-report-template"),
    xAuditMode: preflight.headers.get("x-audit-mode"),
    contentType: preflight.headers.get("content-type"),
  });

  const templateHeader = preflight.headers.get("x-report-template");
  if (templateHeader !== "elite" && templateHeader !== "demo") {
    throw new Error(
      `PDF preflight refused: expected X-Report-Template=elite or demo but got '${templateHeader ?? "null"}'.`
    );
  }

  const printStats = parsePrintStatsFromPreflightHeaders(preflight.headers);

  if (pdfEnvConfig.isInstrumentationEnabled()) {
    console.info("[pdf-gen] preflight print stats", {
      imageCount: printStats.imageCount,
      sourceBytes: printStats.sourceBytes,
      optimizedBytes: printStats.optimizedBytes,
      fallbackCount: printStats.fallbackCount,
      skippedReencode: printStats.skippedReencode,
      processedFull: printStats.processedFull,
      truncated: printStats.truncated,
      preflightHtmlBytes: printStats.preflightHtmlBytes,
    });
  }

  const browser = isServerless
    ? await (async () => {
        const [{ chromium }, chromiumPack] = await Promise.all([
          import("playwright-core"),
          import("@sparticuz/chromium"),
        ]);
        const executablePath = await chromiumPack.default.executablePath();
        return chromium.launch({
          args: chromiumPack.default.args,
          executablePath,
          headless: true,
        });
      })()
    : await (async () => {
        const { chromium } = await import("playwright");
        return chromium.launch({ headless: true });
      })();

  try {
    const context = await browser.newContext({ extraHTTPHeaders });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });

    const gateText = (await page.locator("body").innerText().catch(() => "")).slice(0, 4000);
    const looksLikeGate =
      /vercel|authentication required|password protected|login|sign in/i.test(gateText) &&
      !/hairaudit report|professional hair transplant audit report/i.test(gateText);
    if (looksLikeGate) {
      throw new Error("PDF render blocked by authentication gate (likely Vercel protection).");
    }

    await page.emulateMedia({ media: "print" });

    const scale = pdfEnvConfig.getPlaywrightScale();
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", right: "14mm", bottom: "16mm", left: "14mm" },
      scale,
    });

    const rawPdf = Buffer.from(pdf);
    const post = await maybePostProcessAuditPdf(rawPdf);

    if (pdfEnvConfig.isInstrumentationEnabled()) {
      console.info("[pdf-gen] output", {
        pdfBytes: post.buffer.length,
        scale,
        linearized: post.linearized,
      });
    }

    if (shouldLogPdfBenchmark()) {
      const readiness = await getQpdfReadiness();
      logPdfGenerationBenchmark(
        {
          event: "pdf_generation_complete",
          template,
          caseId,
          reportId,
          imageCount: printStats.imageCount,
          sourceBytes: printStats.sourceBytes,
          optimizedBytes: printStats.optimizedBytes,
          skippedReencode: printStats.skippedReencode,
          processedFull: printStats.processedFull,
          truncated: printStats.truncated,
          fallbackCount: printStats.fallbackCount,
          preflightHtmlBytes: printStats.preflightHtmlBytes,
          rawPdfBytes: rawPdf.length,
          finalPdfBytes: post.buffer.length,
          durationMs: Date.now() - startedAt,
          linearized: post.linearized,
          linearizationRequested: pdfEnvConfig.isLinearizationEnabled(),
          scale,
        },
        readiness,
        pdfEnvConfig.isBenchmarkMode()
      );
    }

    return Buffer.from(post.buffer);
  } finally {
    await browser.close();
  }
}
