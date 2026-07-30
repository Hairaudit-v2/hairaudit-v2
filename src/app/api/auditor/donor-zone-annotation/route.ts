import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { normalizedPatientAnswersFromReportRow } from "@/lib/patient/answersFromReportRow";
import {
  buildAutomatedDonorZoneAnnotation,
  confirmDonorZoneAnnotation,
  correctDonorZoneAnnotation,
  createDonorZoneAnnotationItem,
  deleteDonorZoneAnnotation,
  isDonorZoneAnnotationRecord,
  isDonorZoneId,
  isDonorZoneIntensity,
  isDonorZoneView,
  resolveDonorZoneAnnotationForReport,
  toPatientSafeDonorZoneAnnotationSlice,
  upsertDonorZoneAnnotation,
  type DonorZoneAnnotationRecord,
  type DonorZoneGeometryType,
  type DonorZoneId,
  type DonorZoneIntensity,
  type DonorZoneView,
} from "@/lib/patient/donorZoneAnnotation";
import type { NormalisedPoint } from "@/lib/preSurgeryIntelligence/types";

export const runtime = "nodejs";

type Action =
  | "prepare"
  | "confirm"
  | "correct"
  | "upsert-annotation"
  | "delete-annotation";

/**
 * HA-DONOR-HEALING-1D — auditor donor zone annotation controls.
 * Writes reports.summary.donor_zone_annotation with immutable snapshots on confirm/correct.
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
      annotationId?: string;
      uploadId?: string;
      categoryKey?: string;
      view?: string;
      zoneId?: string;
      intensity?: string;
      geometryType?: string;
      coordinates?: NormalisedPoint[];
      note?: string | null;
      annotationItemId?: string;
    } | null;

    const reportId = String(body?.reportId ?? "").trim();
    const action = String(body?.action ?? "").trim() as Action;
    if (!reportId) {
      return NextResponse.json({ ok: false, error: "Missing reportId" }, { status: 400 });
    }
    if (
      !["prepare", "confirm", "correct", "upsert-annotation", "delete-annotation"].includes(
        action
      )
    ) {
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

    let nextRecord: DonorZoneAnnotationRecord | null = null;

    const existing = isDonorZoneAnnotationRecord(summary.donor_zone_annotation)
      ? summary.donor_zone_annotation
      : resolveDonorZoneAnnotationForReport({
          answers,
          summary,
          stored: summary.donor_zone_annotation,
        });

    if (action === "prepare") {
      nextRecord =
        resolveDonorZoneAnnotationForReport({
          answers,
          summary,
          stored: summary.donor_zone_annotation,
        }) ??
        buildAutomatedDonorZoneAnnotation({
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
      if (!isClinicianLocked(nextRecord)) {
        nextRecord =
          buildAutomatedDonorZoneAnnotation({
            answers: {
              ...(answers ?? {}),
              entry_context: "donor_healing",
              primary_donor_concern: "donor_healing",
            },
            summary: { ...summary, entry_context: "donor_healing" },
            existingAnnotations: nextRecord.annotations,
          }) ?? nextRecord;
      }
    } else {
      if (!existing) {
        return NextResponse.json(
          { ok: false, error: "No donor zone annotation available" },
          { status: 400 }
        );
      }

      if (action === "confirm") {
        nextRecord = confirmDonorZoneAnnotation(existing, { actorUserId: user.id });
      } else if (action === "correct") {
        nextRecord = correctDonorZoneAnnotation(existing, { actorUserId: user.id });
      } else if (action === "delete-annotation") {
        const annotationId = String(body?.annotationId ?? "").trim();
        if (!annotationId) {
          return NextResponse.json(
            { ok: false, error: "Missing annotationId" },
            { status: 400 }
          );
        }
        nextRecord = deleteDonorZoneAnnotation(existing, annotationId);
      } else {
        // upsert-annotation
        const zoneId = String(body?.zoneId ?? "").trim();
        const intensity = String(body?.intensity ?? "").trim();
        const uploadId = String(body?.uploadId ?? "").trim();
        const categoryKey = String(body?.categoryKey ?? "").trim();
        const coordinates = Array.isArray(body?.coordinates) ? body!.coordinates! : [];
        if (!isDonorZoneId(zoneId) || !isDonorZoneIntensity(intensity)) {
          return NextResponse.json(
            { ok: false, error: "Invalid zoneId or intensity" },
            { status: 400 }
          );
        }
        if (!uploadId || !categoryKey) {
          return NextResponse.json(
            { ok: false, error: "Missing uploadId or categoryKey" },
            { status: 400 }
          );
        }
        try {
          const item = createDonorZoneAnnotationItem({
            id: body?.annotationItemId ? String(body.annotationItemId) : undefined,
            uploadId,
            categoryKey,
            view: isDonorZoneView(body?.view) ? (body!.view as DonorZoneView) : null,
            zoneId: zoneId as DonorZoneId,
            intensity: intensity as DonorZoneIntensity,
            geometryType: (body?.geometryType as DonorZoneGeometryType) || "polygon",
            coordinates,
            note: body?.note ?? null,
          });
          nextRecord = upsertDonorZoneAnnotation(existing, item);
        } catch (e) {
          return NextResponse.json(
            { ok: false, error: e instanceof Error ? e.message : "Invalid annotation" },
            { status: 400 }
          );
        }
      }
    }

    const patientSlice = toPatientSafeDonorZoneAnnotationSlice(nextRecord);
    const storedReport = summary.post_surgery_audit_report;
    const nextSummary: Record<string, unknown> = {
      ...summary,
      donor_zone_annotation: nextRecord,
      ...(storedReport && typeof storedReport === "object"
        ? {
            post_surgery_audit_report: {
              ...(storedReport as Record<string, unknown>),
              donorZoneAnnotation: patientSlice,
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
      annotation: {
        annotationCount: nextRecord.annotations.length,
        summaryCount: nextRecord.heatmapSummaries.length,
        provenanceSource: nextRecord.provenance.source,
        confirmedAt: nextRecord.provenance.confirmedAt ?? null,
        snapshotCount: nextRecord.snapshots.length,
        patientVisible: patientSlice != null,
      },
      record: nextRecord,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function isClinicianLocked(record: DonorZoneAnnotationRecord): boolean {
  return (
    record.provenance.source === "clinician_confirmation" ||
    record.provenance.source === "clinician_correction"
  );
}
