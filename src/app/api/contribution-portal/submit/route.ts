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

    const asNum = (v: unknown) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined);
    const asArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];

    const contributionPayload: Record<string, unknown> = {
      planning_details: asText(body?.planningDetails),
      donor_mapping_details: asText(body?.donorMappingDetails),
      graft_handling_details: asText(body?.graftHandlingDetails),
      implantation_details: asText(body?.implantationDetails),
      verification_fields: asText(body?.verificationFields),
      submitted_at: new Date().toISOString(),
    };

    // Structured fields (optional) — improve audit quality and completeness scoring
    if (body?.procedureType != null && asText(body.procedureType)) contributionPayload.procedure_type = asText(body.procedureType);
    if (body?.repairCaseFlag != null && asText(body.repairCaseFlag)) contributionPayload.repair_case_flag = asText(body.repairCaseFlag);
    if (body?.graftCountRange != null && asText(body.graftCountRange)) contributionPayload.graft_count_range = asText(body.graftCountRange);
    const planned = asNum(body?.plannedGraftCount);
    if (planned != null && !Number.isNaN(planned)) contributionPayload.planned_graft_count = planned;
    const actual = asNum(body?.actualGraftCount);
    if (actual != null && !Number.isNaN(actual)) contributionPayload.actual_graft_count = actual;
    if (body?.futureLossPlanning != null && asText(body.futureLossPlanning)) contributionPayload.future_loss_planning = asText(body.futureLossPlanning);
    if (body?.extractionMethod != null && asText(body.extractionMethod)) contributionPayload.extraction_method = asText(body.extractionMethod);
    if (body?.primaryExtractionDevice != null && asText(body.primaryExtractionDevice)) contributionPayload.primary_extraction_device = asText(body.primaryExtractionDevice);
    const punchSizes = asArr(body?.punchSizesUsed);
    if (punchSizes.length) contributionPayload.punch_sizes_used = punchSizes;
    if (body?.donorQualityRating != null && asText(body.donorQualityRating)) contributionPayload.donor_quality_rating = asText(body.donorQualityRating);
    if (body?.safeDonorZoneAssessed != null && asText(body.safeDonorZoneAssessed)) contributionPayload.safe_donor_zone_assessed = asText(body.safeDonorZoneAssessed);
    if (body?.primaryHoldingSolution != null && asText(body.primaryHoldingSolution)) contributionPayload.primary_holding_solution = asText(body.primaryHoldingSolution);
    if (body?.sortingPerformed != null && asText(body.sortingPerformed)) contributionPayload.sorting_performed = asText(body.sortingPerformed);
    if (body?.graftsKeptHydrated != null && asText(body.graftsKeptHydrated)) contributionPayload.grafts_kept_hydrated = asText(body.graftsKeptHydrated);
    if (body?.outOfBodyTimeCategory != null && asText(body.outOfBodyTimeCategory)) contributionPayload.out_of_body_time_category = asText(body.outOfBodyTimeCategory);
    if (body?.implantationMethod != null && asText(body.implantationMethod)) contributionPayload.implantation_method = asText(body.implantationMethod);
    if (body?.implantedBy != null && asText(body.implantedBy)) contributionPayload.implanted_by = asText(body.implantedBy);
    if (body?.densePackingAttempted != null && asText(body.densePackingAttempted)) contributionPayload.dense_packing_attempted = asText(body.densePackingAttempted);
    if (body?.siteCreationMethod != null && asText(body.siteCreationMethod)) contributionPayload.site_creation_method = asText(body.siteCreationMethod);
    if (body?.implantationDevice != null && asText(body.implantationDevice)) contributionPayload.primary_implantation_device = asText(body.implantationDevice);
    if (body?.documentationLevel != null && asText(body.documentationLevel)) contributionPayload.documentation_level = asText(body.documentationLevel);
    if (body?.graftCountVerification != null && asText(body.graftCountVerification)) contributionPayload.graft_count_verification = asText(body.graftCountVerification);
    if (body?.discrepancyDetected != null && asText(body.discrepancyDetected)) contributionPayload.discrepancy_detected = asText(body.discrepancyDetected);
    if (body?.confidenceLevel != null && asText(body.confidenceLevel)) contributionPayload.confidence_level = asText(body.confidenceLevel);
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
