import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashContributionToken } from "@/lib/transparency/contributionTokens";
import { inngest } from "@/lib/inngest/client";
import { refreshClinicTransparencyMetrics, refreshDoctorTransparencyMetrics } from "@/lib/transparency/program";
import { markContributionReceived } from "@/lib/transparency/requestLifecycle";

function asText(v: unknown) {
  return String(v ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = asText(body?.token);
    if (!token) return NextResponse.json({ error: "Missing contribution token." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const tokenHash = hashContributionToken(token);

    const { data: requestRow } = await admin
      .from("case_contribution_requests")
      .select("id, case_id, status, secure_token_expires_at, clinic_profile_id, doctor_profile_id")
      .eq("secure_token_hash", tokenHash)
      .maybeSingle();

    if (!requestRow) return NextResponse.json({ error: "Invalid token." }, { status: 404 });
    if (requestRow.secure_token_expires_at && new Date(requestRow.secure_token_expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Contribution token expired." }, { status: 410 });
    }

    await admin
      .from("case_contribution_requests")
      .update({
        status: "doctor_contribution_started",
        contribution_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestRow.id);
    await inngest.send({
      name: "contribution-request/contribution-started",
      data: {
        requestId: requestRow.id,
        caseId: requestRow.case_id,
        currentStatus: "doctor_contribution_started",
        startedAt: new Date().toISOString(),
      },
    });

    const contributionPayload = {
      planning_details: asText(body?.planningDetails),
      donor_mapping_details: asText(body?.donorMappingDetails),
      graft_handling_details: asText(body?.graftHandlingDetails),
      implantation_details: asText(body?.implantationDetails),
      verification_fields: asText(body?.verificationFields),
      submitted_at: new Date().toISOString(),
    };
    const contributionImages = Array.isArray(body?.optionalImages)
      ? body.optionalImages.map((x: unknown) => String(x ?? "").trim()).filter(Boolean)
      : [];

    await markContributionReceived(admin, requestRow.id);
    await admin
      .from("case_contribution_requests")
      .update({
        contribution_payload: contributionPayload,
        contribution_images: contributionImages,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestRow.id);
    await admin.from("cases").update({ status: "doctor_contribution_received" }).eq("id", requestRow.case_id);
    await inngest.send({
      name: "contribution-request/contribution-received",
      data: {
        requestId: requestRow.id,
        caseId: requestRow.case_id,
        currentStatus: "doctor_contribution_received",
        receivedAt: new Date().toISOString(),
      },
    });

    const { data: latest } = await admin
      .from("reports")
      .select("id, summary, version")
      .eq("case_id", requestRow.case_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentSummary = (latest?.summary ?? {}) as Record<string, unknown>;
    const clinicAnswers = {
      ...((currentSummary.clinic_answers as Record<string, unknown> | undefined) ?? {}),
      contribution_portal: contributionPayload,
      contribution_images: contributionImages,
    };
    if (latest?.id) {
      await admin.from("reports").update({ summary: { ...currentSummary, clinic_answers: clinicAnswers } }).eq("id", latest.id);
    } else {
      await admin.from("reports").insert({
        case_id: requestRow.case_id,
        version: 1,
        pdf_path: "",
        summary: { clinic_answers: clinicAnswers },
      });
    }

    await admin
      .from("case_contribution_requests")
      .update({ status: "benchmark_recalculated", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", requestRow.id);
    await admin.from("cases").update({ status: "benchmark_recalculated" }).eq("id", requestRow.case_id);
    await inngest.send({
      name: "contribution-request/closed",
      data: {
        requestId: requestRow.id,
        caseId: requestRow.case_id,
        currentStatus: "benchmark_recalculated",
        closedAt: new Date().toISOString(),
        reason: "contribution_processed",
      },
    });

    const { data: caseOwner } = await admin.from("cases").select("user_id, patient_id").eq("id", requestRow.case_id).maybeSingle();
    const userId = String(caseOwner?.user_id ?? caseOwner?.patient_id ?? "");
    if (userId) {
      await inngest.send({
        name: "case/audit-only-requested",
        data: { caseId: requestRow.case_id, userId },
      });
    }

    const { data: refreshedReports } = await admin
      .from("reports")
      .select("summary, version")
      .eq("case_id", requestRow.case_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const benchmarkEligible = Boolean(
      (refreshedReports?.summary as Record<string, unknown> | undefined)?.forensic_audit &&
        (((refreshedReports?.summary as Record<string, unknown>).forensic_audit as Record<string, unknown>)?.benchmark as
          | Record<string, unknown>
          | undefined)?.eligible
    );
    if (benchmarkEligible) {
      await admin
        .from("case_contribution_requests")
        .update({ status: "benchmark_eligible", updated_at: new Date().toISOString() })
        .eq("id", requestRow.id);
      await admin.from("cases").update({ status: "benchmark_eligible" }).eq("id", requestRow.case_id);
    }

    if (requestRow.clinic_profile_id) {
      await refreshClinicTransparencyMetrics(admin, requestRow.clinic_profile_id);
    }
    if (requestRow.doctor_profile_id) {
      await refreshDoctorTransparencyMetrics(admin, requestRow.doctor_profile_id);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const errMsg = (e as Error)?.message ?? "Server error";
    console.error("contribution-portal/submit POST:", errMsg, e);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
