import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRole } from "@/lib/roles";
import { isAuditor } from "@/lib/auth/isAuditor";

// GET — fetch current user's profile (role)
export async function GET() {
  const auth = await createSupabaseAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  const parsedRole = parseRole(profile?.role);
  const role = parsedRole === "auditor" && isAuditor({ profileRole: profile?.role, userEmail: user.email })
    ? "auditor"
    : "patient";

  return NextResponse.json({
    role,
    displayName: profile?.name ?? user.email?.split("@")[0],
    email: user.email,
  });
}

// POST — initialize/update current user's beta profile (patient by default, auditor by allowlist)
export async function POST(req: Request) {
  const auth = await createSupabaseAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const requestedRole = body?.role;
  const name =
    typeof body?.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : (
          (user.user_metadata as Record<string, unknown> | undefined)?.full_name ??
          (user.user_metadata as Record<string, unknown> | undefined)?.name ??
          null
        );

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role =
    requestedRole === "auditor" && isAuditor({ profileRole: profile?.role, userEmail: user.email })
      ? "auditor"
      : "patient";
  const { error } = await admin.from("profiles").upsert(
    {
      id: user.id,
      role,
      email: user.email,
      name,
    },
    { onConflict: "id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, role });
}
