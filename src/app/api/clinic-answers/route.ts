import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { validateClinicAnswers } from "@/lib/clinicAuditSchema";
import { mergeFieldProvenance } from "@/lib/audit/fieldProvenance";

// GET ?caseId=...
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

  const clinicAnswers = (report?.summary as Record<string, unknown>)?.clinic_answers ?? null;
  return NextResponse.json({ clinicAnswers });
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
  const clinicAnswers = body?.clinicAnswers;
  if (!clinicAnswers || typeof clinicAnswers !== "object") {
    return NextResponse.json({ error: "Missing clinicAnswers" }, { status: 400 });
  }
  const incomingRecord = clinicAnswers as Record<string, unknown>;
  const validationError = validateClinicAnswers(incomingRecord);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("reports")
    .select("id, version, summary")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentSummary = (existing?.summary ?? {}) as Record<string, unknown>;
  const currentClinic = (currentSummary.clinic_answers ?? {}) as Record<string, unknown>;
  const provenance = mergeFieldProvenance({
    previousAnswers: currentClinic,
    incomingAnswers: incomingRecord,
    previousProvenance: currentClinic.field_provenance,
    incomingProvenance: incomingRecord.field_provenance,
  });
  const mergedClinicAnswers = { ...currentClinic, ...incomingRecord, field_provenance: provenance };
  const nextSummary = { ...currentSummary, clinic_answers: mergedClinicAnswers };

  if (existing) {
    await admin.from("reports").update({ summary: nextSummary }).eq("id", existing.id);
    const { getUserRole } = await import("@/lib/case-access");
    if ((await getUserRole(user.id)) === "clinic") {
      await admin.from("cases").update({ clinic_id: user.id }).eq("id", caseId);
    }
    return NextResponse.json({ ok: true });
  }

  const { data: created } = await admin
    .from("reports")
    .insert({ case_id: caseId, version: 1, pdf_path: "", summary: nextSummary })
    .select("id")
    .maybeSingle();

  const { getUserRole } = await import("@/lib/case-access");
  if ((await getUserRole(user.id)) === "clinic") {
    await admin.from("cases").update({ clinic_id: user.id }).eq("id", caseId);
  }
  return NextResponse.json({ ok: true, reportId: created?.id });
}
