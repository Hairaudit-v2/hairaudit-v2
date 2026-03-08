import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRole } from "@/lib/roles";
import { isAuditor, resolveAuditorRole } from "@/lib/auth/isAuditor";

// GET — fetch current user's profile (role)
export async function GET() {
  const auth = await createSupabaseAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const role = resolveAuditorRole({
    profileRole: profile?.role,
    userMetadataRole: (user.user_metadata as Record<string, unknown>)?.role,
    userEmail: user.email,
  });

  return NextResponse.json({
    role,
    displayName: profile?.display_name ?? user.email?.split("@")[0],
    email: user.email,
  });
}

// POST — set role (for signup or role change)
export async function POST(req: Request) {
  const auth = await createSupabaseAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let role = parseRole(body?.role);

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  // Prevent privilege escalation: only allow role=auditor if user is auditor (profile or email override)
  if (role === "auditor" && !isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
    role = "patient";
  }
  const { error } = await admin.from("profiles").upsert(
    {
      id: user.id,
      role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, role });
}
