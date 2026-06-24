import { NextResponse } from "next/server";
import { generateReportPdfFromUrl } from "@/lib/pdf/generateReportPdf";
import { getBaseUrl } from "@/lib/reports/getBaseUrl";
import { normalizeLocale } from "@/lib/i18n/constants";

/**
 * GET /api/reports/patient-long-term-guide
 * Generates and returns the long-term hair restoration guide as a PDF download.
 * Rewritten from /post-operative-hair-protection-guide.pdf to preserve the existing download path.
 */
export async function GET(req: Request) {
  let baseUrl: string;
  try {
    baseUrl = getBaseUrl();
  } catch {
    return new NextResponse("PDF generation requires SITE_URL or VERCEL_URL to be set.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(req.url);
  const locale = normalizeLocale(url.searchParams.get("locale") ?? undefined);
  const printUrl = `${baseUrl}/api/print/patient-long-term-guide?locale=${encodeURIComponent(locale)}`;

  try {
    const pdfBuffer = await generateReportPdfFromUrl(printUrl);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="HairAudit-Long-Term-Hair-Restoration-Guide.pdf"',
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    console.error("[patient-long-term-guide-pdf]", message, err);
    return new NextResponse(message, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
