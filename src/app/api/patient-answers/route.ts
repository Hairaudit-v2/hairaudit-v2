import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

// GET ?caseId=... — load patient answers
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const caseId = url.searchParams.get("caseId");
    if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 });

    const auth = await createSupabaseAuthServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    const { data: c } = await supabase
      .from("cases")
      .select("id, user_id")
      .eq("id", caseId)
      .maybeSingle();

    if (!c || c.user_id !== user.id) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const { data: report } = await supabase
      .from("reports")
      .select("id, summary")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const patientAnswers = (report?.summary as any)?.patient_answers ?? null;
    return NextResponse.json({ patientAnswers });
  } catch (e: any) {
    const errMsg = e?.message ?? "Server error";
    console.error("patient-answers GET:", errMsg, e);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

// POST ?caseId=... — save patient answers
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const caseId = url.searchParams.get("caseId");
    if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 });

    const auth = await createSupabaseAuthServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createSupabaseAdminClient();

    const { data: c } = await supabase
      .from("cases")
      .select("id, user_id, status, submitted_at")
      .eq("id", caseId)
      .maybeSingle();

    if (!c || c.user_id !== user.id) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    if (c.submitted_at || c.status === "submitted") {
      return NextResponse.json({ error: "Case already submitted; cannot edit answers" }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const patientAnswers = body?.patientAnswers;
    if (!patientAnswers || typeof patientAnswers !== "object") {
      return NextResponse.json({ error: "Missing patientAnswers object" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("reports")
      .select("id, version, summary")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentSummary = (existing?.summary ?? {}) as Record<string, unknown>;
    const nextSummary = {
      ...currentSummary,
      patient_answers: patientAnswers,
      patient_answers_updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabase
        .from("reports")
        .update({ summary: nextSummary })
        .eq("id", existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, reportId: existing.id });
    }

    const { data: created, error: insErr } = await supabase
      .from("reports")
      .insert({
        case_id: caseId,
        version: 1,
        summary: nextSummary,
      })
      .select("id")
      .maybeSingle();

    if (insErr || !created) {
      return NextResponse.json({ error: insErr?.message ?? "Insert failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, reportId: created.id });
  } catch (e: any) {
    const errMsg = e?.message ?? "Server error";
    console.error("patient-answers POST:", errMsg, e);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
