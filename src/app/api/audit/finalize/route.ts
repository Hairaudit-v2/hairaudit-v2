import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/case-access";
import { normalizeAuditMode } from "@/lib/pdf/reportBuilder";

const AUDITOR_EMAIL = "auditor@hairaudit.com";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { caseId, score: bodyScore, notes: bodyNotes, findings: bodyFindings } = body;
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
    // Prefer request body so PDF always reflects what the user just submitted (no race with DB)
    const score =
      typeof bodyScore === "number"
        ? bodyScore
        : bodyScore != null
          ? Number(bodyScore)
          : typeof summary.score === "number"
            ? summary.score
            : null;
    const notes =
      typeof bodyNotes === "string"
        ? bodyNotes
        : (typeof summary.notes === "string" ? summary.notes : "") || "";
    const findings = Array.isArray(bodyFindings)
      ? bodyFindings
      : typeof bodyFindings === "string"
        ? [bodyFindings]
        : Array.isArray(summary.findings)
          ? summary.findings
          : [];

    const internalApiKey =
      String(process.env.INTERNAL_API_KEY ?? "").trim() ||
      String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
    if (!internalApiKey) {
      return NextResponse.json({ error: "Missing internal API key configuration" }, { status: 500 });
    }
    const baseUrl = new URL(req.url).origin;
    const renderRes = await fetch(`${baseUrl}/api/internal/render-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": internalApiKey,
      },
      body: JSON.stringify({
        caseId,
        auditMode: normalizeAuditMode("auditor"),
        version: latestReport.version,
      }),
    });
    const renderJson = await renderRes.json().catch(() => ({}));
    if (!renderRes.ok) {
      return NextResponse.json({ error: renderJson?.error || "Failed to render PDF" }, { status: renderRes.status });
    }
    const pdfPath = String(renderJson?.pdfPath ?? `${caseId}/v${latestReport.version}.pdf`);

    const nextSummary = {
      ...summary,
      score,
      notes,
      findings,
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
