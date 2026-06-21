import { signRenderToken } from "../../../src/lib/reports/internalRenderToken";
import { requireReportRenderTokenSecret } from "../../../src/lib/security/secrets";

export function buildPrintReportUrl(caseId: string, baseURL: string): string | null {
  try {
    const secret = requireReportRenderTokenSecret();
    const token = signRenderToken({
      caseId,
      auditMode: "patient",
      exp: Date.now() + 15 * 60 * 1000,
      secret,
    });
    const url = new URL("/api/print/report", baseURL);
    url.searchParams.set("caseId", caseId);
    url.searchParams.set("auditMode", "patient");
    url.searchParams.set("token", token);
    return url.toString();
  } catch {
    return null;
  }
}
