/**
 * Internal API for PDF generation. Called by Inngest to avoid bundling
 * reportBuilder/pdfkit/@napi-rs/canvas into the api/inngest function (Vercel 300MB limit).
 *
 * POST with token, content (minus images), uploads list. Builds PDF, uploads to storage, returns path.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildAuditReportPdf, fetchReportImages } from "@/lib/pdf/reportBuilder";

export const runtime = "nodejs";
export const maxDuration = 60;

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function POST(req: Request) {
  const token = req.headers.get("x-internal-token") ?? new URL(req.url).searchParams.get("token") ?? "";
  const expected = process.env.REPORT_RENDER_TOKEN ?? process.env.INTERNAL_BUILD_PDF_TOKEN ?? "local";
  if (token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    content: Parameters<typeof buildAuditReportPdf>[0];
    uploads: Array<{ type?: string; storage_path?: string }>;
    pdfStoragePath: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { content, uploads, pdfStoragePath } = body;
  if (!content?.caseId || !pdfStoragePath) {
    return NextResponse.json({ error: "Missing content.caseId or pdfStoragePath" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const bucket = process.env.CASE_FILES_BUCKET || "case-files";

  try {
    const images = await fetchReportImages(supabase, bucket, uploads ?? []);
    const pdfBuffer = await buildAuditReportPdf({ ...content, images });

    const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from((pdfBuffer as { data?: number[] })?.data ?? []);
    const { error } = await supabase.storage.from(bucket).upload(pdfStoragePath, buf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) throw new Error(`storage upload failed: ${error.message}`);

    return NextResponse.json({ pdfPath: pdfStoragePath, bytes: buf.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
