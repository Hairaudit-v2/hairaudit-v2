/**
 * HA-PRE-SURGERY-INTELLIGENCE-2D — Projection operations dashboard for auditors.
 */

import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildProjectionOpsDashboard,
  checkProjectionProviderHealth,
  resolveProjectionActivationControls,
  resolveRuntimeProjectionProvider,
} from "@/lib/preSurgeryIntelligence";
import type { PreSurgeryIllustrativeProjection } from "@/lib/preSurgeryIntelligence/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = String(profile?.role ?? "");
    if (role !== "auditor" && role !== "admin") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    const { data: rows, error } = await admin
      .from("hairaudit_pre_surgery_projections")
      .select("payload")
      .order("requested_at", { ascending: false })
      .limit(500);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const projections = (rows ?? [])
      .map((r) => r.payload as PreSurgeryIllustrativeProjection | null)
      .filter((p): p is PreSurgeryIllustrativeProjection => Boolean(p));

    const controls = resolveProjectionActivationControls();
    const runtime = resolveRuntimeProjectionProvider();
    const health = await checkProjectionProviderHealth(runtime.provider, runtime.providerId);

    const staleApprovedCaseIds = projections
      .filter((p) => p.status === "approved" && Boolean(p.staleAt))
      .map((p) => p.caseId);

    const dashboard = buildProjectionOpsDashboard({
      projections,
      samples: [],
      providerHealth: health,
      staleApprovedCaseIds,
      shadowModeActive: controls.shadowMode,
      patientSharingKillSwitch: controls.patientSharingKillSwitch,
      providerKillSwitch: controls.providerKillSwitch || runtime.disabled,
    });

    return NextResponse.json({
      ok: true,
      dashboard,
      providerKind: runtime.disabled
        ? "disabled"
        : runtime.providerId.startsWith("imagingos")
          ? "imagingos"
          : "stub",
      imagingOsEnabled: controls.imagingOsEnabled,
      releaseStage: controls.releaseStage,
      note: "Production should keep HA_PRE_SURGERY_PROJECTION_PROVIDER=stub until a controlled 2D pilot.",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
