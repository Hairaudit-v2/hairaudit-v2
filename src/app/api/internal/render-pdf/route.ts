import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeAuditMode } from "@/lib/pdf/reportBuilder";
import { generateReportPdfFromUrl } from "@/lib/pdf/generateReportPdf";
import { buildPdfUrl } from "@/lib/reports/pdfUrl";
import { signRenderToken } from "@/lib/reports/internalRenderToken";

export const runtime = "nodejs";
export const maxDuration = 60;

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

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

function resolveBaseUrl(req: Request): string {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  const fromVercel = String(process.env.VERCEL_URL ?? "").trim();
  if (fromVercel) return `https://${fromVercel.replace(/\/+$/, "")}`;
  return new URL(req.url).origin;
}

function resolveRenderTokenSecret(): string {
  const secret =
    String(process.env.REPORT_RENDER_TOKEN ?? "").trim() ||
    String(process.env.INTERNAL_API_KEY ?? "").trim() ||
    String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  return secret;
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

  const auditMode = normalizeAuditMode(body.auditMode);
  const secret = resolveRenderTokenSecret();
  if (!secret) return NextResponse.json({ error: "Render token secret is not configured" }, { status: 500 });

  const supabase = supabaseAdmin();
  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const fallbackVersion =
    Number.isFinite(Number(body.version)) && Number(body.version) > 0
      ? Math.floor(Number(body.version))
      : null;

  let version = fallbackVersion;
  if (!version) {
    const { data } = await supabase
      .from("reports")
      .select("version")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    version = Number(data?.version ?? 0) + 1;
  }

  const exp = Date.now() + 5 * 60 * 1000;
  const token = signRenderToken({ caseId, auditMode, exp, secret });
  const baseUrl = resolveBaseUrl(req);
  const renderUrl = buildPdfUrl({ caseId, auditMode, token, baseUrl });

  try {
    const pdfBuffer = await generateReportPdfFromUrl(renderUrl);
    const pdfPath = `${caseId}/v${version}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadErr) {
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
    }
    return NextResponse.json({ pdfPath, auditMode, caseId });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error)?.message ?? "Render failed" }, { status: 500 });
  }
}

