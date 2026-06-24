import { fetchReportPdfFromStorage } from "@/lib/reports/fetchReportPdfFromStorage";
import { rebuildReportPdfForReport } from "@/lib/reports/rebuildReportPdf";
import type { AuthorizedReportPdfContext } from "@/lib/reports/reportAccess";

export const REPORT_PDF_MISSING_REGEN_ERROR =
  "Report exists, but the PDF file is missing and could not be regenerated.";

export type FetchReportPdfWithRecoveryResult =
  | { ok: true; blob: Blob; pdfPath: string; rebuilt: boolean }
  | { ok: false; status: number; error: string };

export type ReportPdfRecoveryOverrides = {
  fetchFromStorage?: typeof fetchReportPdfFromStorage;
  rebuildPdf?: typeof rebuildReportPdfForReport;
};

type AuthorizedCtx = Extract<AuthorizedReportPdfContext, { ok: true }>;

export async function fetchReportPdfWithRecovery(
  ctx: AuthorizedCtx,
  overrides?: ReportPdfRecoveryOverrides
): Promise<FetchReportPdfWithRecoveryResult> {
  const fetchFromStorage = overrides?.fetchFromStorage ?? fetchReportPdfFromStorage;
  const rebuildPdf = overrides?.rebuildPdf ?? rebuildReportPdfForReport;

  const initial = await fetchFromStorage(ctx.storage, ctx.bucket, ctx.pdfPath);
  if ("blob" in initial) {
    return { ok: true, blob: initial.blob, pdfPath: initial.storagePath, rebuilt: false };
  }

  console.warn("[reports/pdf-recovery] stored PDF missing, attempting rebuild", {
    reportId: ctx.report.id,
    version: ctx.report.version ?? null,
    pdfPath: ctx.pdfPath,
    storageError: initial.error,
  });

  const version = Number(ctx.report.version ?? 0);
  if (version < 1) {
    console.error("[reports/pdf-recovery] rebuild skipped: invalid version", {
      reportId: ctx.report.id,
      version,
    });
    return { ok: false, status: 422, error: REPORT_PDF_MISSING_REGEN_ERROR };
  }

  try {
    const rebuilt = await rebuildPdf({
      reportId: ctx.report.id,
      caseId: ctx.report.case_id,
      version,
    });
    const afterRebuild = await fetchFromStorage(ctx.storage, ctx.bucket, rebuilt.pdfPath);
    if ("blob" in afterRebuild) {
      console.info("[reports/pdf-recovery] rebuild succeeded", {
        reportId: ctx.report.id,
        version,
        pdfPath: rebuilt.pdfPath,
      });
      return { ok: true, blob: afterRebuild.blob, pdfPath: afterRebuild.storagePath, rebuilt: true };
    }

    console.error("[reports/pdf-recovery] rebuild uploaded but fetch failed", {
      reportId: ctx.report.id,
      version,
      pdfPath: rebuilt.pdfPath,
      storageError: afterRebuild.error,
    });
    return { ok: false, status: 500, error: REPORT_PDF_MISSING_REGEN_ERROR };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    const msg = String((e as Error)?.message ?? e);
    const missingFields = (e as { missingFields?: string[] })?.missingFields;
    console.error("[reports/pdf-recovery] rebuild failed", {
      reportId: ctx.report.id,
      version,
      code: code ?? null,
      missingFields: missingFields ?? null,
      reason:
        code === "PDF_REBUILD_NOT_READY"
          ? "rebuild_preflight_blocked"
          : code === "AUDIT_NOT_READY" || /AUDIT_NOT_READY/i.test(msg)
            ? "audit_not_ready"
            : "rebuild_error",
    });
    return { ok: false, status: 422, error: REPORT_PDF_MISSING_REGEN_ERROR };
  }
}
