import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import {
  type EvidenceScore,
  canSubmit,
  computeEvidenceScore,
  computeConfidenceLabel,
  computeEvidenceDetails,
} from "@/lib/auditPhotoSchemas";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function POST(req: Request) {
  try {
    const { caseId } = await req.json();

    if (!caseId) {
      return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
    }

    const supabaseAuth = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const { data: c, error: caseErr } = await admin
      .from("cases")
      .select("id,user_id,status,submitted_at")
      .eq("id", caseId)
      .maybeSingle();

    if (caseErr) {
      return NextResponse.json({ error: caseErr.message }, { status: 500 });
    }
    if (!c) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }
    if (c.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if ((c.submitted_at || c.status === "submitted") && c.status !== "audit_failed") {
      return NextResponse.json({ error: "Case already submitted" }, { status: 409 });
    }

    const { data: uploads } = await admin
      .from("uploads")
      .select("type")
      .eq("case_id", caseId);

    const photos = (uploads ?? []).map((u) => ({ type: u.type }));

    if (!canSubmit("patient", photos)) {
      return NextResponse.json(
        { error: "Upload required patient photos first (Current Front, Top, Donor rear). Go to Step 2: Add your photos." },
        { status: 400 }
      );
    }

    const patientScore = computeEvidenceScore("patient", photos);
    const patientConfidence = computeConfidenceLabel(patientScore);
    const patientDetails = computeEvidenceDetails("patient", photos);

    let doctorScore: EvidenceScore | null = null;
    let doctorConfidence: string | null = null;
    const doctorPhotos = photos.filter((p) => String(p.type ?? "").startsWith("doctor_photo:"));
    if (doctorPhotos.length > 0) {
      doctorScore = computeEvidenceScore("doctor", doctorPhotos);
      doctorConfidence = computeConfidenceLabel(doctorScore);
    }

    const evidenceDetails: Record<string, unknown> = {
      patient: patientDetails,
      ...(doctorScore && {
        doctor: computeEvidenceDetails("doctor", doctorPhotos),
      }),
    };

    const now = new Date().toISOString();

    const updatePayload = {
      status: "submitted",
      submitted_at: now,
      evidence_score_patient: patientScore,
      confidence_label_patient: patientConfidence,
      evidence_score_doctor: doctorScore,
      confidence_label_doctor: doctorConfidence,
      evidence_details: evidenceDetails,
    };

    const { error: updErr } = await admin
      .from("cases")
      .update(updatePayload)
      .eq("id", caseId)
      .eq("user_id", user.id)
      .in("status", ["draft", "audit_failed"]);

    if (updErr) {
      if (String(updErr.message || "").includes("evidence") || String(updErr.message || "").includes("does not exist")) {
        const { error: fallbackErr } = await admin
          .from("cases")
          .update({ status: "submitted", submitted_at: now })
          .eq("id", caseId)
          .eq("user_id", user.id)
          .in("status", ["draft", "audit_failed"]);
        if (fallbackErr) return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
      } else {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    }

    await inngest.send({
      name: "case/submitted",
      data: { caseId, userId: user.id },
    });

    return NextResponse.json({ ok: true, submitted_at: now });
  } catch (e: any) {
    console.error("submit-case error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}