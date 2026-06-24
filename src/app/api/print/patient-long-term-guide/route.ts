import { NextResponse } from "next/server";
import { buildPatientLongTermGuideContent } from "@/lib/reports/patientLongTermGuide";
import { renderPatientLongTermGuideHtml } from "@/lib/reports/PatientLongTermGuideHtml";
import { normalizeLocale } from "@/lib/i18n/constants";

/**
 * GET /api/print/patient-long-term-guide
 * Returns the HairAudit long-term hair restoration guide as print-ready HTML.
 * Used for PDF generation and optional browser preview (no auth — same as prior static PDF).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = normalizeLocale(url.searchParams.get("locale") ?? undefined);
  const content = buildPatientLongTermGuideContent(locale);
  const html = renderPatientLongTermGuideHtml(content);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "X-Report-Template": "demo",
    },
  });
}
