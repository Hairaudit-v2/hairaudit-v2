import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { normalizedPatientAnswersFromReportRow } from "@/lib/patient/answersFromReportRow";
import {
  buildAutomatedDonorCapacityPlan,
  confirmDonorCapacityPlan,
  correctDonorCapacityPlan,
  isDonorCapacityPlanRecord,
  isDonorCapacityPlanState,
  resolveDonorCapacityPlanForReport,
  toPatientSafeDonorCapacityPlanSlice,
  upsertDonorCapacityMeasurements,
  type DonorCapacityPlanRecord,
  type DonorCapacityPlanState,
} from "@/lib/patient/donorCapacityPlan";
import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";

export const runtime = "nodejs";

type Action = "prepare" | "confirm" | "correct" | "upsert-measurements";

/**
 * HA-DONOR-HEALING-1E — auditor donor capacity planning controls.
 * Writes reports.summary.donor_capacity_plan with immutable snapshots on confirm/correct.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as {
      reportId?: string;
      action?: string;
      nextState?: string;
      densityCm2?: number | null;
      graftsRemoved?: number | null;
      punchSizeMm?: number | null;
      estimatedCapacityOrdinal?: string | null;
      estimatedCapacityNumeric?: number | null;
      safeZoneAssessed?: string | null;
      clinicianInternalNote?: string | null;
      doctorAnswers?: Record<string, unknown>;
      clinicAnswers?: Record<string, unknown>;
      clinicalHistory?: ClinicalHistorySnapshot | null;
    } | null;

    const reportId = String(body?.reportId ?? "").trim();
    const action = String(body?.action ?? "").trim() as Action;
    if (!reportId) {
      return NextResponse.json({ ok: false, error: "Missing reportId" }, { status: 400 });
    }
    if (!["prepare", "confirm", "correct", "upsert-measurements"].includes(action)) {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    const { data: report, error: fetchErr } = await admin
      .from("reports")
      .select("id, case_id, summary, patient_audit_version, patient_audit_v2, version")
      .eq("id", reportId)
      .maybeSingle();
    if (fetchErr) {
      return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });
    }
    if (!report) {
      return NextResponse.json({ ok: false, error: "Report not found" }, { status: 404 });
    }

    const summary = (report.summary ?? {}) as Record<string, unknown>;
    const answers = normalizedPatientAnswersFromReportRow({
      summary,
      patient_audit_version: report.patient_audit_version,
      patient_audit_v2: report.patient_audit_v2 as Record<string, unknown> | null,
    });

    const doctorAnswers =
      body?.doctorAnswers ??
      (isRecord(summary.doctor_answers) ? summary.doctor_answers : null) ??
      {};
    const clinicAnswers =
      body?.clinicAnswers ??
      (isRecord(summary.clinic_answers) ? summary.clinic_answers : null) ??
      {};
    const clinicalHistory =
      body?.clinicalHistory ??
      (isRecord(summary.clinical_history)
        ? (summary.clinical_history as ClinicalHistorySnapshot)
        : null);

    let nextRecord: DonorCapacityPlanRecord | null = null;

    const buildArgs = {
      answers,
      summary,
      doctorAnswers,
      clinicAnswers,
      clinicalHistory,
    };

    if (action === "prepare") {
      nextRecord =
        resolveDonorCapacityPlanForReport({
          ...buildArgs,
          stored: summary.donor_capacity_plan,
        }) ??
        buildAutomatedDonorCapacityPlan({
          ...buildArgs,
          answers: {
            ...(answers ?? {}),
            entry_context: "donor_healing",
            primary_donor_concern: "donor_healing",
          },
          summary: { ...summary, entry_context: "donor_healing" },
        });
      if (!nextRecord) {
        return NextResponse.json(
          { ok: false, error: "Donor healing entry context not present on this case" },
          { status: 400 }
        );
      }
      if (
        nextRecord.provenance.source !== "clinician_confirmation" &&
        nextRecord.provenance.source !== "clinician_correction"
      ) {
        nextRecord =
          buildAutomatedDonorCapacityPlan({
            ...buildArgs,
            answers: {
              ...(answers ?? {}),
              entry_context: "donor_healing",
              primary_donor_concern: "donor_healing",
            },
            summary: { ...summary, entry_context: "donor_healing" },
          }) ?? nextRecord;
      }
    } else {
      const existing = isDonorCapacityPlanRecord(summary.donor_capacity_plan)
        ? summary.donor_capacity_plan
        : resolveDonorCapacityPlanForReport({
            ...buildArgs,
            stored: summary.donor_capacity_plan,
          });

      if (!existing) {
        return NextResponse.json(
          { ok: false, error: "No donor capacity plan available" },
          { status: 400 }
        );
      }

      if (action === "confirm") {
        nextRecord = confirmDonorCapacityPlan(existing, { actorUserId: user.id });
      } else if (action === "upsert-measurements") {
        nextRecord = upsertDonorCapacityMeasurements(existing, {
          densityCm2: body?.densityCm2,
          graftsRemoved: body?.graftsRemoved,
          punchSizeMm: body?.punchSizeMm,
          estimatedCapacityOrdinal: body?.estimatedCapacityOrdinal,
          estimatedCapacityNumeric: body?.estimatedCapacityNumeric,
          safeZoneAssessed: body?.safeZoneAssessed,
          clinicianInternalNote: body?.clinicianInternalNote,
        });
      } else {
        const nextState = String(body?.nextState ?? "").trim();
        if (!isDonorCapacityPlanState(nextState)) {
          return NextResponse.json(
            { ok: false, error: "Invalid nextState — must be an approved planning state" },
            { status: 400 }
          );
        }
        nextRecord = correctDonorCapacityPlan(existing, {
          nextState: nextState as DonorCapacityPlanState,
          actorUserId: user.id,
          clinicianInternalNote: body?.clinicianInternalNote,
        });
      }
    }

    const patientSlice = toPatientSafeDonorCapacityPlanSlice(nextRecord);
    const storedReport = summary.post_surgery_audit_report;
    const nextSummary: Record<string, unknown> = {
      ...summary,
      donor_capacity_plan: nextRecord,
      ...(storedReport && typeof storedReport === "object"
        ? {
            post_surgery_audit_report: {
              ...(storedReport as Record<string, unknown>),
              donorCapacityPlan: patientSlice,
            },
          }
        : {}),
    };

    const { error: updateErr } = await admin
      .from("reports")
      .update({
        summary: nextSummary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      plan: {
        overallState: nextRecord.overallState,
        patientLabel: nextRecord.patientLabel,
        provenanceSource: nextRecord.provenance.source,
        confirmedAt: nextRecord.provenance.confirmedAt ?? null,
        snapshotCount: nextRecord.snapshots.length,
        qualifyingCount: nextRecord.sufficiency.qualifyingCount,
        sufficient: nextRecord.sufficiency.sufficient,
        patientVisible: patientSlice != null,
      },
      record: nextRecord,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
