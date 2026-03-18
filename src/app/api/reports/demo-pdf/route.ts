import { NextResponse } from "next/server";
import { generateReportPdfFromUrl } from "@/lib/pdf/generateReportPdf";
import { getBaseUrl } from "@/lib/reports/getBaseUrl";

/**
 * GET /api/reports/demo-pdf
 * Generates and returns the HairAudit sample report as a PDF download.
 * Uses the same Playwright-based pipeline as production reports but with demo content only.
 */
export async function GET() {
  let baseUrl: string;
  try {
    baseUrl = getBaseUrl();
  } catch (e) {
    return new NextResponse(
      "PDF generation requires SITE_URL or VERCEL_URL to be set.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const demoReportUrl = `${baseUrl}/api/print/demo-report`;

  try {
    const pdfBuffer = await generateReportPdfFromUrl(demoReportUrl);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="HairAudit-Sample-Report.pdf"',
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    console.error("[demo-pdf]", message, err);
    return new NextResponse(message, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
