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
  if (templateHeader !== "elite") {
    throw new Error(
      `PDF preflight refused: expected X-Report-Template=elite but got '${templateHeader ?? "null"}'.`
    );
  }

  const runPdf = async (): Promise<Buffer> => {
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

    let context: Awaited<ReturnType<Awaited<typeof browser>["newContext"]>> | null = null;
    try {
      context = await browser.newContext({
        extraHTTPHeaders,
        defaultNavigationTimeout: 25000,
      });
      const page = await context.newPage();

      // Use "load" instead of "networkidle" to avoid long waits that can cause
      // serverless timeouts and "Target closed" when page.pdf() runs.
      await page.goto(url, { waitUntil: "load", timeout: 25000 });

      // Short wait for main content so PDF isn't blank (fonts/layout)
      await page.locator("body .wrap").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});

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
        timeout: 30000,
      });

      return Buffer.from(pdf);
    } finally {
      if (context) {
        try {
          await context.close();
        } catch {
          // ignore if already closed
        }
      }
      try {
        await browser.close();
      } catch {
        // ignore if already closed (e.g. process killed)
      }
    }
  };

  try {
    return await runPdf();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTargetClosed =
      /target.*closed|context or browser has been closed|browser has been closed/i.test(msg);
    if (isTargetClosed) {
      console.warn("[PDF] Target closed, retrying once:", msg);
      return await runPdf();
    }
    throw err;
  }
}
