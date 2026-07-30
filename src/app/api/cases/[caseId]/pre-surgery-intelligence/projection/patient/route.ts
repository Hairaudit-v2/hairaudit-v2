/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Patient-visible illustrative projection gate.
 * Patients only receive approved + sharing-enabled projections with safety framing.
 */

import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import {
  evaluatePatientProjectionVisibility,
  PATIENT_PROJECTION_FRAMING,
} from "@/lib/preSurgeryIntelligence";
import type {
  PreSurgeryGraftPlan,
  PreSurgeryIllustrativeProjection,
} from "@/lib/preSurgeryIntelligence/types";

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
      .select("id, user_id, patient_id, doctor_id, clinic_id")
      .eq("id", caseId)
      .maybeSingle();
    if (!caseRow || !(await canAccessCase(user.id, caseRow))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const projectionId = url.searchParams.get("projectionId");

    const { data: planRows } = await admin
      .from("hairaudit_pre_surgery_graft_plans")
      .select("payload")
      .eq("case_id", caseId)
      .eq("status", "approved")
      .order("version", { ascending: false })
      .limit(1);
    const currentApprovedPlan =
      (planRows?.[0]?.payload as PreSurgeryGraftPlan | undefined) ?? null;

    let query = admin
      .from("hairaudit_pre_surgery_projections")
      .select("payload")
      .eq("case_id", caseId)
      .eq("status", "approved");
    if (projectionId) query = query.eq("id", projectionId);

    const { data: rows } = await query.order("requested_at", { ascending: false }).limit(5);
    const projections = (rows ?? []).map((r) => r.payload as PreSurgeryIllustrativeProjection);

    const visible = [];
    for (const p of projections) {
      const decision = evaluatePatientProjectionVisibility({
        projection: p,
        currentApprovedPlan,
        expectedProjectionId: projectionId,
      });
      if (!decision.visible) continue;
      // Never return storage paths or provider internals to patients.
      visible.push({
        projectionId: decision.projectionId,
        projectionVersion: decision.projectionVersion,
        label: decision.label,
        disclaimer: decision.disclaimer,
        framing: decision.framing,
        mode: p.mode,
        illustrative: true,
      });
    }

    if (projectionId && visible.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Projection is not available for patient viewing",
          framing: PATIENT_PROJECTION_FRAMING,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      projections: visible,
      framing: PATIENT_PROJECTION_FRAMING,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
