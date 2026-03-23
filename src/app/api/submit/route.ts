import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  type EvidenceScore,
  canSubmit,
  computeEvidenceScore,
  computeConfidenceLabel,
  computeEvidenceDetails,
} from "@/lib/auditPhotoSchemas";
import { getUserRole } from "@/lib/case-access";
import { normalizedPatientAnswersFromReportRow } from "@/lib/patient/answersFromReportRow";
import {
  evaluatePatientPhotoSubmitGate,
  PATIENT_ALTERNATE_OUTCOME_SUBMIT_HINT,
} from "@/lib/patientPhoto/patientPhotoReadinessPolicy";
import { isPatientPhotoStageAwareSubmitEnabled } from "@/lib/features/enablePatientPhotoStageAwareSubmit";
import { filterPatientPhotosForAuditUse } from "@/lib/uploads/patientPhotoAuditMeta";

function buildPhotosForPatientScoring(
  rows: Array<{ type?: string | null; metadata?: unknown }>
): Array<{ type: string | null | undefined }> {
  const nonPatient = rows.filter((u) => !String(u.type ?? "").toLowerCase().startsWith("patient_photo:"));
  const patientOk = filterPatientPhotosForAuditUse(
    rows.filter((u) => String(u.type ?? "").toLowerCase().startsWith("patient_photo:"))
  );
  return [...nonPatient, ...patientOk].map((u) => ({ type: u.type }));
}

function supabaseAdmin() {
  return createSupabaseAdminClient();
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
      .select("id,user_id,patient_id,doctor_id,clinic_id,audit_type,status,submitted_at")
      .eq("id", caseId)
      .maybeSingle();

    if (caseErr) {
      return NextResponse.json({ error: caseErr.message }, { status: 500 });
    }
    if (!c) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }
    const role = await getUserRole(user.id);
    const isCaseMember =
      c.user_id === user.id ||
      c.patient_id === user.id ||
      c.doctor_id === user.id ||
      c.clinic_id === user.id;
    if (!isCaseMember || role === "auditor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if ((c.submitted_at || c.status === "submitted") && c.status !== "audit_failed") {
      return NextResponse.json({ error: "Case already submitted" }, { status: 409 });
    }

    const { data: uploads } = await admin
      .from("uploads")
      .select("type, metadata")
      .eq("case_id", caseId);

    const uploadRows = uploads ?? [];
    const photosForEvidence = uploadRows.map((u) => ({ type: u.type }));

    const submitterType = c.audit_type === "doctor" ? "doctor" : c.audit_type === "clinic" ? "clinic" : "patient";
    let patientPhotoGateForMeta: ReturnType<typeof evaluatePatientPhotoSubmitGate> | null = null;

    if (submitterType === "patient") {
      const { data: reportRow } = await admin
        .from("reports")
        .select("summary, patient_audit_version, patient_audit_v2")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const patientAnswers = normalizedPatientAnswersFromReportRow(reportRow);
      const photoGate = evaluatePatientPhotoSubmitGate({
        uploadRows,
        patientAnswers,
        stageAwareSubmitEnabled: isPatientPhotoStageAwareSubmitEnabled(),
      });
      patientPhotoGateForMeta = photoGate;

      if (!photoGate.allowed) {
        const altLine =
          isPatientPhotoStageAwareSubmitEnabled() && photoGate.stageAwareEvaluated
            ? ` Or ${PATIENT_ALTERNATE_OUTCOME_SUBMIT_HINT}`
            : "";
        return NextResponse.json(
          {
            error: `Upload required patient photos first (Current Front, Top, Donor rear).${altLine} Go to Step 2: Add your photos.`,
          },
          { status: 400 }
        );
      }
    }
    if (submitterType === "doctor" && !canSubmit("doctor", photosForEvidence)) {
      return NextResponse.json(
        { error: "Upload required clinical evidence photos before submission." },
        { status: 400 }
      );
    }
    if (submitterType === "clinic" && !canSubmit("clinic", photosForEvidence)) {
      return NextResponse.json(
        { error: "Upload required clinic evidence photos before submission (same categories as doctor audit)." },
        { status: 400 }
      );
    }

    if (!process.env.INNGEST_EVENT_KEY) {
      console.error("[submit] INNGEST_EVENT_KEY is not set; audit will not run.");
      return NextResponse.json(
        { error: "Audit pipeline not configured (missing INNGEST_EVENT_KEY). Contact support." },
        { status: 503 }
      );
    }

    const photosForPatientScoring =
      submitterType === "patient" ? buildPhotosForPatientScoring(uploadRows) : photosForEvidence;

    const patientScore =
      submitterType === "patient" ? computeEvidenceScore("patient", photosForPatientScoring) : null;
    const patientConfidence = patientScore ? computeConfidenceLabel(patientScore) : null;
    const patientDetailsBase =
      submitterType === "patient" ? computeEvidenceDetails("patient", photosForPatientScoring) : null;
    const patientDetails =
      patientDetailsBase && patientPhotoGateForMeta
        ? {
            ...patientDetailsBase,
            photo_submit_gate: {
              via_baseline: patientPhotoGateForMeta.viaBaseline,
              via_alternate_outcome: patientPhotoGateForMeta.viaAlternateOutcome,
              stage_aware_evaluated: patientPhotoGateForMeta.stageAwareEvaluated,
              months_since: patientPhotoGateForMeta.monthsSince,
              alternate_keys_required: patientPhotoGateForMeta.alternateKeysRequired,
              alternate_supporting_one_of: patientPhotoGateForMeta.alternateSupportingOneOf,
            },
          }
        : patientDetailsBase;

    let doctorScore: EvidenceScore | null = null;
    let doctorConfidence: string | null = null;
    const doctorPhotos = uploadRows.filter((p) => String(p.type ?? "").startsWith("doctor_photo:"));
    if (doctorPhotos.length > 0 || submitterType === "doctor") {
      const score: EvidenceScore = computeEvidenceScore("doctor", doctorPhotos);
      doctorScore = score;
      doctorConfidence = computeConfidenceLabel(score);
    }

    let clinicScore: EvidenceScore | null = null;
    let clinicConfidence: string | null = null;
    const clinicPhotos = uploadRows.filter((p) => String(p.type ?? "").startsWith("clinic_photo:"));
    if (clinicPhotos.length > 0 || submitterType === "clinic") {
      const score: EvidenceScore = computeEvidenceScore("clinic", clinicPhotos);
      clinicScore = score;
      clinicConfidence = computeConfidenceLabel(score);
    }

    const evidenceDetails: Record<string, unknown> = {
      ...(patientDetails ? { patient: patientDetails } : {}),
      ...(doctorScore && {
        doctor: computeEvidenceDetails("doctor", doctorPhotos),
      }),
      ...(clinicScore && {
        clinic: computeEvidenceDetails("clinic", clinicPhotos),
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
      submission_channel:
        c.audit_type === "clinic"
          ? "clinic_submitted"
          : c.audit_type === "doctor"
            ? "doctor_submitted"
            : "patient_submitted",
    };

    const { error: updErr } = await admin
      .from("cases")
      .update(updatePayload)
      .eq("id", caseId)
      .in("status", ["draft", "audit_failed"]);

    if (updErr) {
      if (String(updErr.message || "").includes("evidence") || String(updErr.message || "").includes("does not exist")) {
        const { error: fallbackErr } = await admin
          .from("cases")
          .update({
            status: "submitted",
            submitted_at: now,
            submission_channel:
              c.audit_type === "clinic"
                ? "clinic_submitted"
                : c.audit_type === "doctor"
                  ? "doctor_submitted"
                  : "patient_submitted",
          })
          .eq("id", caseId)
          .in("status", ["draft", "audit_failed"]);
        if (fallbackErr) return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
      } else {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    }

    try {
      await inngest.send({
        name: "case/submitted",
        data: { caseId, userId: user.id },
      });
    } catch (sendErr: unknown) {
      console.error("[submit] inngest.send failed:", sendErr);
      return NextResponse.json(
        { error: "Case submitted but audit could not be started. Please try again or contact support." },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, submitted_at: now });
  } catch (e: any) {
    console.error("submit-case error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}