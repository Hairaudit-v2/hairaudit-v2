/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Observation review.
 */

import { NextResponse } from "next/server";
import { requirePreSurgeryClinicianAccess } from "@/lib/preSurgeryIntelligence/access.server";
import { applyObservationReview, createAuditEvent } from "@/lib/preSurgeryIntelligence";
import type { ObservationReviewStatus } from "@/lib/preSurgeryIntelligence/types";
import {
  insertAuditEvent,
  loadWorkspaceBundle,
  upsertObservation,
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
      observationId?: string;
      domain?: string;
      clinicianApprovedValue?: string | number | boolean | string[] | null;
      note?: string | null;
      status?: ObservationReviewStatus;
    };

    if (!body.status) {
      return NextResponse.json({ ok: false, error: "status required" }, { status: 400 });
    }

    const bundle = await loadWorkspaceBundle(admin, caseId);
    const observation = bundle.observations.find(
      (o) => o.id === body.observationId || o.domain === body.domain
    );
    if (!observation) {
      return NextResponse.json({ ok: false, error: "Observation not found" }, { status: 404 });
    }

    const next = applyObservationReview(
      observation,
      {
        clinicianApprovedValue: body.clinicianApprovedValue,
        note: body.note,
        status: body.status,
      },
      user.id
    );

    await upsertObservation(admin, next);
    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType:
          next.status === "confirmed" ? "observation_confirmed" : "observation_corrected",
        actorId: user.id,
        metadata: { observationId: next.id, domain: next.domain, status: next.status },
      })
    );

    return NextResponse.json({ ok: true, observation: next });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
