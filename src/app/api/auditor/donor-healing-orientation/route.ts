import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import {
  buildAutomatedDonorHealingOrientation,
  confirmDonorHealingOrientation,
  correctDonorHealingOrientation,
  isDonorHealingOrientation,
  isDonorHealingOrientationRecord,
  resolveDonorHealingOrientationForReport,
  toPatientSafeDonorOrientationSlice,
  type DonorHealingOrientationRecord,
} from "@/lib/patient/donorHealingOrientationReport";
import { normalizedPatientAnswersFromReportRow } from "@/lib/patient/answersFromReportRow";
import type { DonorHealingOrientation } from "@/lib/patient/donorHealingEntry";

export const runtime = "nodejs";

type Action = "confirm" | "correct" | "prepare";

/**
 * HA-DONOR-HEALING-1B — auditor confirmation / correction of donor orientation.
 * Writes immutable provenance onto reports.summary.donor_healing_orientation
 * and refreshes the patient-safe slice on post_surgery_audit_report.
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
      uploadTypes?: string[];
    } | null;

    const reportId = String(body?.reportId ?? "").trim();
    const action = String(body?.action ?? "").trim() as Action;
    if (!reportId) {
      return NextResponse.json({ ok: false, error: "Missing reportId" }, { status: 400 });
    }
    if (!["confirm", "correct", "prepare"].includes(action)) {
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
    const uploadTypes = Array.isArray(body?.uploadTypes)
      ? body!.uploadTypes!.map((t) => String(t))
      : [];

    let nextRecord: DonorHealingOrientationRecord | null = null;

    if (action === "prepare") {
      nextRecord =
        resolveDonorHealingOrientationForReport({
          answers,
          summary,
          uploadTypes,
          stored: summary.donor_healing_orientation,
        }) ??
        buildAutomatedDonorHealingOrientation({
          answers: {
            ...(answers ?? {}),
            entry_context: "donor_healing",
            primary_donor_concern: "donor_healing",
          },
          summary: { ...summary, entry_context: "donor_healing" },
          uploadTypes,
        });
      if (!nextRecord) {
        return NextResponse.json(
          { ok: false, error: "Donor healing entry context not present on this case" },
          { status: 400 }
        );
      }
    } else {
      const existing = isDonorHealingOrientationRecord(summary.donor_healing_orientation)
        ? summary.donor_healing_orientation
        : resolveDonorHealingOrientationForReport({
            answers,
            summary,
            uploadTypes,
            stored: summary.donor_healing_orientation,
          });

      if (!existing) {
        return NextResponse.json(
          { ok: false, error: "No donor orientation available to review" },
          { status: 400 }
        );
      }

      if (action === "confirm") {
        nextRecord = confirmDonorHealingOrientation(existing, { actorUserId: user.id });
      } else {
        const nextState = String(body?.nextState ?? "").trim();
        if (!isDonorHealingOrientation(nextState)) {
          return NextResponse.json(
            { ok: false, error: "Invalid nextState — must be an approved orientation" },
            { status: 400 }
          );
        }
        nextRecord = correctDonorHealingOrientation(existing, {
          nextState: nextState as DonorHealingOrientation,
          actorUserId: user.id,
        });
      }
    }

    const patientSlice = toPatientSafeDonorOrientationSlice(nextRecord);
    const storedReport = summary.post_surgery_audit_report;
    const nextSummary: Record<string, unknown> = {
      ...summary,
      donor_healing_orientation: nextRecord,
      ...(storedReport && typeof storedReport === "object"
        ? {
            post_surgery_audit_report: {
              ...(storedReport as Record<string, unknown>),
              donorHealingOrientation: patientSlice,
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
      orientation: {
        state: nextRecord.state,
        patientLabel: nextRecord.patientLabel,
        provenanceSource: nextRecord.provenance.source,
        confirmedAt: nextRecord.provenance.confirmedAt ?? null,
        historyLength: nextRecord.provenance.history.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
