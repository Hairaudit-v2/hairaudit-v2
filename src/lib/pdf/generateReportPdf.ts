export async function generateReportPdfFromUrl(url: string): Promise<Buffer> {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.LAMBDA_TASK_ROOT
  );

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
    const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle" });
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
