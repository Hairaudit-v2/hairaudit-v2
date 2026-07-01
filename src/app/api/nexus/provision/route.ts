/**
 * POST /api/nexus/provision
 * Signed HairAudit Nexus provisioning (HA-NEXUS-1). Disabled unless HA_NEXUS_ENABLED=true.
 */
import { NextResponse } from "next/server";

import { handleNexusProvisionHttp } from "@/lib/nexus/haNexusApi.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const { httpStatus, body } = await handleNexusProvisionHttp(req, rawBody);
    return NextResponse.json(body, { status: httpStatus });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
