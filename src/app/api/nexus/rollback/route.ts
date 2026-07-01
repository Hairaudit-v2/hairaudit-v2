/**
 * POST /api/nexus/rollback
 * Signed HairAudit Nexus rollback (HA-NEXUS-1).
 */
import { NextResponse } from "next/server";

import { handleNexusRollbackHttp } from "@/lib/nexus/haNexusApi.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const { httpStatus, body } = await handleNexusRollbackHttp(req, rawBody);
    return NextResponse.json(body, { status: httpStatus });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
