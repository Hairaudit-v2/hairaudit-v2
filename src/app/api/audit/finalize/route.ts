import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/case-access";
import PDFDocument from "pdfkit";

const AUDITOR_EMAIL = "manager@evolvedhair.com.au";
const BUCKET = process.env.CASE_FILES_BUCKET || "case-files";

export async function POST(req: Request) {
  try {
    const { caseId } = await req.json().catch(() => ({}));
    if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 });

    const supabaseAuth = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = await getUserRole(user.id);
    const isAuditor = role === "auditor" || user.email === AUDITOR_EMAIL;
    if (!isAuditor) return NextResponse.json({ error: "Forbidden: auditors only" }, { status: 403 });

    const admin = createSupabaseAdminClient();
    const { data: c, error: caseErr } = await admin
      .from("cases")
      .select("id, status")
      .eq("id", caseId)
      .maybeSingle();

    if (caseErr || !c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

    const { data: latestReport, error: repErr } = await admin
      .from("reports")
      .select("id, version, summary")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (repErr || !latestReport) return NextResponse.json({ error: "No report found" }, { status: 404 });

    const summary = (latestReport.summary ?? {}) as Record<string, unknown>;
    const score = typeof summary.score === "number" ? summary.score : null;
    const notes = typeof summary.notes === "string" ? summary.notes : "";
    const findings = Array.isArray(summary.findings) ? summary.findings : [];

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(20).text("HairAudit Report (Manual)", { align: "left" });
      doc.moveDown();
      doc.fontSize(12).text(`Case ID: ${caseId}`);
      doc.text(`Version: v${latestReport.version}`);
      doc.text(`Generated: ${new Date().toLocaleString()} (manual audit)`);
      doc.moveDown();

      doc.fontSize(14).text("Audit Summary", { underline: true });
      doc.moveDown(0.5);
      if (score !== null) doc.fontSize(12).text(`Overall Score: ${score}/100`);
      doc.text("Notes:", { continued: false });
      doc.text(notes || "—", { align: "left" });
      if (findings.length) {
        doc.moveDown();
        doc.text("Key Findings:");
        findings.forEach((f) => doc.text(`  • ${f}`, { indent: 20 }));
      }
      doc.end();
    });

    const pdfPath = `${caseId}/v${latestReport.version}.pdf`;
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });

    if (uploadErr) return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });

    const nextSummary = {
      ...summary,
      manual_audit: true,
      manual_audit_completed_at: new Date().toISOString(),
    };

    await admin
      .from("reports")
      .update({ pdf_path: pdfPath, status: "complete", error: null, summary: nextSummary })
      .eq("id", latestReport.id);

    await admin.from("cases").update({ status: "complete" }).eq("id", caseId);

    return NextResponse.json({ ok: true, pdfPath });
  } catch (e: unknown) {
    console.error("audit finalize error:", e);
    return NextResponse.json({ error: (e as Error).message ?? "Server error" }, { status: 500 });
  }
}
