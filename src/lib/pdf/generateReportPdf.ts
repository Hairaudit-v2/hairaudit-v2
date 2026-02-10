import { chromium } from "playwright";

export async function generateReportPdfFromUrl(url: string): Promise<Buffer> {
  const browser = await chromium.launch({
    headless: true,
  });

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
