/**
 * GET /api/patient/cases/[caseId]/guided-capture?stage=month_6
 *
 * FI-OUTCOME-INTELLIGENCE-1E — Patient-safe guided capture DTO.
 * Identity is server-resolved. Consumes canonical 1C plan state only.
 */

import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireCaseAccess,
  requirePatientCaseAccess,
  requireUser,
} from "@/lib/auth/permissions";
import { toPatientSafeApiResponse } from "@/lib/patient/patientTrustStatusTranslator";
import {
  loadGuidedCaptureLanding,
  loadGuidedLongitudinalCapture,
} from "@/lib/outcomeIntelligence/guidedCaptureLoad.server";
import { assertPatientGuidedCaptureDtoSafe } from "@/lib/outcomeIntelligence/guidedCaptureSafety";
import { isGuidedCaptureUiEnabled } from "@/lib/outcomeIntelligence/guidedCaptureConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const { caseId } = await context.params;
    const trimmedCaseId = String(caseId ?? "").trim();
    if (!trimmedCaseId) {
      return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
    }

    const supabase = await createSupabaseAuthServerClient();
    const userGate = await requireUser(supabase);
    if (!userGate.ok) return userGate.response;

    const accessGate = await requireCaseAccess({
      userId: userGate.data.user.id,
      caseId: trimmedCaseId,
      supabaseAuth: supabase,
    });
    if (!accessGate.ok) return accessGate.response;

    const patientGate = requirePatientCaseAccess(
      userGate.data.user.id,
      accessGate.data.case
    );
    if (!patientGate.ok) return patientGate.response;

    const admin = tryCreateSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json(
        toPatientSafeApiResponse("Service temporarily unavailable", "status"),
        { status: 503 }
      );
    }

    const caseRow = accessGate.data.case as {
      id: string;
      patient_id?: string | null;
      user_id?: string | null;
    };
    const patientId = String(
      caseRow.patient_id ?? caseRow.user_id ?? userGate.data.user.id
    );

    const url = new URL(req.url);
    const stage = String(url.searchParams.get("stage") ?? "").trim();
    const projectionSnapshotId = String(
      url.searchParams.get("projectionSnapshotId") ?? ""
    ).trim();

    if (!stage) {
      const landing = await loadGuidedCaptureLanding({
        admin,
        caseId: trimmedCaseId,
        patientId,
        caseRow,
        projectionSnapshotId: projectionSnapshotId || null,
      });
      if (!landing.ok) {
        return NextResponse.json(
          toPatientSafeApiResponse(landing.message, "status"),
          { status: landing.status }
        );
      }
      return NextResponse.json(landing.landing);
    }

    if (!isGuidedCaptureUiEnabled()) {
      // Still return DTO for internal QA when feature off? Spec: default false for
      // production rollout — API remains available for tests; UI pages gate display.
    }

    const loaded = await loadGuidedLongitudinalCapture({
      admin,
      caseId: trimmedCaseId,
      patientId,
      caseRow,
      stage,
      projectionSnapshotId: projectionSnapshotId || null,
    });

    if (!loaded.ok) {
      return NextResponse.json(
        toPatientSafeApiResponse(loaded.message, "status"),
        { status: loaded.status }
      );
    }

    const safety = assertPatientGuidedCaptureDtoSafe(loaded.guided);
    if (!safety.ok) {
      console.error("[guided-capture] DTO safety failed", safety.violations);
      return NextResponse.json(
        toPatientSafeApiResponse("Could not load follow-up capture", "status"),
        { status: 500 }
      );
    }

    return NextResponse.json(loaded.guided);
  } catch (error) {
    const safe = toPatientSafeApiResponse(
      String((error as Error)?.message ?? "Server error"),
      "status"
    );
    return NextResponse.json(safe, { status: 500 });
  }
}
