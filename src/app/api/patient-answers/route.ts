import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

// GET ?caseId=... — load patient answers (v2 preferred, legacy fallback)
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

    const { data: report, error: reportErr } = await supabase
      .from("reports")
      .select("id, summary, patient_audit_version, patient_audit_v2")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reportErr && String(reportErr.message || "").includes("patient_audit")) {
      const fallback = await supabase
        .from("reports")
        .select("id, summary")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const patientAnswers = (fallback?.data?.summary as Record<string, unknown> | undefined)?.patient_answers as Record<string, unknown> | null ?? null;
      return NextResponse.json({ patientAnswers });
    }
    if (reportErr) throw reportErr;

    let patientAnswers: Record<string, unknown> | null = null;
    const r = report as { patient_audit_version?: number; patient_audit_v2?: Record<string, unknown> | null; summary?: { patient_answers?: unknown } } | null;
    if (r?.patient_audit_version === 2 && r?.patient_audit_v2 && typeof r.patient_audit_v2 === "object" && Object.keys(r.patient_audit_v2).length > 0) {
      patientAnswers = r.patient_audit_v2 as Record<string, unknown>;
    } else {
      patientAnswers = (report?.summary as Record<string, unknown> | undefined)?.patient_answers as Record<string, unknown> | null ?? null;
    }
    return NextResponse.json({ patientAnswers });
  } catch (e: unknown) {
    const errMsg = (e as Error)?.message ?? "Server error";
    console.error("patient-answers GET:", errMsg, e);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

// POST ?caseId=... — save patient answers (draft or full; v2 stored when complete)
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
    const raw = body?.patientAnswers;
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Missing patientAnswers object" }, { status: 400 });
    }

    const patientAnswers = raw as Record<string, unknown>;

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

    const updatePayload: Record<string, unknown> = {
      summary: nextSummary,
      patient_audit_version: 2,
      patient_audit_v2: patientAnswers,
    };

    if (existing) {
      let { error } = await supabase.from("reports").update(updatePayload).eq("id", existing.id);
      if (error && String(error.message || "").includes("patient_audit")) {
        const { error: fallbackErr } = await supabase
          .from("reports")
          .update({ summary: nextSummary })
          .eq("id", existing.id);
        if (fallbackErr) return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
      } else if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, reportId: existing.id });
    }

    const insertPayload: Record<string, unknown> = {
      case_id: caseId,
      version: 1,
      summary: nextSummary,
      pdf_path: "",
      patient_audit_version: 2,
      patient_audit_v2: patientAnswers,
    };

    const { data: created, error: insErr } = await supabase
      .from("reports")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (insErr) {
      if (String(insErr.message || "").includes("patient_audit")) {
        const fallback = await supabase
          .from("reports")
          .insert({
            case_id: caseId,
            version: 1,
            summary: nextSummary,
            pdf_path: "",
          })
          .select("id")
          .maybeSingle();
        if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
        return NextResponse.json({ ok: true, reportId: fallback.data?.id });
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    if (!created) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    return NextResponse.json({ ok: true, reportId: created.id });
  } catch (e: unknown) {
    const errMsg = (e as Error)?.message ?? "Server error";
    console.error("patient-answers POST:", errMsg, e);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
