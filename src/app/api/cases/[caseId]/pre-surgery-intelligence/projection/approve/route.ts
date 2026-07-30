/**
 * HA-PRE-SURGERY-INTELLIGENCE-2B — Approve / reject illustrative projections.
 * Patients never see projections until status === approved.
 */

import { NextResponse } from "next/server";
import { requirePreSurgeryClinicianAccess } from "@/lib/preSurgeryIntelligence/access.server";
import {
  approveIllustrativeProjection,
  createAuditEvent,
  rejectIllustrativeProjection,
} from "@/lib/preSurgeryIntelligence";
import {
  insertAuditEvent,
  loadWorkspaceBundle,
  updateProjectionRow,
} from "@/lib/preSurgeryIntelligence/repository.server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const gate = await requirePreSurgeryClinicianAccess(caseId);
    if (!gate.ok) return gate.response;
    const { admin, user } = gate.data;

    const body = (await req.json()) as {
      projectionId?: string;
      action?: "approve" | "reject";
      reason?: string;
    };

    if (!body.projectionId || (body.action !== "approve" && body.action !== "reject")) {
      return NextResponse.json({ ok: false, error: "projectionId and action required" }, { status: 400 });
    }

    const bundle = await loadWorkspaceBundle(admin, caseId);
    const existing = bundle.projections.find((p) => p.id === body.projectionId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Projection not found" }, { status: 404 });
    }

    if (body.action === "approve") {
      const approved = approveIllustrativeProjection(existing, user.id);
      if ("error" in approved) {
        return NextResponse.json({ ok: false, error: approved.error }, { status: 400 });
      }
      await updateProjectionRow(admin, approved);
      await insertAuditEvent(
        admin,
        createAuditEvent({
          caseId,
          eventType: "projection_approved",
          actorId: user.id,
          metadata: {
            projectionId: approved.id,
            mode: approved.mode,
            graftPlanId: approved.graftPlanId,
            graftPlanVersion: approved.graftPlanVersion,
          },
        })
      );
      return NextResponse.json({ ok: true, projection: approved });
    }

    const rejected = rejectIllustrativeProjection(
      existing,
      user.id,
      String(body.reason ?? "Rejected by clinician").slice(0, 500)
    );
    await updateProjectionRow(admin, rejected);
    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType: "projection_rejected",
        actorId: user.id,
        metadata: { projectionId: rejected.id, mode: rejected.mode },
      })
    );
    return NextResponse.json({ ok: true, projection: rejected });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
