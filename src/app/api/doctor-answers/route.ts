import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { mapLegacyDoctorAnswers } from "@/lib/doctorAuditSchema";
import { computeDoctorAiContextV1 } from "@/lib/benchmarks/domainScoring";
import { mergeFieldProvenance } from "@/lib/audit/fieldProvenance";

// GET ?caseId=... — applies backward compat mapping for legacy field names
export async function GET(req: Request) {
  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId");
  if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 });

  const auth = await createSupabaseAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: c } = await admin.from("cases").select("id, user_id, doctor_id, clinic_id").eq("id", caseId).maybeSingle();
  const allowed = await canAccessCase(user.id, c);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: report } = await admin
    .from("reports")
    .select("id, summary")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const raw = (report?.summary as Record<string, unknown>)?.doctor_answers ?? null;
  const doctorAnswers = raw ? mapLegacyDoctorAnswers(raw as Record<string, unknown>) : null;
  return NextResponse.json({ doctorAnswers: doctorAnswers || raw });
}

// POST ?caseId=...
export async function POST(req: Request) {
  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId");
  if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 });

  const auth = await createSupabaseAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: c } = await admin
    .from("cases")
    .select("id, user_id, doctor_id, clinic_id, status, submitted_at")
    .eq("id", caseId)
    .maybeSingle();

  const allowed = await canAccessCase(user.id, c);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (c?.submitted_at || c?.status === "submitted") {
    return NextResponse.json({ error: "Case already submitted" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const incoming = body?.doctorAnswers;
  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json({ error: "Missing doctorAnswers" }, { status: 400 });
  }

  // Never accept client-provided scoring/context; these are computed server-side.
  const incomingClean = { ...(incoming as Record<string, unknown>) } as Record<string, unknown>;
  delete (incomingClean as any).ai_context;
  delete (incomingClean as any).scoring;

  const { data: existing } = await admin
    .from("reports")
    .select("id, version, summary")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentSummary = (existing?.summary ?? {}) as Record<string, unknown>;
  const currentDoctor = (currentSummary.doctor_answers ?? {}) as Record<string, unknown>;
  const provenance = mergeFieldProvenance({
    previousAnswers: currentDoctor,
    incomingAnswers: incomingClean,
    previousProvenance: currentDoctor.field_provenance,
    incomingProvenance: incomingClean.field_provenance,
  });
  const doctorAnswers = { ...currentDoctor, ...incomingClean, field_provenance: provenance } as Record<string, unknown>;

  // Compute completeness/confidence context continuously on save (best-effort).
  try {
    const { getUserRole } = await import("@/lib/case-access");
    const role = await getUserRole(user.id);
    const effectiveDoctorId = role === "doctor" ? user.id : (c?.doctor_id ?? null);
    const effectiveClinicId = c?.clinic_id ?? null;

    const { data: uploads, error: uploadsErr } = await admin
      .from("uploads")
      .select("type, metadata")
      .eq("case_id", caseId);

    if (!uploadsErr) {
      const ctx = computeDoctorAiContextV1({
        uploads: (uploads ?? []) as any,
        doctorAnswersRaw: doctorAnswers,
        doctorId: effectiveDoctorId,
        clinicId: effectiveClinicId,
      });
      (doctorAnswers as any).ai_context = ctx.ai_context;
    }
  } catch {
    // Best-effort only; never block save on context computation.
  }

  const nextSummary = { ...currentSummary, doctor_answers: doctorAnswers };

  if (existing) {
    await admin.from("reports").update({ summary: nextSummary }).eq("id", existing.id);
    const { getUserRole } = await import("@/lib/case-access");
    if ((await getUserRole(user.id)) === "doctor") {
      await admin.from("cases").update({ doctor_id: user.id }).eq("id", caseId);
    }
    return NextResponse.json({ ok: true });
  }

  const { data: created } = await admin
    .from("reports")
    .insert({ case_id: caseId, version: 1, pdf_path: "", summary: nextSummary })
    .select("id")
    .maybeSingle();

  const { getUserRole } = await import("@/lib/case-access");
  if ((await getUserRole(user.id)) === "doctor") {
    await admin.from("cases").update({ doctor_id: user.id }).eq("id", caseId);
  }
  return NextResponse.json({ ok: true, reportId: created?.id });
}
