/**
 * GET /api/nexus/state?globalProfessionalId=
 * Signed HairAudit Nexus reconciliation read (HA-NEXUS-1).
 */
import { NextResponse } from "next/server";

import { handleNexusStateHttp } from "@/lib/nexus/haNexusApi.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const globalProfessionalId = url.searchParams.get("globalProfessionalId");
    const { httpStatus, body } = await handleNexusStateHttp(req, globalProfessionalId);
    return NextResponse.json(body, { status: httpStatus });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
