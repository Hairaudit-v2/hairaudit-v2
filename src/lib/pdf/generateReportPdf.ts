export async function generateReportPdfFromUrl(url: string): Promise<Buffer> {
  // Hard guardrail: our PDF rendering MUST only ever print the dedicated print route.
  // This prevents regressions where we accidentally print legacy HTML pages.
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    // best-effort: allow relative URLs in dev, but still enforce route shape below
  }
  const path = parsed ? parsed.pathname : url;
  if (!String(path).includes("/api/print/report")) {
    throw new Error(
      `PDF render refused: non-print URL. Expected '/api/print/report', got '${String(path)}'`
    );
  }
  if (parsed) {
    const caseId = parsed.searchParams.get("caseId");
    const auditMode = parsed.searchParams.get("auditMode");
    const token = parsed.searchParams.get("token");
    if (!caseId || !auditMode || !token) {
      throw new Error(
        `PDF render refused: missing required params (caseId/auditMode/token) in '${parsed.pathname}'`
      );
    }
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

  // Preflight check: ensure we are hitting the elite print renderer
  const preflight = await fetch(url, {
    headers: extraHTTPHeaders as HeadersInit | undefined,
  }).catch((err: unknown) => {
    const msg = (err as Error)?.message ?? "Unknown error";
    throw new Error(`PDF preflight failed: ${msg}`);
  });

  if (!preflight.ok) {
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
  if (templateHeader !== "elite") {
    throw new Error(
      `PDF preflight refused: expected X-Report-Template=elite but got '${templateHeader ?? "null"}'.`
    );
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

    // Guardrail: never upload a PDF of Vercel auth/login gates.
    const gateText = (await page.locator("body").innerText().catch(() => "")).slice(0, 4000);
    const looksLikeGate =
      /vercel|authentication required|password protected|login|sign in/i.test(gateText) &&
      !/hairaudit report|professional hair transplant audit report/i.test(gateText);
    if (looksLikeGate) {
      throw new Error("PDF render blocked by authentication gate (likely Vercel protection).");
    }

    await page.emulateMedia({ media: "print" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", right: "14mm", bottom: "16mm", left: "14mm" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
