import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { renderAndUploadPdfForCase } from "@/lib/reports/renderPdfInternal";

export async function persistReportPdfPath(args: {
  reportId: string;
  caseId: string;
  version: number;
  pdfPath: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const payload = { pdf_path: args.pdfPath, status: "pdf_ready" as const, error: null };
  let res = await supabase.from("reports").update(payload).eq("id", args.reportId);
  if (res.error) {
    res = await supabase
      .from("reports")
      .update({ pdf_path: args.pdfPath, status: "complete", error: null })
      .eq("id", args.reportId);
  }
  if (res.error) {
    console.error("[reports/rebuild-pdf] failed to persist pdf_path", {
      reportId: args.reportId,
      version: args.version,
      message: res.error.message,
    });
    throw new Error(`Failed to update report pdf_path: ${res.error.message}`);
  }
}

export async function rebuildReportPdfForReport(args: {
  reportId: string;
  caseId: string;
  version: number;
  auditMode?: string;
  baseUrl?: string;
}): Promise<{ pdfPath: string }> {
  const result = await renderAndUploadPdfForCase({
    caseId: args.caseId,
    version: args.version,
    auditMode: args.auditMode,
    baseUrl: args.baseUrl,
  });
  await persistReportPdfPath({
    reportId: args.reportId,
    caseId: args.caseId,
    version: args.version,
    pdfPath: result.pdfPath,
  });
  return { pdfPath: result.pdfPath };
}
