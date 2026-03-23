import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { isInternalGiiBackfillRequest } from "@/lib/internal/giiBackfillAuth";

export const runtime = "nodejs";

const MAX_CASE_IDS = 100;

/**
 * Enqueues `internal/gii-historical-backfill` Inngest workflow (sequential GII reruns, rate-limited).
 * Auth: same guarded internal headers/env as scripts/backfill-graft-integrity-cases.ts
 */
export async function POST(req: Request) {
  try {
    if (!isInternalGiiBackfillRequest(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const actor = String(process.env.GII_BACKFILL_TRIGGERED_BY ?? "").trim();
    if (!actor) {
      return NextResponse.json(
        { ok: false, error: "Server misconfigured: GII_BACKFILL_TRIGGERED_BY (auth user id for audit_rerun_log)" },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => null)) as { caseIds?: unknown } | null;
    const raw = body?.caseIds;
    const caseIds = Array.isArray(raw)
      ? raw.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, MAX_CASE_IDS)
      : [];

    if (caseIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Missing or empty caseIds array (max 100)" }, { status: 400 });
    }

    await inngest.send({
      name: "internal/gii-historical-backfill",
      data: { caseIds, triggeredBy: actor },
    });

    return NextResponse.json({
      ok: true,
      enqueued: caseIds.length,
      event: "internal/gii-historical-backfill",
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
