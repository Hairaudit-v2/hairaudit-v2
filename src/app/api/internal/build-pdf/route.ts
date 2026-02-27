import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function resolveBaseUrl(req: Request): string {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  const fromVercel = String(process.env.VERCEL_URL ?? "").trim();
  if (fromVercel) return `https://${fromVercel.replace(/\/+$/, "")}`;
  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  let body: {
    content?: { caseId?: string; auditMode?: string; version?: number };
    uploads?: Array<{ type?: string; storage_path?: string }>;
    pdfStoragePath?: string;
    token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const caseId = String(body?.content?.caseId ?? "").trim();
  if (!caseId) return NextResponse.json({ error: "Missing content.caseId" }, { status: 400 });
  const internalApiKey =
    String(process.env.INTERNAL_API_KEY ?? "").trim() ||
    String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!internalApiKey) return NextResponse.json({ error: "Missing internal API key configuration" }, { status: 500 });
  const baseUrl = resolveBaseUrl(req);

  try {
    const renderRes = await fetch(`${baseUrl}/api/internal/render-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": internalApiKey,
      },
      body: JSON.stringify({
        caseId,
        auditMode: body?.content?.auditMode,
        version: body?.content?.version,
      }),
    });
    const renderJson = await renderRes.json().catch(() => ({}));
    if (!renderRes.ok) {
      return NextResponse.json({ error: renderJson?.error || "Render request failed" }, { status: renderRes.status });
    }
    return NextResponse.json({
      pdfPath: renderJson?.pdfPath,
      auditMode: renderJson?.auditMode,
      caseId: renderJson?.caseId ?? caseId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
