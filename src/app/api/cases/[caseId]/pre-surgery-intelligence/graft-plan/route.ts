/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Graft plan edit / approve.
 * 2B: optimistic concurrency — no silent overwrites on stale base versions.
 */

import { NextResponse } from "next/server";
import { requirePreSurgeryClinicianAccess } from "@/lib/preSurgeryIntelligence/access.server";
import {
  buildPlanComparisonView,
  createAuditEvent,
  createClinicianPlanRevision,
  resolveGraftPlanBaseForEdit,
  validateGraftPlan,
} from "@/lib/preSurgeryIntelligence";
import type { PreSurgeryGraftPlan, PreSurgeryGraftPlanZoneRow } from "@/lib/preSurgeryIntelligence/types";
import {
  insertAuditEvent,
  insertGraftPlan,
  loadWorkspaceBundle,
  markGraftPlanSuperseded,
} from "@/lib/preSurgeryIntelligence/repository.server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const gate = await requirePreSurgeryClinicianAccess(caseId);
    if (!gate.ok) return gate.response;
    const { admin, user } = gate.data;

    const body = (await req.json()) as {
      action?: "save" | "approve";
      basePlanId?: string;
      expectedBaseVersion?: number;
      /** Explicit acknowledgement required to rebase onto a newer head. */
      forceRebaseFromHead?: boolean;
      zones?: PreSurgeryGraftPlanZoneRow[];
      proposedSessionCount?: 1 | 2 | 3;
      stageOneZones?: PreSurgeryGraftPlan["stageOneZones"];
      donorAvailabilityBand?: PreSurgeryGraftPlan["donorAvailabilityBand"];
      donorConstraintNote?: string;
      graftReserve?: number;
      planningAssumptions?: string[];
      clinicianNote?: string;
    };

    const bundle = await loadWorkspaceBundle(admin, caseId);
    const resolved = resolveGraftPlanBaseForEdit({
      plans: bundle.graftPlans,
      basePlanId: body.basePlanId,
      expectedBaseVersion: body.expectedBaseVersion,
      forceRebaseFromHead: body.forceRebaseFromHead === true,
    });

    if (!resolved.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: resolved.conflict.message,
          conflict: resolved.conflict,
        },
        { status: 409 }
      );
    }

    const base = resolved.base;
    const aiSeed = bundle.graftPlans.find((p) => p.version === 1) ?? null;
    const approve = body.action === "approve";

    const next = createClinicianPlanRevision(
      base,
      {
        zones: body.zones,
        proposedSessionCount: body.proposedSessionCount,
        stageOneZones: body.stageOneZones,
        donorAvailabilityBand: body.donorAvailabilityBand,
        donorConstraintNote: body.donorConstraintNote,
        graftReserve: body.graftReserve,
        planningAssumptions: body.planningAssumptions,
        clinicianNote: body.clinicianNote,
        status: approve ? "approved" : "clinician_reviewed",
        approvedBy: approve ? user.id : null,
        approvedAt: approve ? new Date().toISOString() : null,
      },
      user.id
    );

    const issues = validateGraftPlan(next, {
      aiSeed,
      requireApprovalFields: approve,
    });
    if (issues.length > 0) {
      return NextResponse.json({ ok: false, error: "Validation failed", issues }, { status: 400 });
    }

    // Re-check head immediately before write to shrink race window.
    const fresh = await loadWorkspaceBundle(admin, caseId);
    const race = resolveGraftPlanBaseForEdit({
      plans: fresh.graftPlans,
      basePlanId: base.id,
      expectedBaseVersion: base.version,
      forceRebaseFromHead: false,
    });
    if (!race.ok) {
      return NextResponse.json(
        { ok: false, error: race.conflict.message, conflict: race.conflict },
        { status: 409 }
      );
    }

    if (base.status === "draft" || base.status === "clinician_reviewed" || base.status === "approved") {
      await markGraftPlanSuperseded(admin, base.id);
    }

    try {
      await insertGraftPlan(admin, next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/unique|duplicate|case_version/i.test(msg)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Version conflict — another save landed first. Reload and retry.",
            conflict: {
              code: "version_conflict",
              message: msg,
              expectedBasePlanId: base.id,
              expectedBaseVersion: base.version,
              currentHeadPlanId: resolved.head.id,
              currentHeadVersion: resolved.head.version,
              currentHeadStatus: resolved.head.status,
              resolveBy: "reload_and_rebase",
            },
          },
          { status: 409 }
        );
      }
      throw e;
    }

    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType: approve ? "graft_plan_approved" : "graft_plan_edited",
        actorId: user.id,
        metadata: {
          graftPlanId: next.id,
          version: next.version,
          previousPlanId: base.id,
          previousVersion: base.version,
          forceRebaseFromHead: body.forceRebaseFromHead === true,
        },
      })
    );

    const updated = await loadWorkspaceBundle(admin, caseId);
    return NextResponse.json({
      ok: true,
      plan: next,
      planComparison: buildPlanComparisonView(updated.graftPlans),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
