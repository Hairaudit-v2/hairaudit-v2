import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { provisionAcademyMember, type ProvisionAcademyRole } from "@/lib/academy/provisionMembers";

export const runtime = "nodejs";

const ROLES: Set<string> = new Set(["trainer", "clinic_staff", "trainee"]);
const MAX_ENTRIES = 25;

export async function POST(req: Request) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  let payload: { entries?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const raw = Array.isArray(payload.entries) ? payload.entries : [];
  if (raw.length === 0) {
    return NextResponse.json({ ok: false, error: "entries[] is required" }, { status: 400 });
  }
  if (raw.length > MAX_ENTRIES) {
    return NextResponse.json({ ok: false, error: `At most ${MAX_ENTRIES} entries per request` }, { status: 400 });
  }

  const results: Awaited<ReturnType<typeof provisionAcademyMember>>[] = [];

  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const email = String(r.email ?? "").trim();
    const academy_role = String(r.academy_role ?? "").trim() as ProvisionAcademyRole;
    const display_name = r.display_name != null ? String(r.display_name).trim() : "";

    if (!email || !ROLES.has(academy_role)) {
      results.push({
        email: email || "(missing)",
        academy_role: (ROLES.has(academy_role) ? academy_role : "trainee") as ProvisionAcademyRole,
        ok: false,
        error: !email ? "Missing email" : "Invalid academy_role",
      });
      continue;
    }

    const result = await provisionAcademyMember({
      email,
      academyRole: academy_role,
      displayName: display_name || null,
      invitedByUserId: access.userId,
    });
    results.push(result);
  }

  return NextResponse.json({ ok: true, results });
}
