/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — Resolve storage paths for patient web report imagery.
 * Returns case-scoped paths only; client signs via /api/uploads/signed-url.
 * Never returns permanent public URLs. Auditor corrections are never included.
 */

import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolveIllustrativeProjectionMediaPaths } from "@/lib/preSurgeryIntelligence/reportProjectionMedia.server";
import { evaluatePatientProjectionVisibility } from "@/lib/preSurgeryIntelligence";
import type { IllustrativeProjectedResultSection } from "@/lib/preSurgeryIntelligence/reportProjectionInclusion";
import type { PreSurgeryGraftPlan } from "@/lib/preSurgeryIntelligence/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const supabase = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: caseRow } = await admin
      .from("cases")
      .select("id, user_id, patient_id, doctor_id, clinic_id, patient_review_pathway")
      .eq("id", caseId)
      .maybeSingle();
    if (!caseRow || !(await canAccessCase(user.id, caseRow))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    if (caseRow.patient_review_pathway !== "pre_surgery") {
      return NextResponse.json({ ok: false, error: "Not a pre-surgery case" }, { status: 400 });
    }

    const url = new URL(req.url);
    const projectionId = url.searchParams.get("projectionId");
    if (!projectionId) {
      return NextResponse.json({ ok: false, error: "Missing projectionId" }, { status: 400 });
    }

    // Load latest report slice pin if present — still verify projection belongs to case.
    const { data: report } = await admin
      .from("reports")
      .select("summary, version")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const summary = (report?.summary ?? {}) as Record<string, unknown>;
    const preReport = summary.pre_surgery_planning_report as
      | { illustrativeProjectedResult?: IllustrativeProjectedResultSection }
      | undefined;
    const section = preReport?.illustrativeProjectedResult;
    if (
      !section?.showImagery ||
      section.projectionSnapshotId !== projectionId
    ) {
      return NextResponse.json({ ok: false, error: "Projection not included in report" }, { status: 404 });
    }

    const { data: uploads } = await admin
      .from("uploads")
      .select("id, storage_path")
      .eq("case_id", caseId);
    const uploadPathById: Record<string, string | null> = {};
    for (const u of uploads ?? []) {
      uploadPathById[String(u.id)] = u.storage_path ? String(u.storage_path) : null;
    }

    const paths = await resolveIllustrativeProjectionMediaPaths({
      admin,
      caseId,
      section,
      uploadPathById,
    });

    if (!paths.projection) {
      return NextResponse.json({ ok: false, error: "Projection not found" }, { status: 404 });
    }

    const { data: planRows } = await admin
      .from("hairaudit_pre_surgery_graft_plans")
      .select("payload")
      .eq("case_id", caseId)
      .eq("status", "approved")
      .order("version", { ascending: false })
      .limit(1);
    const currentApprovedPlan =
      (planRows?.[0]?.payload as PreSurgeryGraftPlan | undefined) ?? null;

    const visibility = evaluatePatientProjectionVisibility({
      projection: paths.projection,
      currentApprovedPlan,
      expectedProjectionId: projectionId,
    });
    // Historical report pins remain readable even if later stale — only when report still pin-matches.
    const allowHistoricalPin =
      section.projectionSnapshotId === projectionId && paths.projection.status === "approved";
    if (!visibility.visible && !allowHistoricalPin) {
      return NextResponse.json({ ok: false, error: "Not shareable" }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      projectionId,
      sourceStoragePath: paths.sourceStoragePath,
      projectedStoragePath: paths.projectedStoragePath,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
