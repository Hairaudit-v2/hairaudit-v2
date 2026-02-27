import { createClient } from "@supabase/supabase-js";
import { normalizeAuditMode } from "@/lib/pdf/reportBuilder";
import { generateReportPdfFromUrl } from "@/lib/pdf/generateReportPdf";
import { buildPdfUrl } from "@/lib/reports/pdfUrl";
import { signRenderToken } from "@/lib/reports/internalRenderToken";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export function resolveInternalRenderBaseUrl(fallbackOrigin?: string): string {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  const fromVercel = String(process.env.VERCEL_URL ?? "").trim();
  if (fromVercel) return `https://${fromVercel.replace(/\/+$/, "")}`;
  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, "");
  throw new Error("Missing NEXT_PUBLIC_APP_URL/VERCEL_URL for internal PDF render URL");
}

function resolveRenderTokenSecret(): string {
  const secret =
    String(process.env.REPORT_RENDER_TOKEN ?? "").trim() ||
    String(process.env.INTERNAL_API_KEY ?? "").trim() ||
    String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  return secret;
}

export async function renderAndUploadPdfForCase(args: {
  caseId: string;
  auditMode?: string;
  version?: number;
  baseUrl?: string;
}) {
  const caseId = String(args.caseId ?? "").trim();
  if (!caseId) throw new Error("Missing caseId");

  const auditMode = normalizeAuditMode(args.auditMode);
  const secret = resolveRenderTokenSecret();
  if (!secret) throw new Error("Render token secret is not configured");

  const supabase = supabaseAdmin();
  const bucket = process.env.CASE_FILES_BUCKET || "case-files";

  let version =
    Number.isFinite(Number(args.version)) && Number(args.version) > 0
      ? Math.floor(Number(args.version))
      : null;

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
  const baseUrl = resolveInternalRenderBaseUrl(args.baseUrl);
  const renderUrl = buildPdfUrl({ caseId, auditMode, token, baseUrl });

  const pdfBuffer = await generateReportPdfFromUrl(renderUrl);
  const pdfPath = `${caseId}/v${version}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  return { pdfPath, auditMode, caseId };
}

