import { NextResponse } from "next/server";
import { renderDemoReportHtml } from "@/lib/reports/DemoReportHtml";

/**
 * GET /api/print/demo-report
 * Returns the HairAudit demo/sample report as HTML (no auth required).
 * Used for website preview and PDF generation via generateReportPdfFromUrl.
 * Production clinical reports remain unchanged (use /api/print/report with caseId + token).
 */
export async function GET() {
  const html = renderDemoReportHtml();

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      "X-Report-Template": "demo",
    },
  });
}
