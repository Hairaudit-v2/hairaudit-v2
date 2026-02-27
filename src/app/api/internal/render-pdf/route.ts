import { NextResponse } from "next/server";
import { renderAndUploadPdfForCase } from "@/lib/reports/renderPdfInternal";

export const runtime = "nodejs";
export const maxDuration = 60;

function resolveInternalApiKey(req: Request): string {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const header = req.headers.get("x-internal-api-key")?.trim();
  const legacy = req.headers.get("x-internal-token")?.trim();
  return bearer || header || legacy || "";
}

function isInternalAuthorized(req: Request): boolean {
  const provided = resolveInternalApiKey(req);
  if (!provided) return false;
  const allow = [
    process.env.INTERNAL_API_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.REPORT_RENDER_TOKEN,
    process.env.INTERNAL_BUILD_PDF_TOKEN,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return allow.includes(provided);
}

export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    caseId?: string;
    auditMode?: string;
    version?: number;
  };
  const caseId = String(body.caseId ?? "").trim();
  if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 });

  try {
    const result = await renderAndUploadPdfForCase({
      caseId,
      auditMode: body.auditMode,
      version: body.version,
      baseUrl: new URL(req.url).origin,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error)?.message ?? "Render failed" }, { status: 500 });
  }
}

