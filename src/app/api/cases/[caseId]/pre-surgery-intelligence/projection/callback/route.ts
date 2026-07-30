/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — ImagingOS provider callback (signed + replay-protected).
 * Callbacks cannot alter arbitrary cases — only the projection named in the payload.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertCallbackNotReplayed,
  assertCallbackTargetsCase,
  createAuditEvent,
  createMemoryCallbackReplayStore,
  resolveProjectionProviderConfig,
  verifyImagingOsCallbackSignature,
} from "@/lib/preSurgeryIntelligence";
import type { PreSurgeryIllustrativeProjection } from "@/lib/preSurgeryIntelligence/types";
import {
  insertAuditEvent,
  updateProjectionRow,
} from "@/lib/preSurgeryIntelligence/repository.server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ caseId: string }> };

const replayStore = createMemoryCallbackReplayStore();

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const config = resolveProjectionProviderConfig();
    const secret = (process.env.HA_IMAGINGOS_PROJECTION_SIGNING_SECRET ?? "").trim();
    if (!secret) {
      return NextResponse.json({ ok: false, error: "Callback signing not configured" }, { status: 503 });
    }

    const timestamp = req.headers.get("x-hairaudit-timestamp") ?? "";
    const signature = req.headers.get("x-hairaudit-signature") ?? "";
    const bodyText = await req.text();

    const sig = verifyImagingOsCallbackSignature({
      body: bodyText,
      timestamp,
      signature,
      secret,
      maxSkewSeconds: 300,
    });
    if (!sig.ok) {
      return NextResponse.json({ ok: false, error: sig.code }, { status: 401 });
    }

    let payload: {
      caseId?: string;
      projectionId?: string;
      providerResponseId?: string;
      status?: "completed" | "failed";
      outputStorageRef?: string;
      outputChecksum?: string;
      errorCode?: string;
      message?: string;
    };
    try {
      payload = JSON.parse(bodyText) as typeof payload;
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    if (!payload.projectionId || !payload.providerResponseId) {
      return NextResponse.json(
        { ok: false, error: "projectionId and providerResponseId required" },
        { status: 400 }
      );
    }

    const callbackCaseId = payload.caseId ?? caseId;
    const caseCheck = assertCallbackTargetsCase({
      callbackCaseId,
      projectionCaseId: caseId,
    });
    if (!caseCheck.ok) {
      return NextResponse.json({ ok: false, error: caseCheck.code }, { status: 403 });
    }

    const replay = await assertCallbackNotReplayed({
      store: replayStore,
      providerResponseId: payload.providerResponseId,
      timestamp,
      caseId,
      ttlSeconds: config.callbackReplayTtlSeconds,
    });
    if (!replay.ok) {
      return NextResponse.json({ ok: false, error: replay.code }, { status: 409 });
    }

    const admin = createSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("hairaudit_pre_surgery_projections")
      .select("payload")
      .eq("id", payload.projectionId)
      .eq("case_id", caseId)
      .maybeSingle();
    if (error || !row?.payload) {
      return NextResponse.json({ ok: false, error: "Projection not found" }, { status: 404 });
    }

    const projection = row.payload as PreSurgeryIllustrativeProjection;
    if (projection.caseId !== caseId) {
      return NextResponse.json({ ok: false, error: "case_mismatch" }, { status: 403 });
    }

    // Callbacks may only advance in-flight generations — never approve or alter other cases.
    if (
      projection.status !== "queued" &&
      projection.status !== "generating" &&
      projection.status !== "draft_request" &&
      projection.status !== "pending"
    ) {
      return NextResponse.json(
        { ok: false, error: "Projection is not awaiting provider callback" },
        { status: 409 }
      );
    }

    if (payload.status === "failed") {
      const failed: PreSurgeryIllustrativeProjection = {
        ...projection,
        status: "failed",
        failureCode: payload.errorCode ?? "provider_callback_failure",
        failureMessage: payload.message ?? "Provider reported failure",
        providerResponseId: payload.providerResponseId,
        patientSharingEnabled: false,
      };
      await updateProjectionRow(admin, failed);
      await insertAuditEvent(
        admin,
        createAuditEvent({
          caseId,
          eventType: "projection_provider_failure",
          actorId: null,
          metadata: {
            projectionId: failed.id,
            providerResponseId: payload.providerResponseId,
            errorCode: failed.failureCode,
          },
        })
      );
      return NextResponse.json({ ok: true, projection: failed });
    }

    if (!payload.outputStorageRef || !payload.outputChecksum) {
      return NextResponse.json(
        { ok: false, error: "completed callbacks require outputStorageRef and outputChecksum" },
        { status: 400 }
      );
    }

    const completed: PreSurgeryIllustrativeProjection = {
      ...projection,
      status: "clinician_review",
      storagePath: payload.outputStorageRef,
      outputChecksum: payload.outputChecksum,
      generatedAt: new Date().toISOString(),
      providerResponseId: payload.providerResponseId,
      patientSharingEnabled: false,
    };
    await updateProjectionRow(admin, completed);
    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType: "projection_generated",
        actorId: null,
        metadata: {
          projectionId: completed.id,
          providerResponseId: payload.providerResponseId,
          via: "imagingos_callback",
          patientVisible: false,
        },
      })
    );

    return NextResponse.json({ ok: true, projection: completed });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
