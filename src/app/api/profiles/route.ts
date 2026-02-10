import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRole, type UserRole } from "@/lib/roles";

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

  const role = profile?.role
    ? parseRole(profile.role)
    : parseRole((user.user_metadata as Record<string, unknown>)?.role);

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
  const role = parseRole(body?.role);

  const admin = createSupabaseAdminClient();
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
