export type PdfReportTemplate = "elite" | "demo";

const DEMO_TEMPLATE_KEYS = new Set(["demo", "sample"]);

const ELITE_CLINICAL_TEMPLATE_KEYS = new Set([
  "elite",
  "post-surgery-audit",
  "post-surgery",
  "pre-surgery-planning",
  "pre-surgery",
]);

function canonicalTemplateKey(input: string): string {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

export function normalizeReportTemplateForPdf(input: string): PdfReportTemplate {
  const key = canonicalTemplateKey(input);
  if (!key) {
    throw new Error(
      "PDF template normalization failed: empty template value. Expected a clinical report type or elite/demo."
    );
  }
  if (DEMO_TEMPLATE_KEYS.has(key)) return "demo";
  if (ELITE_CLINICAL_TEMPLATE_KEYS.has(key)) return "elite";
  throw new Error(
    `PDF template normalization failed: unknown template '${input}'. Clinical audit reports map to elite; demo/sample map to demo.`
  );
}

export function validatePdfPreflightTemplateHeader(templateHeader: string | null): PdfReportTemplate {
  const header = String(templateHeader ?? "").trim().toLowerCase();
  if (header === "elite" || header === "demo") return header;
  throw new Error(
    `PDF preflight refused: expected X-Report-Template=elite or demo but got '${templateHeader ?? "null"}'.`
  );
}

export function logPdfTemplateNormalized(args: {
  caseId?: string | null;
  reportId?: string | null;
  inputTemplate: string;
  normalizedTemplate: PdfReportTemplate;
}): void {
  console.info("pdf_template_normalized", {
    caseId: args.caseId ?? null,
    reportId: args.reportId ?? null,
    inputTemplate: args.inputTemplate,
    normalizedTemplate: args.normalizedTemplate,
  });
}

export function resolvePdfReportTemplateHeader(args: {
  inputTemplate: string;
  caseId?: string | null;
  reportId?: string | null;
}): PdfReportTemplate {
  const normalizedTemplate = normalizeReportTemplateForPdf(args.inputTemplate);
  logPdfTemplateNormalized({
    caseId: args.caseId,
    reportId: args.reportId,
    inputTemplate: args.inputTemplate,
    normalizedTemplate,
  });
  return normalizedTemplate;
}
