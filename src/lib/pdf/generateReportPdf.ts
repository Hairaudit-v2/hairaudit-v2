export async function generateReportPdfFromUrl(url: string): Promise<Buffer> {
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
