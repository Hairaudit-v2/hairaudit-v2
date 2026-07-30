import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { normalizedPatientAnswersFromReportRow } from "@/lib/patient/answersFromReportRow";
import {
  buildAutomatedDonorLongitudinalComparison,
  confirmDonorLongitudinalComparison,
  correctDonorLongitudinalComparison,
  isDonorComparabilityLimitation,
  isDonorLongitudinalComparisonRecord,
  isDonorLongitudinalComparisonState,
  resolveDonorLongitudinalComparisonForReport,
  toPatientSafeDonorLongitudinalSlice,
  type DonorComparabilityLimitation,
  type DonorComparisonUploadInput,
  type DonorComparisonView,
  type DonorLongitudinalComparisonRecord,
  type DonorLongitudinalComparisonState,
} from "@/lib/patient/donorLongitudinalComparison";

export const runtime = "nodejs";

type Action = "confirm" | "correct" | "prepare";

/**
 * HA-DONOR-HEALING-1C — auditor confirmation / correction of longitudinal
 * donor comparison. Writes immutable snapshots onto
 * reports.summary.donor_longitudinal_comparison.
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
      limitations?: string[];
      viewStates?: Record<string, string>;
      uploads?: DonorComparisonUploadInput[];
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
    const uploads = Array.isArray(body?.uploads) ? body!.uploads! : null;

    const limitations = Array.isArray(body?.limitations)
      ? body!.limitations!.filter(isDonorComparabilityLimitation)
      : null;

    let nextRecord: DonorLongitudinalComparisonRecord | null = null;

    if (action === "prepare") {
      nextRecord =
        resolveDonorLongitudinalComparisonForReport({
          answers,
          summary,
          uploads,
          uploadTypes,
          limitations,
          stored: summary.donor_longitudinal_comparison,
        }) ??
        buildAutomatedDonorLongitudinalComparison({
          answers: {
            ...(answers ?? {}),
            entry_context: "donor_healing",
            primary_donor_concern: "donor_healing",
          },
          summary: { ...summary, entry_context: "donor_healing" },
          uploads,
          uploadTypes,
          limitations,
        });
      if (!nextRecord) {
        return NextResponse.json(
          { ok: false, error: "Donor healing entry context not present on this case" },
          { status: 400 }
        );
      }
      // Prepare always rebuilds automated draft when not clinician-locked.
      if (
        nextRecord.provenance.source !== "clinician_confirmation" &&
        nextRecord.provenance.source !== "clinician_correction"
      ) {
        nextRecord =
          buildAutomatedDonorLongitudinalComparison({
            answers: {
              ...(answers ?? {}),
              entry_context: "donor_healing",
              primary_donor_concern: "donor_healing",
            },
            summary: { ...summary, entry_context: "donor_healing" },
            uploads,
            uploadTypes,
            limitations,
          }) ?? nextRecord;
      }
    } else {
      const existing = isDonorLongitudinalComparisonRecord(
        summary.donor_longitudinal_comparison
      )
        ? summary.donor_longitudinal_comparison
        : resolveDonorLongitudinalComparisonForReport({
            answers,
            summary,
            uploads,
            uploadTypes,
            limitations,
            stored: summary.donor_longitudinal_comparison,
          });

      if (!existing) {
        return NextResponse.json(
          { ok: false, error: "No donor longitudinal comparison available to review" },
          { status: 400 }
        );
      }

      if (action === "confirm") {
        nextRecord = confirmDonorLongitudinalComparison(existing, {
          actorUserId: user.id,
        });
      } else {
        const nextState = String(body?.nextState ?? "").trim();
        if (!isDonorLongitudinalComparisonState(nextState)) {
          return NextResponse.json(
            {
              ok: false,
              error: "Invalid nextState — must be an approved comparison state",
            },
            { status: 400 }
          );
        }
        const viewStatesRaw = body?.viewStates ?? null;
        const viewStates: Partial<
          Record<DonorComparisonView, DonorLongitudinalComparisonState>
        > = {};
        if (viewStatesRaw && typeof viewStatesRaw === "object") {
          for (const [k, v] of Object.entries(viewStatesRaw)) {
            if (
              (k === "rear" || k === "left" || k === "right") &&
              isDonorLongitudinalComparisonState(v)
            ) {
              viewStates[k] = v;
            }
          }
        }
        nextRecord = correctDonorLongitudinalComparison(existing, {
          nextState: nextState as DonorLongitudinalComparisonState,
          actorUserId: user.id,
          limitations: limitations as DonorComparabilityLimitation[] | null,
          viewStates: Object.keys(viewStates).length ? viewStates : null,
        });
      }
    }

    const patientSlice = toPatientSafeDonorLongitudinalSlice(nextRecord);
    const storedReport = summary.post_surgery_audit_report;
    const nextSummary: Record<string, unknown> = {
      ...summary,
      donor_longitudinal_comparison: nextRecord,
      ...(storedReport && typeof storedReport === "object"
        ? {
            post_surgery_audit_report: {
              ...(storedReport as Record<string, unknown>),
              donorLongitudinalComparison: patientSlice,
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
      comparison: {
        overallState: nextRecord.overallState,
        patientLabel: nextRecord.patientLabel,
        provenanceSource: nextRecord.provenance.source,
        confirmedAt: nextRecord.provenance.confirmedAt ?? null,
        historyLength: nextRecord.provenance.history.length,
        snapshotCount: nextRecord.snapshots.length,
        setCount: nextRecord.sets.length,
        pairCount: nextRecord.pairs.length,
        limitations: nextRecord.comparability.limitations,
        scoreBand: nextRecord.comparability.scoreBand,
        patientVisible: patientSlice != null,
      },
      record: nextRecord,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
