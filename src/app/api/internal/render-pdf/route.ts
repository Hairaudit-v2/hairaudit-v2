import { NextResponse } from "next/server";
import { renderAndUploadPdfForCase } from "@/lib/reports/renderPdfInternal";
import { authorizeInternalApiRequest } from "@/lib/security/internalApiAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!authorizeInternalApiRequest(req)) {
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
    const msg = (e as Error)?.message ?? "Render failed";
    const code = (e as any)?.code;
    if (code === "AUDIT_NOT_READY") {
      return NextResponse.json({ code: "AUDIT_NOT_READY", error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

